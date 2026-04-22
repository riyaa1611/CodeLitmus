/**
 * astParser.ts
 *
 * Regex-based analysis of TypeScript/JavaScript/Python source code.
 * Extracts rich function metadata without tree-sitter or VS Code API dependencies.
 * This is the "fallback" approach approved in the architecture spec.
 */

// ─── Exported interfaces ────────────────────────────────────────────────────

export interface FunctionNode {
  name: string;
  startLine: number;       // 0-indexed
  endLine: number;         // 0-indexed
  parameters: ParameterInfo[];
  returnStatements: ReturnInfo[];
  throwStatements: ThrowInfo[];
  tryCatchBlocks: TryCatchInfo[];
  awaitCalls: AwaitCallInfo[];
  externalCalls: ExternalCallInfo[];
  branchCount: number;
  nestingDepth: number;
  hasNullChecks: string[];  // parameter names with null/undefined checks
  body: string;             // raw source of function body
  fullSource: string;       // full function source including signature
}

export interface ParameterInfo {
  name: string;
  type?: string;
  hasDefault: boolean;
  isOptional: boolean;
}

export interface ReturnInfo {
  line: number;
  expression: string;
  type: 'value' | 'null' | 'undefined' | 'throw' | 'void' | 'promise';
}

export interface ThrowInfo {
  line: number;
  expression: string;
  isInsideTryCatch: boolean;
}

export interface TryCatchInfo {
  tryStartLine: number;
  tryEndLine: number;
  catchStartLine: number;
  catchEndLine: number;
  catchParameter: string;
  catchBody: string;
  hasRethrow: boolean;
  hasReturn: boolean;
  onlyLogs: boolean;  // catch block ONLY logs and does nothing else
}

export interface AwaitCallInfo {
  line: number;
  expression: string;
  isInsideTryCatch: boolean;
}

export interface ExternalCallInfo {
  line: number;
  expression: string;
  callee: string;  // e.g., "db.query", "stripe.charges.create"
  isInsideTryCatch: boolean;
  isAwaited: boolean;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse source code and extract all function nodes with metadata.
 */
export function extractFunctions(
  sourceCode: string,
  _filePath: string,
  language: 'typescript' | 'javascript' | 'python'
): FunctionNode[] {
  try {
    if (language === 'python') {
      return extractPythonFunctions(sourceCode);
    }
    return extractJsTsFunctions(sourceCode);
  } catch {
    return [];
  }
}

// ─── JS/TS extraction ────────────────────────────────────────────────────────

interface RawFunctionMatch {
  name: string;
  paramStr: string;
  matchIndex: number;
}

function extractJsTsFunctions(source: string): FunctionNode[] {
  const lines = source.split('\n');
  const results: FunctionNode[] = [];
  const visited = new Set<number>(); // startLine deduplication

  const candidates = findJsTsCandidates(source);

  for (const candidate of candidates) {
    try {
      const node = buildJsTsNode(source, lines, candidate);
      if (node && !visited.has(node.startLine)) {
        visited.add(node.startLine);
        results.push(node);
      }
    } catch {
      // skip malformed match
    }
  }

  return results;
}

function findJsTsCandidates(source: string): RawFunctionMatch[] {
  const candidates: RawFunctionMatch[] = [];

  // 1. Named function declarations / expressions
  //    export? async? function name<generics>?(params)
  const funcDeclRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g;
  for (const m of source.matchAll(funcDeclRe)) {
    candidates.push({ name: m[1], paramStr: m[2], matchIndex: m.index ?? 0 });
  }

  // 2. Arrow functions: export? const name = async? (params): RetType =>
  const arrowRe = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*[^=>{]+)?\s*=>/g;
  for (const m of source.matchAll(arrowRe)) {
    candidates.push({ name: m[1], paramStr: m[2], matchIndex: m.index ?? 0 });
  }

  // 3. Class methods
  //    (public|private|protected|static|async|override)* name(params): RetType {
  const methodRe = /(?:(?:(?:public|private|protected|static|async|override|readonly)\s+)*)(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>, |&\[\]?]+)?\s*\{/g;
  for (const m of source.matchAll(methodRe)) {
    const name = m[1];
    // Filter out keywords and control flow that aren't method names
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'switch', 'catch', 'try', 'do',
      'return', 'class', 'new', 'typeof', 'instanceof', 'void', 'delete',
      'in', 'of', 'case', 'default', 'break', 'continue', 'throw',
      'import', 'export', 'from', 'const', 'let', 'var', 'function',
      'async', 'await', 'yield', 'super', 'this', 'constructor',
    ]);
    if (!keywords.has(name) && /^[a-zA-Z_$]/.test(name)) {
      candidates.push({ name, paramStr: m[2], matchIndex: m.index ?? 0 });
    }
  }

  // Sort by position in source
  candidates.sort((a, b) => a.matchIndex - b.matchIndex);
  return candidates;
}

