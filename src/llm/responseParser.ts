import type { QuizQuestion, AnswerEvaluation } from '../types';

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
}

export function parseJson<T>(text: string): T {
  const cleaned = stripCodeFences(text);
  return JSON.parse(cleaned) as T;
}

export function parseQuizQuestions(text: string): QuizQuestion[] {
  const data = parseJson<{ questions?: unknown[] }>(text);
  if (!data.questions || !Array.isArray(data.questions)) {
    throw new Error('Response missing "questions" array');
  }

  return data.questions.map((q: unknown, i: number) => {
    const item = q as Record<string, unknown>;
    if (!item.id || !item.question || !Array.isArray(item.options)) {
      throw new Error(`Question ${i} missing required fields`);
    }
    const options = item.options as Array<Record<string, unknown>>;
    const correctCount = options.filter(o => o.isCorrect === true).length;
    if (correctCount !== 1) {
      throw new Error(`Question ${i} must have exactly 1 correct option, found ${correctCount}`);
    }
    return item as unknown as QuizQuestion;
  });
}

export function parseAnswerEvaluation(text: string): AnswerEvaluation {
  const data = parseJson<AnswerEvaluation>(text);
  if (!data.feedback) {
    throw new Error('Response missing "feedback"');
  }
  return {
    isCorrect: false,
    understandingDepth: data.understandingDepth ?? 'surface',
    feedback: data.feedback,
    conceptGap: data.conceptGap ?? null,
  };
}
