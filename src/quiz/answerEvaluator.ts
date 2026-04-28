import type { QuizQuestion, AnswerEvaluation } from '../types';

export class AnswerEvaluator {
  evaluate(question: QuizQuestion, selectedLabel: string): AnswerEvaluation {
    const correct = question.options.find(o => o.isCorrect);
    const selected = question.options.find(o => o.label === selectedLabel);

    if (!correct || !selected) {
      return { isCorrect: false, understandingDepth: 'surface', feedback: 'Could not evaluate answer.', conceptGap: null };
    }

    const isCorrect = selected.label === correct.label;
    return {
      isCorrect,
      understandingDepth: isCorrect ? 'moderate' : 'surface',
      feedback: isCorrect
        ? `Correct! ${question.explanation}`
        : `Incorrect. The correct answer was: "${correct.text}"\n\n${question.explanation}`,
      conceptGap: isCorrect ? null : `Review the code at ${question.codeReference.file}:${question.codeReference.startLine + 1}`,
    };
  }
}