function buildJsTsNode(
  source: string,
  lines: string[],
  candidate: RawFunctionMatch
): FunctionNode | null {
  // Find the opening brace after the match position
  const searchFrom = candidate.matchIndex;
  const braceIdx = findOpeningBrace(source, searchFrom);
  if (braceIdx === -1) { return null; }

  const { bodyContent, endIdx } = extractBracedBody(source, braceIdx);
  if (endIdx === -1) { return null; }

  const startLine = getLineNumber(source, candidate.matchIndex);
  const endLine = getLineNumber(source, endIdx);
  const fullSource = source.slice(candidate.matchIndex, endIdx + 1);

  return buildFunctionNode(
    candidate.name,
    candidate.paramStr,
    bodyContent,
    fullSource,
    startLine,
    endLine,
    lines,
    source
  );
}

// ─── Python extraction ───────────────────────────────────────────────────────

function extractPythonFunctions(source: string): FunctionNode[] {
  const lines = source.split('\n');
  const results: FunctionNode[] = [];

  const pyFuncRe = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;

  for (const m of source.matchAll(pyFuncRe)) {
    try {
      const startLine = getLineNumber(source, m.index ?? 0);
      const { bodyContent, endLine } = extractPythonBody(lines, startLine);
      const fullSource = lines.slice(startLine, endLine + 1).join('\n');

      const node = buildFunctionNode(
        m[1],
        m[2],
        bodyContent,
        fullSource,
        startLine,
        endLine,
        lines,
        source
      );
      results.push(node);
    } catch {
      // skip
    }
  }

  return results;
}

/**
 * Extract Python function body by indentation rules.
 * Returns the body text (lines after the def line) and the 0-indexed end line.
 */
function extractPythonBody(
  lines: string[],
  defLine: number
): { bodyContent: string; endLine: number } {
  const defIndent = getIndent(lines[defLine] ?? '');
  let endLine = defLine;

  for (let i = defLine + 1; i < lines.length; i++) {
    const line = lines[i];
    // Blank lines are allowed inside the function
    if (line.trim() === '') {
      endLine = i;
      continue;
    }
    const indent = getIndent(line);
    if (indent > defIndent) {
      endLine = i;
    } else {
      break;
    }
  }

  const bodyLines = lines.slice(defLine + 1, endLine + 1);
  return { bodyContent: bodyLines.join('\n'), endLine };
}

