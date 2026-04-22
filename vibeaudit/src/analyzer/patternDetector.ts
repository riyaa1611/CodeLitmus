/**
 * patternDetector.ts
 *
 * Detects anti-patterns in code by analyzing FunctionNode objects produced by
 * astParser.ts. Every detector is fully implemented.
 */

import { FunctionNode, TryCatchInfo, ExternalCallInfo, ParameterInfo } from './astParser';

// Re-export the imported types so callers can reference them from this module
export type { FunctionNode, TryCatchInfo, ExternalCallInfo, ParameterInfo };

// ─── Pattern types ────────────────────────────────────────────────────────────

export type PatternType =
  | 'MISSING_ERROR_HANDLING'
  | 'SILENT_CATCH'
  | 'UNCHECKED_PARAMETER'
  | 'UNHANDLED_ASYNC'
  | 'INCONSISTENT_RETURN_TYPE'
  | 'MISSING_AUTH_CHECK'
  | 'SQL_INJECTION_RISK'
  | 'HARDCODED_SECRET'
  | 'RACE_CONDITION_RISK'
  | 'UNSAFE_TYPE_COERCION'
  | 'MISSING_INPUT_VALIDATION'
  | 'ERROR_SWALLOWING'
  | 'CALLBACK_HELL'
  | 'DEAD_CODE_AFTER_RETURN'
  | 'MISSING_AWAIT'
  | 'UNBOUNDED_LOOP_RISK'
  | 'EXPOSED_INTERNAL_ERROR';

// ─── Evidence interfaces ──────────────────────────────────────────────────────

export interface MissingErrorHandlingEvidence {
  kind: 'missing_error_handling';
  externalCall: string;
  callLine: number;
  isAsync: boolean;
  nearestTryCatch: number | null;
}

export interface SilentCatchEvidence {
  kind: 'silent_catch';
  tryStartLine: number;
  catchStartLine: number;
  catchBody: string;
  hasRethrow: boolean;
  hasReturn: boolean;
  onlyLogs: boolean;
  operationInTry: string;
}

export interface UncheckedParameterEvidence {
  kind: 'unchecked_parameter';
  parameterName: string;
  parameterType: string | undefined;
  usedOnLine: number;
  usageExpression: string;
  hasNullCheck: boolean;
  hasTypeCheck: boolean;
}

export interface UnhandledAsyncEvidence {
  kind: 'unhandled_async';
  asyncCall: string;
  callLine: number;
  isAwaited: boolean;
  isInsideTryCatch: boolean;
  hasCatchChain: boolean;
}

export interface InconsistentReturnEvidence {
  kind: 'inconsistent_return';
  returns: Array<{ line: number; type: string; expression: string }>;
  branchDescriptions: string[];
}

export interface SqlInjectionEvidence {
  kind: 'sql_injection';
  queryLine: number;
  queryExpression: string;
  concatenatedVariable: string;
  isParameterized: boolean;
}

export interface HardcodedSecretEvidence {
  kind: 'hardcoded_secret';
  secretType: 'api_key' | 'password' | 'token' | 'connection_string' | 'unknown';
  line: number;
  variableName: string;
  partialValue: string;
}

export interface MissingAwaitEvidence {
  kind: 'missing_await';
  asyncCall: string;
  callLine: number;
  functionIsAsync: boolean;
  resultUsedOnLine: number | null;
}

export interface DeadCodeEvidence {
  kind: 'dead_code';
  unreachableLine: number;
  reason: string;
  deadCodeSource: string;
}

export interface GenericEvidence {
  kind: 'generic';
  details: string;
}

export type PatternEvidence =
  | MissingErrorHandlingEvidence
  | SilentCatchEvidence
  | UncheckedParameterEvidence
  | UnhandledAsyncEvidence
  | InconsistentReturnEvidence
  | SqlInjectionEvidence
  | HardcodedSecretEvidence
  | MissingAwaitEvidence
  | DeadCodeEvidence
  | GenericEvidence;

