/**
 * questionTemplates.ts
 *
 * Template engine that converts detected anti-patterns into multiple-choice
 * quiz questions. Each PatternType has a dedicated template that extracts
 * evidence fields to produce a contextual question with realistic distractors.
 */

import {
  DetectedPattern,
  PatternType,
  MissingErrorHandlingEvidence,
  SilentCatchEvidence,
  UncheckedParameterEvidence,
  UnhandledAsyncEvidence,
  InconsistentReturnEvidence,
  SqlInjectionEvidence,
  HardcodedSecretEvidence,
  MissingAwaitEvidence,
  DeadCodeEvidence,
} from '../analyzer/patternDetector';
import { CodePath } from '../analyzer/codePathTracer';

// ─── Exported types ───────────────────────────────────────────────────────────

export interface GeneratedQuestion {
  id: string;
  question: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: 'error-handling' | 'security' | 'data-flow' | 'edge-case' | 'architecture' | 'performance';
  codeReference: {
    file: string;
    startLine: number;
    endLine: number;
  };
  options: Array<{
    label: 'A' | 'B' | 'C' | 'D';
    text: string;
    isCorrect: boolean;
  }>;
  explanation: string;
  dangerNote: string;
  source: 'static-analysis';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Shuffle the 4 options so the correct answer isn't always in position A, then
 *  re-assign labels A/B/C/D in the new order. */
function shuffleOptions(
  options: GeneratedQuestion['options']
): GeneratedQuestion['options'] {
  const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const copy = [...options];

  // Fisher-Yates shuffle
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.map((opt, idx) => ({ ...opt, label: labels[idx] }));
}

/** Map pattern severity to difficulty 1-5. */
function severityToDifficulty(severity: DetectedPattern['severity']): 1 | 2 | 3 | 4 | 5 {
  switch (severity) {
    case 'critical': return 4;
    case 'high':     return 3;
    case 'medium':   return 2;
    case 'low':      return 1;
  }
}

/** Build the unique question id. */
function makeId(pattern: DetectedPattern, variant = 0): string {
  const base = `${pattern.type}-${pattern.file.replace(/[^a-zA-Z0-9]/g, '_')}-${pattern.line}`;
  return variant === 0 ? base : `${base}-v${variant}`;
}

/** Build the 4 options from a correct answer and three wrong answers, then shuffle. */
function buildOptions(
  correct: string,
  wrong: [string, string, string]
): GeneratedQuestion['options'] {
  const raw: GeneratedQuestion['options'] = [
    { label: 'A', text: correct, isCorrect: true },
    { label: 'B', text: wrong[0], isCorrect: false },
    { label: 'C', text: wrong[1], isCorrect: false },
    { label: 'D', text: wrong[2], isCorrect: false },
  ];
  return shuffleOptions(raw);
}

// ─── Template map ─────────────────────────────────────────────────────────────

export const QUESTION_TEMPLATES: Partial<Record<PatternType, (pattern: DetectedPattern, paths?: CodePath[]) => GeneratedQuestion>> = {

  MISSING_ERROR_HANDLING(pattern) {
    const ev = pattern.evidence as MissingErrorHandlingEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const line = pattern.line;
    const callee = ev.externalCall;

    const question =
      `In function "${func}" (${file}:${line + 1}), \`${callee}\` is called without try-catch. ` +
      `What happens if this call fails at runtime?`;

    const wrong = pattern.incorrectAssumptions.slice(0, 3) as [string, string, string];
    const options = buildOptions(pattern.correctBehavior, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  SILENT_CATCH(pattern) {
    const ev = pattern.evidence as SilentCatchEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const catchStartLine = ev.catchStartLine;

    const question =
      `Function "${func}" (${file}) has a catch block at line ${catchStartLine + 1} that catches an error. ` +
      `What does the calling code receive when the operation fails?`;

    const correct =
      'No indication of failure — the function continues normally and returns undefined because the catch block only logs the error';
    const wrong = pattern.incorrectAssumptions.slice(0, 3) as [string, string, string];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  UNCHECKED_PARAMETER(pattern) {
    const ev = pattern.evidence as UncheckedParameterEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const paramName = ev.parameterName;

    const question =
      `Function "${func}" in ${file} accepts parameter "${paramName}" with no null/undefined check. ` +
      `What happens if this function is called with ${paramName} = undefined?`;

    const correct =
      'A TypeError is thrown when the code tries to access a property or call a method on undefined';
    const wrong = pattern.incorrectAssumptions.slice(0, 3) as [string, string, string];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  UNHANDLED_ASYNC(pattern) {
    const ev = pattern.evidence as UnhandledAsyncEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const line = ev.callLine;

    const question =
      `In function "${func}" (${file}:${line + 1}), there is an await call not wrapped in try-catch. ` +
      `What happens if the awaited Promise rejects?`;

    const wrong = pattern.incorrectAssumptions.slice(0, 3) as [string, string, string];
    const options = buildOptions(pattern.correctBehavior, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  INCONSISTENT_RETURN_TYPE(pattern) {
    // InconsistentReturnEvidence is not directly needed for this template
    const _ev = pattern.evidence as InconsistentReturnEvidence;
    const func = pattern.functionName;
    const file = pattern.file;

    const question =
      `Function "${func}" in ${file} returns different types from different branches. ` +
      `What must callers do to avoid a TypeError?`;

    const correct = 'Check the return value for null/undefined before accessing properties on it';
    const wrong: [string, string, string] = [
      'Call the function normally — TypeScript ensures it always returns the same type',
      'Wrap the call in try-catch to handle null returns',
      'The function always returns the same type — the inconsistency only appears in test scenarios',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  SQL_INJECTION_RISK(pattern) {
    const ev = pattern.evidence as SqlInjectionEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const queryLine = ev.queryLine;
    const concatenatedVariable = ev.concatenatedVariable;

    const question =
      `Function "${func}" (${file}:${queryLine + 1}) constructs a SQL query using ${concatenatedVariable}. ` +
      `What security vulnerability does this introduce?`;

    const correct =
      `SQL injection — an attacker can manipulate ${concatenatedVariable} to execute arbitrary SQL commands`;
    const wrong: [string, string, string] = [
      'A syntax error that causes the query to fail',
      'A performance issue from string concatenation in queries',
      'A race condition when multiple queries run simultaneously',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  HARDCODED_SECRET(pattern) {
    const ev = pattern.evidence as HardcodedSecretEvidence;
    const file = pattern.file;
    const secretType = ev.secretType;
    const line = ev.line;
    const partialValue = ev.partialValue;

    const question =
      `A ${secretType} appears to be hardcoded in ${file} on line ${line + 1} ` +
      `(value starts with "${partialValue}"). What is the security risk?`;

    const correct =
      'If this file is committed to a repository or the system is compromised, the credential is permanently exposed and must be rotated';
    const wrong: [string, string, string] = [
      'The .gitignore file prevents this value from being committed',
      'Hardcoded values are safe as long as the repository is private',
      'The value is obfuscated by the TypeScript compiler',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  MISSING_INPUT_VALIDATION(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;

    const question =
      `Function "${func}" in ${file} uses req.body/params/query data without validation. What is the risk?`;

    const correct =
      'Attackers can send unexpected types, missing fields, or malicious data that reaches business logic unchecked';
    const wrong: [string, string, string] = [
      'TypeScript interfaces validate request bodies at runtime',
      'Express automatically rejects malformed request bodies',
      'The database constraints prevent invalid data from being saved',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  ERROR_SWALLOWING(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;

    const question =
      `Function "${func}" (${file}) has an empty or comment-only catch block. ` +
      `What happens when the try block throws?`;

    const correct =
      'The error is completely silenced — nothing is logged, returned, or re-thrown. The operation fails invisibly.';
    const wrong: [string, string, string] = [
      'The error is automatically logged by Node.js',
      'The catch block re-throws the error to the calling function',
      'A default error response is returned to the client',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  EXPOSED_INTERNAL_ERROR(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;

    const question =
      `Function "${func}" (${file}) sends error details (err.message or err.stack) directly in the HTTP response. ` +
      `What is the security risk?`;

    const correct =
      "Stack traces and internal implementation details are leaked to clients, giving attackers information about the system's internals";
    const wrong: [string, string, string] = [
      'Sending err.message helps clients debug the issue on their end',
      'Only developers make requests that would trigger this error path',
      'Error messages are automatically sanitized by Express before sending',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  DEAD_CODE_AFTER_RETURN(pattern) {
    const ev = pattern.evidence as DeadCodeEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const unreachableLine = ev.unreachableLine;

    const question =
      `In function "${func}" (${file}:${unreachableLine + 1}), there is code that can never execute. ` +
      `Why is it unreachable?`;

    const wrong: [string, string, string] = [
      'The code is a fallback that runs when an exception is caught',
      'The code executes when a flag variable is set',
      'The code is called by a different execution path',
    ];
    const options = buildOptions(pattern.correctBehavior, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },

  MISSING_AWAIT(pattern) {
    const ev = pattern.evidence as MissingAwaitEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const callLine = ev.callLine;
    const asyncCall = ev.asyncCall;

    const question =
      `In function "${func}" (${file}:${callLine + 1}), \`${asyncCall}\` is called without \`await\`. ` +
      `What does the variable hold?`;

    const correct =
      'An unresolved Promise object — not the actual result. Any property access on it will be undefined.';
    const wrong: [string, string, string] = [
      'The resolved value, because JavaScript auto-awaits in async functions',
      "null, because the Promise hasn't resolved yet",
      'The same result as if await were used — they\'re equivalent here',
    ];
    const options = buildOptions(correct, wrong);

    return {
      id: makeId(pattern),
      question,
      difficulty: severityToDifficulty(pattern.severity),
      category: pattern.category,
      codeReference: {
        file: pattern.file,
        startLine: pattern.line,
        endLine: pattern.endLine ?? pattern.line + 5,
      },
      options,
      explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
      dangerNote: pattern.consequence,
      source: 'static-analysis',
    };
  },
};

// ─── Variant 1 templates (fix-angle) ─────────────────────────────────────────

export const QUESTION_TEMPLATES_V1: Partial<Record<PatternType, (pattern: DetectedPattern) => GeneratedQuestion>> = {

  MISSING_ERROR_HANDLING(pattern) {
    const ev = pattern.evidence as MissingErrorHandlingEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const callee = ev.externalCall;
    const question = `Function "${func}" (${file}) calls \`${callee}\` without error handling. What is the correct fix?`;
    const options = buildOptions(
      'Wrap the call in a try-catch block and handle or re-throw the error explicitly',
      [
        'Add a .then() handler that returns null on failure',
        'Use a global error handler — individual functions do not need try-catch',
        'Call the function synchronously so errors are thrown immediately',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  SILENT_CATCH(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) has a silent catch block. What should replace it?`;
    const options = buildOptions(
      'Log the error and either re-throw it or return a typed error value so callers know the operation failed',
      [
        'Remove the try-catch entirely — errors will bubble up automatically',
        'Add a finally block to clean up resources',
        'Catch only specific error types and ignore the rest',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  UNCHECKED_PARAMETER(pattern) {
    const ev = pattern.evidence as UncheckedParameterEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const paramName = ev.parameterName;
    const question = `Function "${func}" (${file}) uses "${paramName}" without a null check. What is the safest fix?`;
    const options = buildOptions(
      `Add a guard at the top: \`if (!${paramName}) return;\` or throw a descriptive error before using it`,
      [
        `Use optional chaining (${paramName}?.property) everywhere — no guard needed`,
        'Add a TypeScript type annotation — it prevents undefined at compile time',
        'Set a default value in the function signature using a fallback expression',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  UNHANDLED_ASYNC(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) has an unhandled async call. What is the correct pattern?`;
    const options = buildOptions(
      'Wrap the await in a try-catch block, or use .catch() on the returned Promise',
      [
        'Add async/await at the call site — Promise rejections handle themselves',
        'Use Promise.allSettled() so rejected promises do not throw',
        'Wrap the entire function body in a single try-catch at the module level',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  SQL_INJECTION_RISK(pattern) {
    const ev = pattern.evidence as SqlInjectionEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const concatenatedVariable = ev.concatenatedVariable;
    const question = `Function "${func}" (${file}) builds a SQL query with string concatenation of ${concatenatedVariable}. How do you fix it?`;
    const options = buildOptions(
      'Use parameterized queries or a prepared statement — pass user input as a separate parameter, never concatenated into the SQL string',
      [
        `Sanitize ${concatenatedVariable} with a regex before concatenating`,
        'Wrap the query in a try-catch — SQL errors will be caught before they cause harm',
        'Use an ORM — all ORMs automatically prevent SQL injection',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  HARDCODED_SECRET(pattern) {
    const file = pattern.file;
    const question = `A secret is hardcoded in ${file}. What is the correct remediation?`;
    const options = buildOptions(
      'Move the value to an environment variable, load it with process.env, and rotate the leaked credential immediately',
      [
        'Encrypt the value in the source file using a build-time script',
        'Move it to a config file that is listed in .gitignore',
        'Prefix the variable with _ to mark it as private — bundlers will strip it',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  MISSING_INPUT_VALIDATION(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) uses raw request data without validation. Which approach best fixes this?`;
    const options = buildOptions(
      'Validate and sanitize all incoming fields with a schema validator (e.g. Zod, Joi) before any business logic runs',
      [
        'Add TypeScript types to the req.body — this validates shape at runtime',
        'Trust the database constraints to reject invalid data',
        'Only validate fields that go into SQL queries — other fields are low risk',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  ERROR_SWALLOWING(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) has an empty catch block. What should be done?`;
    const options = buildOptions(
      'At minimum log the error with context; ideally re-throw or return an error value so callers can react',
      [
        'Empty catch blocks are acceptable for cleanup code that should never fail',
        'Add a comment inside the catch block to document why the error is ignored',
        'Replace try-catch with a Promise chain — .catch() handles errors differently',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  EXPOSED_INTERNAL_ERROR(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) sends err.message/err.stack to the client. How should errors be returned instead?`;
    const options = buildOptions(
      'Return a generic error message to the client and log the full error server-side with a correlation ID for debugging',
      [
        'Stringify the error object before sending — this hides the stack trace',
        'Only send err.message, never err.stack — message is safe to expose',
        'Wrap the response in a try-catch so the error cannot reach the client',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  DEAD_CODE_AFTER_RETURN(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) has unreachable code after a return statement. What is the correct action?`;
    const options = buildOptions(
      'Delete the unreachable code, or move the return statement to after the code that should execute',
      [
        'Wrap the unreachable code in an if-block so it can be toggled',
        'Add a comment marking it as intentionally unreachable for documentation',
        'Move it to a finally block — finally always runs regardless of return',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  MISSING_AWAIT(pattern) {
    const ev = pattern.evidence as MissingAwaitEvidence;
    const func = pattern.functionName;
    const file = pattern.file;
    const asyncCall = ev.asyncCall;
    const question = `Function "${func}" (${file}) calls \`${asyncCall}\` without await. How do you fix it?`;
    const options = buildOptions(
      `Add \`await\` before \`${asyncCall}\` to get the resolved value, and ensure the containing function is marked async`,
      [
        `Assign the result to a variable first — JavaScript resolves it automatically on assignment`,
        `Use .then() on \`${asyncCall}\` — this is equivalent to await and resolves the value immediately`,
        `Call \`Promise.resolve(${asyncCall})\` to unwrap the Promise`,
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },

  INCONSISTENT_RETURN_TYPE(pattern) {
    const func = pattern.functionName;
    const file = pattern.file;
    const question = `Function "${func}" (${file}) returns inconsistent types. What is the correct fix?`;
    const options = buildOptions(
      'Unify the return type — always return the same shape (use null/undefined explicitly instead of implicit undefined from missing returns)',
      [
        'Add overloads so TypeScript knows all possible return types',
        'Use a union return type annotation — TypeScript will handle the rest',
        'Ensure all code paths return early — the last branch can remain implicit',
      ]
    );
    return { id: makeId(pattern, 1), question, difficulty: severityToDifficulty(pattern.severity), category: pattern.category, codeReference: { file: pattern.file, startLine: pattern.line, endLine: pattern.endLine ?? pattern.line + 5 }, options, explanation: pattern.correctBehavior, dangerNote: pattern.consequence, source: 'static-analysis' };
  },
};

// ─── Fallback template ────────────────────────────────────────────────────────

function generateFallbackQuestion(pattern: DetectedPattern): GeneratedQuestion {
  const question =
    `In function "${pattern.functionName}" (${pattern.file}:${pattern.line + 1}): ${pattern.description} ` +
    `What is the impact of this issue?`;

  const wrong = pattern.incorrectAssumptions.slice(0, 3) as [string, string, string];
  const options = buildOptions(pattern.correctBehavior, wrong);

  return {
    id: makeId(pattern),
    question,
    difficulty: severityToDifficulty(pattern.severity),
    category: pattern.category,
    codeReference: {
      file: pattern.file,
      startLine: pattern.line,
      endLine: pattern.endLine ?? pattern.line + 5,
    },
    options,
    explanation: `${pattern.correctBehavior}\n\n${pattern.consequence}`,
    dangerNote: pattern.consequence,
    source: 'static-analysis',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert a detected anti-pattern into a multiple-choice quiz question.
 * Uses the dedicated template for the pattern type when available, otherwise
 * falls back to a generic template.
 *
 * @throws {Error} if the pattern object is missing required fields.
 */
export function generateQuestionFromPattern(
  pattern: DetectedPattern,
  paths?: CodePath[],
  variant = 0
): GeneratedQuestion {
  try {
    if (!pattern || !pattern.type) {
      throw new Error('generateQuestionFromPattern: pattern is missing required "type" field');
    }
    if (!pattern.file) {
      throw new Error(`generateQuestionFromPattern: pattern of type "${pattern.type}" is missing required "file" field`);
    }
    if (!pattern.functionName) {
      throw new Error(`generateQuestionFromPattern: pattern of type "${pattern.type}" is missing required "functionName" field`);
    }

    if (variant === 1) {
      const v1Fn = QUESTION_TEMPLATES_V1[pattern.type];
      if (v1Fn) { return v1Fn(pattern); }
    }

    const templateFn = QUESTION_TEMPLATES[pattern.type];
    if (templateFn) { return templateFn(pattern, paths); }

    return generateFallbackQuestion(pattern);
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `generateQuestionFromPattern failed for pattern type "${pattern?.type ?? 'unknown'}" ` +
        `in file "${pattern?.file ?? 'unknown'}": ${err.message}`
      );
    }
    throw err;
  }
}

/** All variants (0 + 1) for a pattern, skipping any that fail. */
export function generateAllVariants(pattern: DetectedPattern, paths?: CodePath[]): GeneratedQuestion[] {
  const out: GeneratedQuestion[] = [];
  for (const v of [0, 1]) {
    try {
      out.push(generateQuestionFromPattern(pattern, paths, v));
    } catch {
      // variant not available for this pattern
    }
  }
  return out;
}