function getIndent(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

// ─── Core metadata builder ───────────────────────────────────────────────────

function buildFunctionNode(
  name: string,
  paramStr: string,
  body: string,
  fullSource: string,
  startLine: number,
  endLine: number,
  lines: string[],
  _fullSource: string
): FunctionNode {
  const parameters = parseParameters(paramStr);
  const tryCatchBlocks = extractTryCatchBlocks(body, startLine);
  const returnStatements = extractReturnStatements(body, startLine);
  const throwStatements = extractThrowStatements(body, startLine, tryCatchBlocks);
  const awaitCalls = extractAwaitCalls(body, startLine, tryCatchBlocks);
  const externalCalls = extractExternalCalls(body, startLine, tryCatchBlocks);
  const branchCount = countBranches(body);
  const nestingDepth = computeNestingDepth(body);
  const hasNullChecks = detectNullChecks(body, parameters);

  return {
    name,
    startLine,
    endLine,
    parameters,
    returnStatements,
    throwStatements,
    tryCatchBlocks,
    awaitCalls,
    externalCalls,
    branchCount,
    nestingDepth,
    hasNullChecks,
    body,
    fullSource,
  };
}

// ─── Parameter parsing ───────────────────────────────────────────────────────

function parseParameters(paramStr: string): ParameterInfo[] {
  if (!paramStr.trim()) { return []; }

  const params: ParameterInfo[] = [];
  const parts = splitParams(paramStr);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) { continue; }

    // Destructured params — represent as anonymous
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      params.push({ name: trimmed, hasDefault: trimmed.includes('='), isOptional: false });
      continue;
    }

    // rest params
    const restMatch = trimmed.match(/^\.\.\.(\w+)(?:\s*:\s*(.+))?$/);
    if (restMatch) {
      params.push({ name: restMatch[1], type: restMatch[2]?.trim(), hasDefault: false, isOptional: false });
      continue;
    }

    // name?:type = default  OR  name:type = default  OR  name = default
    const paramMatch = trimmed.match(/^(\w+)(\?)?\s*(?::\s*([^=]+?))?\s*(?:=\s*(.+))?$/);
    if (paramMatch) {
      params.push({
        name: paramMatch[1],
        type: paramMatch[3]?.trim(),
        hasDefault: paramMatch[4] !== undefined,
        isOptional: paramMatch[2] === '?' || paramMatch[4] !== undefined,
      });
    } else {
      // Fallback — just take the first word as name
      const fallback = trimmed.match(/^(\w+)/);
      if (fallback) {
        params.push({ name: fallback[1], hasDefault: false, isOptional: false });
      }
    }
  }

  return params;
}

/**
 * Split a parameter string on commas, but respect <>, (), [] nesting.
 */
function splitParams(paramStr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (const ch of paramStr) {
    if ('<([{'.includes(ch)) { depth++; }
    else if ('>)]}' .includes(ch)) { depth = Math.max(0, depth - 1); }

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) { parts.push(current); }
  return parts;
}

// ─── Try/catch extraction ────────────────────────────────────────────────────

function extractTryCatchBlocks(body: string, funcStartLine: number): TryCatchInfo[] {
  const blocks: TryCatchInfo[] = [];
  const lines = body.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/\btry\s*\{/.test(line)) {
      const tryStartLine = funcStartLine + i;
      // Find closing brace of try block
      const tryStart = indexOfLineStart(body, i);
      const tryBraceIdx = body.indexOf('{', tryStart + line.indexOf('try'));
      if (tryBraceIdx === -1) { i++; continue; }

      const { endIdx: tryEndIdx } = extractBracedBody(body, tryBraceIdx);
      if (tryEndIdx === -1) { i++; continue; }

      const tryEndLine = funcStartLine + getLineNumber(body, tryEndIdx);
      const afterTry = tryEndIdx + 1;

      // Look for catch
      const catchRe = /\bcatch\s*\(\s*(\w*)\s*\)/;
      const remaining = body.slice(afterTry);
      const catchMatch = remaining.match(catchRe);
      if (!catchMatch) { i++; continue; }

      const catchRelIdx = afterTry + (catchMatch.index ?? 0);
      const catchStartLine = funcStartLine + getLineNumber(body, catchRelIdx);

      const catchBraceIdx = body.indexOf('{', catchRelIdx + catchMatch[0].length);
      if (catchBraceIdx === -1) { i++; continue; }

      const { bodyContent: catchBody, endIdx: catchEndIdx } = extractBracedBody(body, catchBraceIdx);
      const catchEndLine = funcStartLine + getLineNumber(body, catchEndIdx);

      const catchParameter = catchMatch[1] ?? 'e';
      const hasRethrow = /\bthrow\b/.test(catchBody);
      const hasReturn = /\breturn\b/.test(catchBody);
      const onlyLogs = /^\s*(console\.(log|error|warn|info|debug)\([^)]*\);?\s*)+$/.test(catchBody.trim())
        || (catchBody.trim() !== '' && /^[\s\n]*(console\.(log|error|warn|info|debug)\([^)]*\);?[\s\n]*)+$/.test(catchBody));

      blocks.push({
        tryStartLine,
        tryEndLine,
        catchStartLine,
        catchEndLine,
        catchParameter,
        catchBody,
        hasRethrow,
        hasReturn,
        onlyLogs,
      });

      // Advance past this catch block
      i = catchEndLine - funcStartLine + 1;
      continue;
    }
    i++;
  }

  return blocks;
}