// ─── DetectedPattern ──────────────────────────────────────────────────────────

export interface DetectedPattern {
  type: PatternType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'error-handling' | 'security' | 'data-flow' | 'edge-case' | 'architecture' | 'performance';
  file: string;
  functionName: string;
  line: number;
  endLine?: number;
  description: string;
  evidence: PatternEvidence;
  consequence: string;
  correctBehavior: string;
  incorrectAssumptions: string[];
}

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<DetectedPattern['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run all pattern detectors on a single FunctionNode and return deduplicated,
 * severity-sorted results.
 */
export function detectPatterns(
  func: FunctionNode,
  filePath: string,
  fileSource: string,
  language: 'typescript' | 'javascript' | 'python'
): DetectedPattern[] {
  const detectors: Array<() => DetectedPattern[]> = [
    () => detectMissingErrorHandling(func, filePath),
    () => detectSilentCatch(func, filePath),
    () => detectUncheckedParameter(func, filePath),
    () => detectUnhandledAsync(func, filePath),
    () => detectInconsistentReturn(func, filePath),
    () => detectHardcodedSecrets(func, filePath, fileSource),
    () => detectSqlInjection(func, filePath),
    () => detectMissingInputValidation(func, filePath, language),
    () => detectErrorSwallowing(func, filePath),
    () => detectExposedInternalError(func, filePath),
    () => detectDeadCodeAfterReturn(func, filePath),
    () => detectMissingAwait(func, filePath),
  ];

  const all: DetectedPattern[] = [];
  const seen = new Set<string>();

  for (const detector of detectors) {
    let results: DetectedPattern[] = [];
    try {
      results = detector();
    } catch {
      // Swallow detector crashes — return [] for that detector
    }
    for (const pattern of results) {
      const key = `${pattern.type}:${pattern.functionName}:${pattern.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(pattern);
      }
    }
  }

  all.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return all;
}

// ─── Detector 1: Missing error handling ──────────────────────────────────────

function detectMissingErrorHandling(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    for (const call of func.externalCalls) {
      if (call.isInsideTryCatch) { continue; }

      // Find the nearest try-catch block start line (if any exist in the function)
      const nearestTryCatch =
        func.tryCatchBlocks.length > 0
          ? func.tryCatchBlocks.reduce((closest, block) => {
              const dist = Math.abs(block.tryStartLine - call.line);
              return dist < Math.abs(closest - call.line) ? block.tryStartLine : closest;
            }, func.tryCatchBlocks[0].tryStartLine)
          : null;

      const evidence: MissingErrorHandlingEvidence = {
        kind: 'missing_error_handling',
        externalCall: call.expression,
        callLine: call.line,
        isAsync: call.isAwaited,
        nearestTryCatch,
      };

      patterns.push({
        type: 'MISSING_ERROR_HANDLING',
        severity: 'high',
        category: 'error-handling',
        file: filePath,
        functionName: func.name,
        line: call.line,
        description: `External call to \`${call.callee}\` is not wrapped in a try-catch block.`,
        evidence,
        consequence: `If ${call.callee} throws, the error propagates unhandled. In a web server, this returns a 500 with no useful message.`,
        correctBehavior: `The call to ${call.callee} on line ${call.line + 1} is not inside a try-catch. If it fails, the error is unhandled.`,
        incorrectAssumptions: [
          'Express automatically catches async errors in route handlers',
          'The error is caught by a global error handler',
          'The function returns null on failure',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 2: Silent catch ─────────────────────────────────────────────────

function detectSilentCatch(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    for (const block of func.tryCatchBlocks) {
      if (!(block.onlyLogs === true && block.hasRethrow === false && block.hasReturn === false)) {
        continue;
      }

      // Find a representative operation that was tried
      const operationInTry = findOperationInTry(func, block.tryStartLine, block.tryEndLine);

      const evidence: SilentCatchEvidence = {
        kind: 'silent_catch',
        tryStartLine: block.tryStartLine,
        catchStartLine: block.catchStartLine,
        catchBody: block.catchBody,
        hasRethrow: block.hasRethrow,
        hasReturn: block.hasReturn,
        onlyLogs: block.onlyLogs,
        operationInTry,
      };

      patterns.push({
        type: 'SILENT_CATCH',
        severity: 'high',
        category: 'error-handling',
        file: filePath,
        functionName: func.name,
        line: block.catchStartLine,
        endLine: block.catchEndLine,
        description: `The catch block on line ${block.catchStartLine + 1} only logs the error without re-throwing or returning.`,
        evidence,
        consequence:
          'When the operation in the try block fails, the error is logged but execution continues normally. The calling code receives no indication of failure.',
        correctBehavior: `The catch block on line ${block.catchStartLine + 1} catches the error, logs it, and does nothing else. Execution continues after the try-catch.`,
        incorrectAssumptions: [
          'The function returns an error response to the caller',
          'The error is re-thrown to the calling function',
          'A failure status code is returned to the client',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

/** Return a representative external call expression found between tryStart and tryEnd. */
function findOperationInTry(
  func: FunctionNode,
  tryStartLine: number,
  tryEndLine: number
): string {
  const callInTry = func.externalCalls.find(
    c => c.line >= tryStartLine && c.line <= tryEndLine
  );
  if (callInTry) { return callInTry.expression; }
  const awaitInTry = func.awaitCalls.find(
    a => a.line >= tryStartLine && a.line <= tryEndLine
  );
  if (awaitInTry) { return awaitInTry.expression; }
  return 'the operation';
}

// ─── Detector 3: Unchecked parameter ─────────────────────────────────────────

const FRAMEWORK_PARAMS = new Set(['event', 'context', 'req', 'res', 'next']);

function detectUncheckedParameter(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    // Only emit for non-trivial functions
    const isNonTrivial =
      func.externalCalls.length > 0 || func.returnStatements.length > 0;
    if (!isNonTrivial) { return []; }

    for (const param of func.parameters) {
      if (param.hasDefault || param.isOptional) { continue; }
      if (!param.name || param.name === '_' || param.name.startsWith('{') || param.name.startsWith('[')) { continue; }
      if (FRAMEWORK_PARAMS.has(param.name)) { continue; }
      if (func.hasNullChecks.includes(param.name)) { continue; }

      // Find first usage of this parameter in the function body
      const usageInfo = findParamUsage(func.body, param.name, func.startLine);

      const hasNullCheck = func.hasNullChecks.includes(param.name);
      const hasTypeCheck = new RegExp(`typeof\\s+${escapeRegex(param.name)}`).test(func.body);

      const evidence: UncheckedParameterEvidence = {
        kind: 'unchecked_parameter',
        parameterName: param.name,
        parameterType: param.type,
        usedOnLine: usageInfo.line,
        usageExpression: usageInfo.expression,
        hasNullCheck,
        hasTypeCheck,
      };

      patterns.push({
        type: 'UNCHECKED_PARAMETER',
        severity: 'medium',
        category: 'edge-case',
        file: filePath,
        functionName: func.name,
        line: usageInfo.line,
        description: `Parameter \`${param.name}\` is used without a null/undefined check.`,
        evidence,
        consequence: `If ${func.name} is called with ${param.name} = undefined, any property access will throw a TypeError.`,
        correctBehavior: `The function does not check if ${param.name} is null or undefined before using it.`,
        incorrectAssumptions: [
          "TypeScript's type system prevents null from being passed at runtime",
          'The function returns undefined gracefully if the parameter is missing',
          'Express validates request parameters before they reach this handler',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

function findParamUsage(
  body: string,
  paramName: string,
  funcStartLine: number
): { line: number; expression: string } {
  // Look for paramName.something or paramName[something] or just paramName used
  const re = new RegExp(`\\b${escapeRegex(paramName)}\\b(?:\\.[\\w]+|\\[)`, 'g');
  const m = re.exec(body);
  if (m) {
    const line = funcStartLine + getLineNumber(body, m.index);
    return { line, expression: m[0] };
  }
  // Fall back to any usage
  const re2 = new RegExp(`\\b${escapeRegex(paramName)}\\b`, 'g');
  const m2 = re2.exec(body);
  if (m2) {
    const line = funcStartLine + getLineNumber(body, m2.index);
    return { line, expression: m2[0] };
  }
  return { line: funcStartLine, expression: paramName };
}

// ─── Detector 4: Unhandled async ─────────────────────────────────────────────

function detectUnhandledAsync(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    // Skip trivial functions with no external calls
    if (func.externalCalls.length === 0) { return []; }

    for (const awaitCall of func.awaitCalls) {
      if (awaitCall.isInsideTryCatch) { continue; }

      // Check whether there's a .catch() chained on the call
      const hasCatchChain = /\.catch\s*\(/.test(awaitCall.expression);

      const evidence: UnhandledAsyncEvidence = {
        kind: 'unhandled_async',
        asyncCall: awaitCall.expression,
        callLine: awaitCall.line,
        isAwaited: true,
        isInsideTryCatch: awaitCall.isInsideTryCatch,
        hasCatchChain,
      };

      patterns.push({
        type: 'UNHANDLED_ASYNC',
        severity: 'high',
        category: 'error-handling',
        file: filePath,
        functionName: func.name,
        line: awaitCall.line,
        description: `Awaited call \`${awaitCall.expression}\` is not wrapped in a try-catch.`,
        evidence,
        consequence:
          "If the awaited call rejects, Node.js logs an UnhandledPromiseRejection warning and the operation fails silently.",
        correctBehavior: `The await call on line ${awaitCall.line + 1} is not inside a try-catch. If it rejects, the rejection propagates unhandled.`,
        incorrectAssumptions: [
          'The Promise rejection is caught by a .catch() handler',
          'The async function automatically returns undefined on rejection',
          'Express catches unhandled async rejections automatically',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 5: Inconsistent return type ────────────────────────────────────

function detectInconsistentReturn(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    if (func.returnStatements.length < 2) { return []; }

    const valueReturns = func.returnStatements.filter(r => r.type === 'value');
    const nullReturns = func.returnStatements.filter(r => r.type === 'null' || r.type === 'undefined');

    if (valueReturns.length === 0 || nullReturns.length === 0) { return []; }

    const allReturns = func.returnStatements.map(r => ({
      line: r.line,
      type: r.type,
      expression: r.expression,
    }));

    const typesPresent = [...new Set(allReturns.map(r => r.type))];
    const branchDescriptions = typesPresent.map(t => `returns ${t}`);

    const evidence: InconsistentReturnEvidence = {
      kind: 'inconsistent_return',
      returns: allReturns,
      branchDescriptions,
    };

    const typeList = typesPresent.join(', ');

    patterns.push({
      type: 'INCONSISTENT_RETURN_TYPE',
      severity: 'medium',
      category: 'data-flow',
      file: filePath,
      functionName: func.name,
      line: func.startLine,
      description: `Function \`${func.name}\` returns different types from different branches: ${typeList}.`,
      evidence,
      consequence:
        'Callers that don\'t check for null/undefined will get a TypeError when the function takes the null-returning path.',
      correctBehavior: `The function returns different types from different branches: ${typeList}.`,
      incorrectAssumptions: [
        'The function always returns the same type',
        'TypeScript enforces consistent return types at runtime',
        'The caller handles all return type variants',
      ],
    });

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 6: Hardcoded secrets ───────────────────────────────────────────

function detectHardcodedSecrets(
  func: FunctionNode,
  filePath: string,
  fileSource: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];
    const lines = fileSource.split('\n');

    interface SecretMatch {
      pattern: RegExp;
      secretType: HardcodedSecretEvidence['secretType'];
    }

    const secretPatterns: SecretMatch[] = [
      {
        pattern: /(?:api[_-]?key|apikey|secret|password|passwd|pwd|token|auth)\s*[:=]\s*['"][A-Za-z0-9_\-\.]{8,}['"]/gi,
        secretType: 'api_key',
      },
      { pattern: /sk-[A-Za-z0-9]{20,}/g, secretType: 'api_key' },
      { pattern: /sk_live_[A-Za-z0-9]{20,}/g, secretType: 'api_key' },
      { pattern: /ghp_[A-Za-z0-9]{36}/g, secretType: 'token' },
      { pattern: /AKIA[A-Z0-9]{16}/g, secretType: 'api_key' },
    ];

    // Classify the secret type more precisely by examining what keyword was used
    function classifyByMatch(raw: string): HardcodedSecretEvidence['secretType'] {
      const lower = raw.toLowerCase();
      if (/password|passwd|pwd/.test(lower)) { return 'password'; }
      if (/token|auth/.test(lower)) { return 'token'; }
      if (/connection|conn_str|database_url|db_url/.test(lower)) { return 'connection_string'; }
      if (/api[_-]?key|apikey|secret/.test(lower)) { return 'api_key'; }
      return 'unknown';
    }

    const seen = new Set<string>(); // deduplicate by line+value

    for (const { pattern, secretType: baseType } of secretPatterns) {
      pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(fileSource)) !== null) {
        const matchStart = m.index;
        const lineIndex = fileSource.slice(0, matchStart).split('\n').length - 1;
        const lineText = lines[lineIndex] ?? '';
        const key = `${lineIndex}:${m[0].slice(0, 10)}`;
        if (seen.has(key)) { continue; }
        seen.add(key);

        // Extract variable name from the line
        const varMatch = lineText.match(/(?:const|let|var)\s+(\w+)/);
        const variableName = varMatch ? varMatch[1] : 'unknown';

        // Determine the raw secret value (the quoted part or the pattern match)
        const valueMatch = m[0].match(/['"]([^'"]+)['"]/);
        const rawValue = valueMatch ? valueMatch[1] : m[0];
        const partialValue = rawValue.slice(0, 4) + '...';

        const detectedType = classifyByMatch(m[0]) !== 'unknown' ? classifyByMatch(m[0]) : baseType;

        const evidence: HardcodedSecretEvidence = {
          kind: 'hardcoded_secret',
          secretType: detectedType,
          line: lineIndex,
          variableName,
          partialValue,
        };

        patterns.push({
          type: 'HARDCODED_SECRET',
          severity: 'critical',
          category: 'security',
          file: filePath,
          functionName: func.name,
          line: lineIndex,
          description: `Hardcoded ${detectedType} detected on line ${lineIndex + 1} (variable: ${variableName}).`,
          evidence,
          consequence:
            'If this code is committed to a public repository or compromised, credentials are exposed. Rotate immediately.',
          correctBehavior:
            'The value is hardcoded directly in source code, not loaded from environment variables.',
          incorrectAssumptions: [
            'The .gitignore prevents this file from being committed',
            'The value is loaded from an environment variable',
            'Only team members with repo access can see this',
          ],
        });
      }
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 7: SQL injection ────────────────────────────────────────────────

function detectSqlInjection(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];
    const body = func.body;
    const bodyLines = body.split('\n');

    // Patterns that look like vulnerable SQL calls
    const sqlCallRe =
      /(?:db|pool|connection|knex|client)\.(?:query|execute|run)\s*\(\s*(?:`[^`]*\$\{[^}]+\}|['"][^'"]*['"\s]*\+)/g;

    const seen = new Set<number>();

    let m: RegExpExecArray | null;
    while ((m = sqlCallRe.exec(body)) !== null) {
      const relLine = getLineNumber(body, m.index);
      const absLine = func.startLine + relLine;
      if (seen.has(absLine)) { continue; }
      seen.add(absLine);

      const lineText = bodyLines[relLine] ?? '';

      // Extract the concatenated variable — look for ${varName} or + varName
      const templateVarMatch = m[0].match(/\$\{([^}]+)\}/);
      const concatVarMatch = m[0].match(/\+\s*([\w.[\]'"]+)/);
      const concatenatedVariable =
        templateVarMatch ? templateVarMatch[1] : concatVarMatch ? concatVarMatch[1] : 'user_input';

      const evidence: SqlInjectionEvidence = {
        kind: 'sql_injection',
        queryLine: absLine,
        queryExpression: lineText.trim(),
        concatenatedVariable,
        isParameterized: false,
      };

      patterns.push({
        type: 'SQL_INJECTION_RISK',
        severity: 'critical',
        category: 'security',
        file: filePath,
        functionName: func.name,
        line: absLine,
        description: `SQL query on line ${absLine + 1} uses string concatenation or template literals with variables.`,
        evidence,
        consequence:
          'An attacker can inject arbitrary SQL by manipulating the input, potentially reading all data or dropping tables.',
        correctBehavior:
          'The SQL query uses string concatenation/template literals with user input, making it vulnerable to SQL injection.',
        incorrectAssumptions: [
          'The query uses parameterized statements automatically',
          'Input validation prevents SQL injection',
          'The ORM sanitizes inputs automatically',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 8: Missing input validation ────────────────────────────────────

function detectMissingInputValidation(
  func: FunctionNode,
  filePath: string,
  _language: 'typescript' | 'javascript' | 'python'
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];
    const body = func.body;

    const usesRequestData =
      /\breq\.body\b/.test(body) ||
      /\breq\.params\b/.test(body) ||
      /\breq\.query\b/.test(body);

    if (!usesRequestData) { return []; }

    const validationKeywords = [
      'zod', 'joi', 'yup', 'express-validator',
      'validate', 'schema.parse', 'z.parse',
    ];
    const hasValidation = validationKeywords.some(kw => body.includes(kw));

    if (hasValidation) { return []; }

    // Find first line that uses req.body/params/query
    const usageRe = /\breq\.(body|params|query)\b/g;
    const m = usageRe.exec(body);
    const usageLine = m ? func.startLine + getLineNumber(body, m.index) : func.startLine;

    const evidence: GenericEvidence = {
      kind: 'generic',
      details: `req.body/params/query used without schema validation. No zod/joi/yup/express-validator found in function body.`,
    };

    patterns.push({
      type: 'MISSING_INPUT_VALIDATION',
      severity: 'medium',
      category: 'security',
      file: filePath,
      functionName: func.name,
      line: usageLine,
      description: `Request data from \`req.body\`/\`req.params\`/\`req.query\` is used without schema validation.`,
      evidence,
      consequence:
        'Unvalidated user input reaches business logic directly. Attackers can send unexpected types, missing fields, or oversized data.',
      correctBehavior:
        'Request data from req.body/params/query is used directly without schema validation.',
      incorrectAssumptions: [
        'TypeScript interfaces validate data at runtime',
        'Express automatically validates request bodies',
        'The database rejects invalid data types',
      ],
    });

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 9: Error swallowing ────────────────────────────────────────────

function detectErrorSwallowing(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    for (const block of func.tryCatchBlocks) {
      const catchTrimmed = block.catchBody.trim();
      const isEmpty = catchTrimmed === '';
      const onlyComments = /^(\s*(\/\/.*)?(\n|$))*$/.test(block.catchBody);

      if (!isEmpty && !onlyComments) { continue; }

      const evidence: SilentCatchEvidence = {
        kind: 'silent_catch',
        tryStartLine: block.tryStartLine,
        catchStartLine: block.catchStartLine,
        catchBody: block.catchBody,
        hasRethrow: false,
        hasReturn: false,
        onlyLogs: false,
        operationInTry: findOperationInTry(func, block.tryStartLine, block.tryEndLine),
      };

      patterns.push({
        type: 'ERROR_SWALLOWING',
        severity: 'high',
        category: 'error-handling',
        file: filePath,
        functionName: func.name,
        line: block.catchStartLine,
        endLine: block.catchEndLine,
        description: `Empty catch block on line ${block.catchStartLine + 1} swallows the error completely.`,
        evidence,
        consequence:
          'Errors are completely silenced. The operation fails but nothing is logged, returned, or re-thrown. Impossible to debug in production.',
        correctBehavior:
          'The catch block is empty — the error is swallowed completely with no logging or error propagation.',
        incorrectAssumptions: [
          'The empty catch is intentional and safe here',
          'The error propagates after the catch block',
          'A parent try-catch handles the error',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 10: Exposed internal error ─────────────────────────────────────

function detectExposedInternalError(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];

    for (const block of func.tryCatchBlocks) {
      const body = block.catchBody;

      // Must contain a response send
      const hasResponseSend =
        /\bres\s*\.\s*(?:json|send|status)\b/.test(body);
      if (!hasResponseSend) { continue; }

      // Must expose raw error details
      const exposesError =
        /\berr(?:or)?\s*\.\s*(?:message|stack)\b/.test(body) ||
        /String\s*\(\s*err(?:or)?\s*\)/.test(body);
      if (!exposesError) { continue; }

      // Find the line inside the catch block where the leak occurs
      const catchLines = body.split('\n');
      let leakRelLine = 0;
      const leakRe = /\bres\s*\.\s*(?:json|send|status)\b/;
      for (let i = 0; i < catchLines.length; i++) {
        if (leakRe.test(catchLines[i])) { leakRelLine = i; break; }
      }
      const absLine = block.catchStartLine + leakRelLine;

      const evidence: GenericEvidence = {
        kind: 'generic',
        details: `catch block sends err.message/err.stack or String(err) in HTTP response via res.json/send/status.`,
      };

      patterns.push({
        type: 'EXPOSED_INTERNAL_ERROR',
        severity: 'high',
        category: 'security',
        file: filePath,
        functionName: func.name,
        line: absLine,
        endLine: block.catchEndLine,
        description: `Internal error details are exposed in the HTTP response inside the catch block at line ${block.catchStartLine + 1}.`,
        evidence,
        consequence:
          'Stack traces and internal error messages are sent to clients in API responses, leaking implementation details to attackers.',
        correctBehavior:
          'The catch block sends the raw error message/stack to the HTTP response, exposing internal implementation details.',
        incorrectAssumptions: [
          'Sending error.message helps clients debug issues',
          'Only developers will read the error response',
          "The error message doesn't contain sensitive information",
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 11: Dead code after return ─────────────────────────────────────

function detectDeadCodeAfterReturn(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];
    const bodyLines = func.body.split('\n');
    const seen = new Set<number>();

    for (let i = 0; i < bodyLines.length; i++) {
      const line = bodyLines[i];
      const trimmed = line.trim();

      // Line that terminates a branch
      const isTerminator = /\breturn\b/.test(trimmed) || /\bthrow\b/.test(trimmed);
      if (!isTerminator) { continue; }

      // Look ahead for non-empty, non-comment lines before a closing brace
      for (let j = i + 1; j < bodyLines.length; j++) {
        const nextTrimmed = bodyLines[j].trim();
        if (nextTrimmed === '') { continue; }
        // Closing brace ends the scope — stop looking
        if (nextTrimmed === '}' || nextTrimmed === '};') { break; }
        // Comment lines are not dead code in the interesting sense, but still skip
        if (nextTrimmed.startsWith('//') || nextTrimmed.startsWith('*') || nextTrimmed.startsWith('/*')) { continue; }

        // This looks like executable dead code
        const absLine = func.startLine + j;
        if (seen.has(absLine)) { break; }
        seen.add(absLine);

        const reason = /\breturn\b/.test(trimmed) ? 'return statement' : 'throw statement';

        const evidence: DeadCodeEvidence = {
          kind: 'dead_code',
          unreachableLine: absLine,
          reason: `Preceded by a ${reason} on line ${func.startLine + i + 1}`,
          deadCodeSource: nextTrimmed,
        };

        patterns.push({
          type: 'DEAD_CODE_AFTER_RETURN',
          severity: 'low',
          category: 'architecture',
          file: filePath,
          functionName: func.name,
          line: absLine,
          description: `Code on line ${absLine + 1} is unreachable because of the ${reason} on line ${func.startLine + i + 1}.`,
          evidence,
          consequence:
            'Dead code misleads readers into thinking it runs. It also wastes maintenance effort.',
          correctBehavior: `Code after the return/throw statement on line ${func.startLine + i + 1} can never execute.`,
          incorrectAssumptions: [
            'The code after return runs in some cases',
            'The return is conditional',
            'The code is a fallback that runs on error',
          ],
        });

        break; // Only report the first dead line per return/throw
      }
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Detector 12: Missing await ───────────────────────────────────────────────

const KNOWN_ASYNC_PATTERNS = [
  'db.query', 'db.findOne', 'db.find',
  'mongoose', 'fetch', 'axios',
  'stripe', 'redis',
  '.save()', '.create()', '.update()', '.delete()',
];

function detectMissingAwait(
  func: FunctionNode,
  filePath: string
): DetectedPattern[] {
  try {
    const patterns: DetectedPattern[] = [];
    const body = func.body;
    const bodyLines = body.split('\n');
    const functionIsAsync = /\basync\b/.test(func.fullSource.split('\n')[0] ?? '');
    const seen = new Set<number>();

    // Match: const/let/var name = <not await>(callee)(
    const assignRe =
      /(?:const|let|var)\s+(\w+)\s*=\s*(?!await\s)([\w.]+)\s*\(/g;

    let m: RegExpExecArray | null;
    while ((m = assignRe.exec(body)) !== null) {
      const callee = m[2];

      // Check whether callee looks like a known async function
      const looksAsync = KNOWN_ASYNC_PATTERNS.some(pat => {
        const clean = pat.replace(/[()]/g, '');
        return callee.toLowerCase().includes(clean.toLowerCase());
      });
      if (!looksAsync) { continue; }

      const relLine = getLineNumber(body, m.index);
      const absLine = func.startLine + relLine;
      if (seen.has(absLine)) { continue; }
      seen.add(absLine);

      // Check whether the result variable is used later
      const varName = m[1];
      const restBody = body.slice((m.index ?? 0) + m[0].length);
      const usageRe = new RegExp(`\\b${escapeRegex(varName)}\\b`);
      const usageMatch = usageRe.exec(restBody);
      const resultUsedOnLine = usageMatch
        ? func.startLine + relLine + getLineNumber(restBody, usageMatch.index)
        : null;

      const lineText = bodyLines[relLine] ?? '';

      const evidence: MissingAwaitEvidence = {
        kind: 'missing_await',
        asyncCall: callee,
        callLine: absLine,
        functionIsAsync,
        resultUsedOnLine,
      };

      patterns.push({
        type: 'MISSING_AWAIT',
        severity: 'high',
        category: 'data-flow',
        file: filePath,
        functionName: func.name,
        line: absLine,
        description: `Call to \`${callee}\` on line ${absLine + 1} is not awaited: \`${lineText.trim()}\``,
        evidence,
        consequence:
          'The variable holds an unresolved Promise object instead of the actual value. Any property access on it will be undefined or throw.',
        correctBehavior: `The call to ${callee} returns a Promise, but it's not awaited. The variable contains a Promise object, not the resolved value.`,
        incorrectAssumptions: [
          'The async call resolves synchronously',
          'JavaScript automatically awaits Promises',
          'The variable will contain the result after a tick',
        ],
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── Local utility helpers ────────────────────────────────────────────────────

function getLineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length - 1;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
