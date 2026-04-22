import * as fs from 'fs';
import { OpenRouterClient } from '../llm/openRouterClient';
import { parseQuizQuestions } from '../llm/responseParser';
import { QUESTION_GENERATION_SYSTEM, buildQuestionPrompt } from '../llm/promptTemplates';
import type { QuizQuestion, CriticalPath, ProjectProfile } from '../types';
import { extractFunctionCode } from '../utils/codeChunker';

export class QuestionGenerator {
  constructor(private readonly client: OpenRouterClient) {}

  async generateQuestions(params: {
    apiKey: string;
    model: string;
    criticalPath: CriticalPath;
    profile: ProjectProfile;
    count: number;
    difficulty: number;
  }): Promise<QuizQuestion[]> {
    let content: string;
    try {
      content = fs.readFileSync(params.criticalPath.file, 'utf8');
    } catch {
      return [];
    }

    const lines = content.split('\n');
    const startLine = params.criticalPath.startLine ?? 1;
    const endLine = Math.min(startLine + 149, lines.length);
    const codeBlock = lines.slice(startLine - 1, endLine).join('\n');

    const prompt = buildQuestionPrompt({
      framework: params.profile.framework ?? 'unknown',
      language: params.profile.primaryLanguage,
      fileDescription: params.criticalPath.category,
      filePath: params.criticalPath.relativePath,
      startLine,
      codeBlock,
      relatedCode: '',
      count: params.count,
      difficulty: params.difficulty,
    });

    const response = await this.client.chatCompletion(
      [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM },
        { role: 'user', content: prompt },
      ],
      { apiKey: params.apiKey, model: params.model, temperature: 0.3, maxTokens: 3000 }
    );

    try {
      return parseQuizQuestions(response);
    } catch {
      // retry with simpler prompt
      const simplePrompt = `Generate ${params.count} multiple-choice quiz questions about this code. Return valid JSON with a "questions" array.\n\n\`\`\`${params.profile.primaryLanguage}\n${codeBlock.slice(0, 1000)}\n\`\`\``;
      const retry = await this.client.chatCompletion(
        [
          { role: 'system', content: QUESTION_GENERATION_SYSTEM },
          { role: 'user', content: simplePrompt },
        ],
        { apiKey: params.apiKey, model: params.model, temperature: 0.3, maxTokens: 2000 }
      );
      return parseQuizQuestions(retry);
    }
  }
}