// ─── Return statement extraction ─────────────────────────────────────────────

function extractReturnStatements(body: string, funcStartLine: number): ReturnInfo[] {
  const results: ReturnInfo[] = [];
  const returnRe = /\breturn\s+(.*?)(?:;|\n|$)/g;

  for (const m of body.matchAll(returnRe)) {
    const expr = m[1].trim();
    const line = funcStartLine + getLineNumber(body, m.index ?? 0);
    const type = classifyReturn(expr);
    results.push({ line, expression: expr, type });
  }

  // Bare return
  for (const m of body.matchAll(/\breturn\s*;/g)) {
    const line = funcStartLine + getLineNumber(body, m.index ?? 0);
    results.push({ line, expression: '', type: 'void' });
  }

  return results;
}

function classifyReturn(expr: string): ReturnInfo['type'] {
  if (!expr || expr === 'void 0') { return 'void'; }
  if (expr === 'null') { return 'null'; }
  if (expr === 'undefined') { return 'undefined'; }
  if (/\bnew\s+Promise\b|Promise\./.test(expr) || /\bawait\b/.test(expr)) { return 'promise'; }
  return 'value';
}

// ─── Throw statement extraction ──────────────────────────────────────────────

function extractThrowStatements(
  body: string,
  funcStartLine: number,
  tryCatchBlocks: TryCatchInfo[]
): ThrowInfo[] {
  const results: ThrowInfo[] = [];
  const throwRe = /\bthrow\s+((?:new\s+)?(?:\w+Error|Error)[^;]*?)(?:;|\n|$)/g;

  for (const m of body.matchAll(throwRe)) {
    const line = funcStartLine + getLineNumber(body, m.index ?? 0);
    const isInsideTryCatch = isLineInTryCatch(line, tryCatchBlocks);
    results.push({ line, expression: m[1].trim(), isInsideTryCatch });
  }

  return results;
}

// ─── Await call extraction ───────────────────────────────────────────────────

function extractAwaitCalls(
  body: string,
  funcStartLine: number,
  tryCatchBlocks: TryCatchInfo[]
): AwaitCallInfo[] {
  const results: AwaitCallInfo[] = [];
  const awaitRe = /\bawait\s+([\w.]+\([^)]*\))/g;

  for (const m of body.matchAll(awaitRe)) {
    const line = funcStartLine + getLineNumber(body, m.index ?? 0);
    const isInsideTryCatch = isLineInTryCatch(line, tryCatchBlocks);
    results.push({ line, expression: m[1], isInsideTryCatch });
  }

  return results;
}

// ─── External call extraction ────────────────────────────────────────────────

const EXTERNAL_PREFIXES = [
  'db.', 'database.', 'pool.', 'knex.', 'prisma.', 'mongoose.',
  'stripe.', 'paypal.', 'braintree.',
  'axios.', 'fetch.', 'http.', 'https.', 'request.',
  'redis.', 'cache.', 'memcached.',
  'aws.', 's3.', 'sqs.', 'sns.', 'ses.',
  'sendgrid.', 'mailgun.', 'nodemailer.',
  'twilio.', 'plaid.',
  'client.', 'api.',
];

