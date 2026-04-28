/**
 * test-local-pipeline.js
 *
 * Tests the local (no-LLM) pipeline end-to-end:
 *   extractFunctions → detectPatterns → traceCodePaths → generateLocalQuestions
 *
 * Run: node test-local-pipeline.js
 */

'use strict';

const { extractFunctions } = require('./out/analyzer/astParser');
const { detectPatterns } = require('./out/analyzer/patternDetector');
const { traceCodePaths } = require('./out/analyzer/codePathTracer');
const { generateLocalQuestions, countAvailableQuestions } = require('./out/quiz/localQuestionGenerator');

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TYPESCRIPT_SAMPLE = `
async function fetchUser(userId) {
  const result = await db.query("SELECT * FROM users WHERE id = " + userId);
  return result;
}

function processData(data) {
  try {
    return JSON.parse(data);
  } catch (e) {
    // silent catch
  }
}

async function sendEmail(address, body) {
  const res = await emailService.send(address, body);
  return res;
}

function buildQuery(input) {
  const sql = "SELECT * FROM orders WHERE name = '" + input + "'";
  return db.run(sql);
}
`;

const PYTHON_SAMPLE = `
def get_user(user_id):
    result = db.execute("SELECT * FROM users WHERE id = " + str(user_id))
    return result

def handle_request(data):
    try:
        return process(data)
    except Exception as e:
        pass

async def fetch_data(url):
    response = await http_client.get(url)
    return response
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

section('astParser — TypeScript');
{
  const fns = extractFunctions(TYPESCRIPT_SAMPLE, '/fake/file.ts', 'typescript');
  assert(fns.length >= 3, `extracts ≥3 functions (got ${fns.length})`);
  const names = fns.map(f => f.name);
  assert(names.includes('fetchUser'), 'finds fetchUser');
  assert(names.includes('processData'), 'finds processData');
  assert(names.includes('buildQuery'), 'finds buildQuery');
  const fetchUser = fns.find(f => f.name === 'fetchUser');
  assert(fetchUser?.body?.length > 0, 'fetchUser has body');
}

section('astParser — Python');
{
  const fns = extractFunctions(PYTHON_SAMPLE, '/fake/file.py', 'python');
  assert(fns.length >= 2, `extracts ≥2 Python functions (got ${fns.length})`);
}

section('patternDetector — TypeScript');
{
  const fns = extractFunctions(TYPESCRIPT_SAMPLE, '/fake/file.ts', 'typescript');
  let allPatterns = [];
  for (const fn of fns) {
    const patterns = detectPatterns(fn, 'file.ts', TYPESCRIPT_SAMPLE, 'typescript');
    allPatterns = allPatterns.concat(patterns);
  }
  assert(allPatterns.length >= 1, `detects ≥1 pattern (got ${allPatterns.length})`);

  const types = allPatterns.map(p => p.type);
  console.log(`    detected: ${[...new Set(types)].join(', ')}`);

  const hasSqlRisk = types.some(t => t === 'SQL_INJECTION_RISK');
  const hasSilentCatch = types.some(t => t === 'SILENT_CATCH');
  assert(hasSqlRisk || hasSilentCatch, 'catches SQL_INJECTION or SILENT_CATCH');

  for (const p of allPatterns) {
    assert(typeof p.severity === 'string', `pattern "${p.type}" has severity`);
    assert(typeof p.category === 'string', `pattern "${p.type}" has category`);
    assert(typeof p.description === 'string', `pattern "${p.type}" has description`);
  }
}

section('codePathTracer');
{
  const fns = extractFunctions(TYPESCRIPT_SAMPLE, '/fake/file.ts', 'typescript');
  const fn = fns.find(f => f.name === 'processData');
  if (fn) {
    const paths = traceCodePaths(fn, 'typescript');
    assert(Array.isArray(paths), 'returns array of paths');
    console.log(`    ${paths.length} code path(s) traced for processData`);
  } else {
    assert(false, 'processData found for path tracing');
  }
}

section('generateLocalQuestions — end-to-end');
{
  const files = [
    { path: '/fake/file.ts', content: TYPESCRIPT_SAMPLE, language: 'typescript' },
    { path: '/fake/file.py', content: PYTHON_SAMPLE, language: 'python' },
  ];

  const questions = generateLocalQuestions(files, { maxQuestions: 10 });
  assert(questions.length >= 1, `generates ≥1 question (got ${questions.length})`);

  for (const q of questions) {
    assert(typeof q.id === 'string' && q.id.length > 0, `q[${q.id}] has id`);
    assert(typeof q.question === 'string' && q.question.length > 10, `q[${q.id}] has question text`);
    assert(Array.isArray(q.options) && q.options.length === 4, `q[${q.id}] has 4 options`);
    const correctCount = q.options.filter(o => o.isCorrect).length;
    assert(correctCount === 1, `q[${q.id}] has exactly 1 correct answer (got ${correctCount})`);
    assert(typeof q.explanation === 'string' && q.explanation.length > 5, `q[${q.id}] has explanation`);
    assert(q.source === 'static-analysis', `q[${q.id}] source = static-analysis`);
    assert([1,2,3,4,5].includes(q.difficulty), `q[${q.id}] difficulty in 1-5`);
  }

  if (questions.length > 0) {
    console.log(`\n    Sample question:\n    "${questions[0].question}"`);
    for (const o of questions[0].options) {
      console.log(`      ${o.label}) ${o.text}${o.isCorrect ? ' ✓' : ''}`);
    }
  }
}

section('countAvailableQuestions');
{
  const files = [
    { path: '/fake/file.ts', content: TYPESCRIPT_SAMPLE, language: 'typescript' },
  ];
  const summary = countAvailableQuestions(files);
  assert(typeof summary.total === 'number', 'returns total count');
  assert(typeof summary.byCategory === 'object', 'returns byCategory');
  assert(typeof summary.bySeverity === 'object', 'returns bySeverity');
  console.log(`    total=${summary.total}, categories=${JSON.stringify(summary.byCategory)}`);
}

// ─── Result ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
