/**
 * codePathTracer.ts
 *
 * Traces possible execution paths through a function using FunctionNode data
 * produced by astParser.ts. Describes what happens along each code path —
 * "if X fails", "if user is null", etc. — for use by the question template engine.
 */

import { FunctionNode, ReturnInfo, TryCatchInfo } from './astParser';

// ─── Exported types ──────────────────────────────────────────────────────────

export interface CodePath {
  condition: string;      // e.g., "if try block succeeds", "if catch block executes", "if user is null"
  actions: string[];      // e.g., ["queries db.findUser", "checks user.role", "returns user"]
  returnValue: string;    // e.g., "User object", "null", "throws NotFoundError", "undefined (implicit)"
  sideEffects: string[];  // e.g., ["logs to console", "writes to database", "sends HTTP response"]
  canThrow: boolean;
  throwsWhat?: string;    // e.g., "Error", "NotFoundError"
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Build the set of code paths for a function.
 * Always returns at least 1 path (the happy path).
 * Returns at most 4 paths.
 */
export function traceCodePaths(func: FunctionNode, _language: string): CodePath[] {
  try {
    const paths: CodePath[] = [];

    paths.push(buildHappyPath(func));

    const nullPath = buildNullPath(func);
    if (nullPath) {
      paths.push(nullPath);
    }

    const errorPath = buildErrorPath(func);
    if (errorPath) {
      paths.push(errorPath);
    }

    const unhandledPath = buildUnhandledErrorPath(func);
    if (unhandledPath) {
      paths.push(unhandledPath);
    }

    return paths.slice(0, 4);
  } catch {
    // Safety net — always return at least one path
    return [fallbackHappyPath()];
  }
}

// ─── Path builders ────────────────────────────────────────────────────────────

function buildHappyPath(func: FunctionNode): CodePath {
  const actions = describeActions(func);
  const returnValue = resolveHappyReturnValue(func);
  const sideEffects = detectSideEffects(func.body);
  const canThrow = hasUncaughtThrow(func);
  const throwsWhat = canThrow ? resolveThrowsWhat(func) : undefined;

  const path: CodePath = {
    condition: 'normal execution',
    actions,
    returnValue,
    sideEffects,
    canThrow,
  };

  if (throwsWhat !== undefined) {
    path.throwsWhat = throwsWhat;
  }

  return path;
}

function buildNullPath(func: FunctionNode): CodePath | null {
  const nullOrUndef = func.returnStatements.find(
    (r: ReturnInfo) => r.type === 'null' || r.type === 'undefined'
  );
  if (!nullOrUndef) {
    return null;
  }

  const returnValue = nullOrUndef.type === 'null' ? 'null' : 'undefined';

  return {
    condition: 'if result is null/not found',
    actions: [`returns ${returnValue} early`],
    returnValue,
    sideEffects: [],
    canThrow: false,
  };
}

function buildErrorPath(func: FunctionNode): CodePath | null {
  if (func.tryCatchBlocks.length === 0) {
    return null;
  }

  const block: TryCatchInfo = func.tryCatchBlocks[0];

  // Determine what the first external call inside the try block is
  const firstTryCall = func.externalCalls.find(
    (c) => c.isInsideTryCatch && c.line >= block.tryStartLine && c.line <= block.tryEndLine
  );
  const conditionCallDesc = firstTryCall
    ? `if ${firstTryCall.callee} throws`
    : 'if try block throws';

  const catchActions = describeCatchActions(block);
  const returnValue = resolveCatchReturnValue(block);
  const sideEffects = detectSideEffects(block.catchBody);

  const path: CodePath = {
    condition: conditionCallDesc,
    actions: catchActions,
    returnValue,
    sideEffects,
    canThrow: block.hasRethrow,
  };

  if (block.hasRethrow) {
    path.throwsWhat = 'caught error (re-thrown)';
  }

  return path;
}

function buildUnhandledErrorPath(func: FunctionNode): CodePath | null {
  const hasUnprotected = func.externalCalls.some((c) => !c.isInsideTryCatch);
  if (!hasUnprotected) {
    return null;
  }

  return {
    condition: 'if unprotected external call fails',
    actions: ['error propagates up the call stack'],
    returnValue: 'throws unhandled exception',
    sideEffects: [],
    canThrow: true,
    throwsWhat: 'unhandled exception',
  };
}

function fallbackHappyPath(): CodePath {
  return {
    condition: 'normal execution',
    actions: [],
    returnValue: 'undefined (implicit)',
    sideEffects: [],
    canThrow: false,
  };
}

// ─── Action description ───────────────────────────────────────────────────────

function describeActions(func: FunctionNode): string[] {
  const actions: string[] = [];

  for (const call of func.externalCalls) {
    const verb = call.isAwaited ? 'awaits' : 'calls';
    actions.push(`${verb} ${call.callee} (line ${call.line + 1})`);
  }

  const valueReturn = func.returnStatements.find(
    (r: ReturnInfo) => r.type === 'value' || r.type === 'promise'
  );
  if (valueReturn) {
    actions.push(`returns ${valueReturn.expression || 'value'}`);
  }

  return actions;
}

function describeCatchActions(block: TryCatchInfo): string[] {
  const actions: string[] = [];
  const body = block.catchBody;

  if (block.onlyLogs) {
    actions.push('logs error to console');
  } else {
    if (/console\.(log|error|warn|info|debug)/.test(body)) {
      actions.push('logs error to console');
    }
    if (block.hasRethrow) {
      actions.push('re-throws caught error');
    }
    if (block.hasReturn && !block.hasRethrow) {
      actions.push('returns fallback value');
    }
  }

  if (actions.length === 0) {
    actions.push('handles error silently');
  }

  return actions;
}

// ─── Return value resolution ──────────────────────────────────────────────────

function resolveHappyReturnValue(func: FunctionNode): string {
  if (func.returnStatements.length === 0) {
    return 'undefined (implicit)';
  }

  const valueReturn = func.returnStatements.find(
    (r: ReturnInfo) => r.type === 'value'
  );
  if (valueReturn) {
    return valueReturn.expression || 'value';
  }

  const promiseReturn = func.returnStatements.find(
    (r: ReturnInfo) => r.type === 'promise'
  );
  if (promiseReturn) {
    return promiseReturn.expression || 'Promise';
  }

  const voidReturn = func.returnStatements.find(
    (r: ReturnInfo) => r.type === 'void'
  );
  if (voidReturn) {
    return 'void';
  }

  return 'undefined (implicit)';
}

function resolveCatchReturnValue(block: TryCatchInfo): string {
  if (block.hasRethrow) {
    return 'throws (re-throws caught error)';
  }
  if (block.hasReturn) {
    return 'error response or fallback value';
  }
  if (block.onlyLogs) {
    return 'undefined (implicit) — error is swallowed after logging';
  }
  return 'undefined (implicit)';
}

// ─── Side-effect detection ────────────────────────────────────────────────────

function detectSideEffects(body: string): string[] {
  const effects = new Set<string>();

  if (/console\.(log|error|warn)/.test(body)) {
    effects.add('logs to console');
  }
  if (/res\.(json|send|status)/.test(body)) {
    effects.add('sends HTTP response');
  }
  if (/\.save\(\)|\.create\(|db\.query|db\.execute/.test(body)) {
    effects.add('writes to database');
  }
  if (/sendEmail|sendMail|nodemailer/.test(body)) {
    effects.add('sends email');
  }
  if (/redis\.set|cache\.set/.test(body)) {
    effects.add('writes to cache');
  }

  return Array.from(effects);
}

// ─── Throw analysis ───────────────────────────────────────────────────────────

function hasUncaughtThrow(func: FunctionNode): boolean {
  return func.throwStatements.some((t) => !t.isInsideTryCatch);
}

function resolveThrowsWhat(func: FunctionNode): string {
  const uncaught = func.throwStatements.find((t) => !t.isInsideTryCatch);
  if (!uncaught) {
    return 'Error';
  }

  // Try to extract the error class name from the expression
  const match = uncaught.expression.match(/new\s+(\w+Error|\w+Exception)/);
  if (match) {
    return match[1];
  }

  const simpleMatch = uncaught.expression.match(/^(\w+)$/);
  if (simpleMatch) {
    return simpleMatch[1];
  }

  return 'Error';
}