function extractExternalCalls(
  body: string,
  funcStartLine: number,
  tryCatchBlocks: TryCatchInfo[]
): ExternalCallInfo[] {
  const results: ExternalCallInfo[] = [];
  // Multi-part method calls: optional "await " prefix, then obj.method.sub(
  const callRe = /\b((?:this\.)?[\w]+(?:\.[\w]+)+)\s*\(/g;

  for (const m of body.matchAll(callRe)) {
    const callee = m[1];
    if (!looksExternal(callee)) { continue; }

    const line = funcStartLine + getLineNumber(body, m.index ?? 0);
    const isInsideTryCatch = isLineInTryCatch(line, tryCatchBlocks);

    // Check if preceded by "await"
    const before = body.slice(Math.max(0, (m.index ?? 0) - 10), m.index ?? 0);
    const isAwaited = /\bawait\s+$/.test(before);

    results.push({
      line,
      expression: m[0].slice(0, -1) + ')',  // rough expression
      callee,
      isInsideTryCatch,
      isAwaited,
    });
  }

  return results;
}

function looksExternal(callee: string): boolean {
  const lower = callee.toLowerCase();
  for (const prefix of EXTERNAL_PREFIXES) {
    if (lower.startsWith(prefix) || lower.includes('.' + prefix.replace('.', ''))) {
      return true;
    }
  }
  // Heuristic: 3+ segment chains are often external (e.g. stripe.charges.create)
  if (callee.split('.').length >= 3) { return true; }
  return false;
}

// ─── Branch counting ─────────────────────────────────────────────────────────

function countBranches(body: string): number {
  let count = 0;
  count += (body.match(/\bif\s*\(/g) ?? []).length;
  count += (body.match(/\belse\s+if\s*\(/g) ?? []).length;
  count += (body.match(/\bswitch\s*\(/g) ?? []).length;
  count += (body.match(/\bcatch\s*\(/g) ?? []).length;
  // Ternary operators
  count += (body.match(/\?\s/g) ?? []).length;
  // Logical short-circuits that create branches
  count += (body.match(/\|\|/g) ?? []).length;
  count += (body.match(/&&/g) ?? []).length;
  return count;
}

// ─── Nesting depth ───────────────────────────────────────────────────────────

function computeNestingDepth(body: string): number {
  let current = 0;
  let max = 0;
  for (const ch of body) {
    if (ch === '{') { current++; if (current > max) { max = current; } }
    else if (ch === '}') { current = Math.max(0, current - 1); }
  }
  return max;
}

// ─── Null check detection ────────────────────────────────────────────────────

function detectNullChecks(body: string, parameters: ParameterInfo[]): string[] {
  const found = new Set<string>();
  for (const param of parameters) {
    const n = param.name;
    if (!n || n.startsWith('{') || n.startsWith('[') || n.startsWith('...')) { continue; }
    const escaped = escapeRegex(n);
    const patterns = [
      new RegExp(`if\\s*\\(!\\s*${escaped}\\b`),
      new RegExp(`if\\s*\\(${escaped}\\s*===\\s*null\\b`),
      new RegExp(`if\\s*\\(${escaped}\\s*===\\s*undefined\\b`),
      new RegExp(`if\\s*\\(${escaped}\\s*==\\s*null\\b`),
      new RegExp(`${escaped}\\s*\\?\\?\\s`),
      new RegExp(`${escaped}\\s*\\?\\.`),
      new RegExp(`if\\s*\\(${escaped}\\s*!==\\s*null\\b`),
      new RegExp(`if\\s*\\(${escaped}\\s*!==\\s*undefined\\b`),
      new RegExp(`typeof\\s+${escaped}\\s*===\\s*['"]undefined['"]`),
    ];
    if (patterns.some(p => p.test(body))) {
      found.add(n);
    }
  }
  return Array.from(found);
}

// ─── Brace-counting body extraction ──────────────────────────────────────────

/**
 * Given the index of an opening `{` in source, extract the body between the
 * braces (exclusive of the braces themselves) and return the index of the
 * matching closing `}`.
 */
function extractBracedBody(
  source: string,
  openBraceIdx: number
): { bodyContent: string; endIdx: number } {
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;

  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';

    // Handle string literals (skip brace counting inside strings)
    if (inString) {
      if (ch === inString && prev !== '\\') { inString = null; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') { depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const bodyContent = source.slice(openBraceIdx + 1, i);
        return { bodyContent, endIdx: i };
      }
    }
  }

  return { bodyContent: '', endIdx: -1 };
}

/**
 * Find the first `{` at or after startIdx, skipping over string literals.
 */
function findOpeningBrace(source: string, startIdx: number): number {
  let inString: '"' | "'" | '`' | null = null;

  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : '';

    if (inString) {
      if (ch === inString && prev !== '\\') { inString = null; }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') { return i; }
    // Stop if we hit a semicolon (not an arrow function with block body)
    if (ch === ';') { return -1; }
  }
  return -1;
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length - 1;
}

function indexOfLineStart(source: string, lineIndex: number): number {
  const lines = source.split('\n');
  let pos = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 for \n
  }
  return pos;
}

function isLineInTryCatch(line: number, blocks: TryCatchInfo[]): boolean {
  return blocks.some(b => line >= b.tryStartLine && line <= b.tryEndLine);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
