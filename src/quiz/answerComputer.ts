/**
 * answerComputer.ts
 *
 * Evaluates a user's answer to a quiz question WITHOUT calling an LLM.
 * The correct answer was already computed during question generation.
 */

import { GeneratedQuestion } from './questionTemplates';

// ─── Exported types ────────────────────────────────────────────────────────────

export interface LocalEvaluation {
  isCorrect: boolean;
  understandingDepth: 'surface' | 'moderate' | 'deep';
  feedback: string;
  conceptGap: string | null;
  source: 'static-analysis';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function evaluateAnswerLocally(
  question: GeneratedQuestion,
  selectedOption: 'A' | 'B' | 'C' | 'D'
): LocalEvaluation {
  const correctOption = question.options.find(o => o.isCorrect);
  const chosenOption = question.options.find(o => o.label === selectedOption);

  if (!correctOption || !chosenOption) {
    // Defensive fallback — should never happen with well-formed questions
    return {
      isCorrect: false,
      understandingDepth: 'surface',
      feedback: 'Unable to evaluate answer: question options are malformed.',
      conceptGap: null,
      source: 'static-analysis',
    };
  }

  const isCorrect = chosenOption.label === correctOption.label;

  if (isCorrect) {
    let understandingDepth: LocalEvaluation['understandingDepth'];
    if (question.difficulty >= 4) {
      understandingDepth = 'deep';
    } else if (question.difficulty >= 2) {
      understandingDepth = 'moderate';
    } else {
      understandingDepth = 'surface';
    }

    return {
      isCorrect: true,
      understandingDepth,
      feedback: `Correct! ${question.explanation}`,
      conceptGap: null,
      source: 'static-analysis',
    };
  }

  // Wrong answer
  const selectedText = chosenOption.text;
  const correctText = correctOption.text;
  const feedback =
    `Incorrect. You selected: "${selectedText}"\n\nThe correct answer is: "${correctText}"\n\n${question.explanation}`;

  return {
    isCorrect: false,
    understandingDepth: 'surface',
    feedback,
    conceptGap: determineConceptGap(question, selectedText),
    source: 'static-analysis',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function determineConceptGap(question: GeneratedQuestion, wrongAnswer: string): string {
  const lower = wrongAnswer.toLowerCase();

  if (lower.includes('express') && lower.includes('catch')) {
    return 'Misconception: Express does NOT automatically catch async errors in route handlers. You need explicit try-catch or an async wrapper middleware.';
  }

  if (lower.includes('typescript') && (lower.includes('prevent') || lower.includes('type system'))) {
    return 'Misconception: TypeScript types are erased at runtime. Type annotations don\'t prevent null/undefined at runtime.';
  }

  if (lower.includes('automatically') || lower.includes('retries')) {
    return 'Misconception: Most external API calls and database operations do NOT retry automatically.';
  }

  if (lower.includes('global') && lower.includes('handler')) {
    return 'Misconception: Global error handlers only catch errors that bubble up to them. Silent catches and unhandled Promise rejections may not reach the global handler.';
  }

  if (lower.includes('returns null') || lower.includes('returns undefined')) {
    return 'Misconception: Functions don\'t automatically return safe values on error. Without explicit error handling, errors throw.';
  }

  if (lower.includes('gitignore') || lower.includes('.gitignore')) {
    return 'Misconception: .gitignore only prevents files from being tracked, but hardcoded secrets in already-tracked files are still visible in git history.';
  }

  return `Review the code at ${question.codeReference.file}:${question.codeReference.startLine + 1} to understand the actual behavior.`;
}
