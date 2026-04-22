import * as fs from 'fs';
import { OpenRouterClient } from '../llm/openRouterClient';
import { parseAnswerEvaluation } from '../llm/responseParser';
import { buildAnswerEvalPrompt } from '../llm/promptTemplates';
import type { QuizQuestion, AnswerEvaluation } from '../types';

export class AnswerEvaluator {
  constructor(private readonly client: OpenRouterClient) {}

  async evaluate(params: {
    apiKey: string;
    model: string;
    question: QuizQuestion;
    selectedLabel: string;
    language: string;
  }): Promise<AnswerEvaluation> {
    const correct = params.question.options.find(o => o.isCorrect);
    const selected = params.question.options.find(o => o.label === params.selectedLabel);

    if (!correct || !selected) {
      return {
        isCorrect: false,
        understandingDepth: 'surface',
        feedback: 'Could not evaluate answer.',
        conceptGap: null,
      };
    }

    // If no API key provided, use local (deterministic) evaluation
    if (!params.apiKey || params.apiKey.trim() === '') {
      const isCorrect = selected.label === correct.label;
      return {
        isCorrect,
        understandingDepth: isCorrect ? 'moderate' : 'surface',
        feedback: isCorrect
          ? `Correct! ${params.question.explanation}`
          : `Incorrect. The correct answer was: "${correct.text}"\n\n${params.question.explanation}`,
        conceptGap: isCorrect ? null : `Review the code at ${params.question.codeReference.file}:${params.question.codeReference.startLine + 1}`,
      };
    }

    let code = '';
    try {
      code = fs.readFileSync(params.question.codeReference.file, 'utf8')
        .split('\n')
        .slice(
          Math.max(0, params.question.codeReference.startLine - 1),
          params.question.codeReference.endLine
        )
        .join('\n');
    } catch {
      code = '';
    }

    const isCorrect = selected.label === correct.label;

    const prompt = buildAnswerEvalPrompt({
      question: params.question.question,
      code,
      language: params.language,
      userAnswer: selected.text,
      correctAnswer: correct.text,
      wasCorrect: isCorrect,
    });

    const response = await this.client.chatCompletion(
      [{ role: 'user', content: prompt }],
      { apiKey: params.apiKey, model: params.model, temperature: 0.1, maxTokens: 500 }
    );

    const eval_ = parseAnswerEvaluation(response);
    return { ...eval_, isCorrect };
  }
}
