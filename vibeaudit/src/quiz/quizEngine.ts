import * as vscode from 'vscode';
import { QuestionGenerator } from './questionGenerator';
import { AnswerEvaluator } from './answerEvaluator';
import { DifficultyManager } from './difficultyManager';
import { SessionManager } from './sessionManager';
import { OpenRouterClient } from '../llm/openRouterClient';
import { StateManager } from '../storage/stateManager';
import { ApiKeyManager } from '../storage/apiKeyManager';
import { generateLocalQuestions } from './localQuestionGenerator';
import type { QuizQuestion, QuizAnswer, QuizSession, CriticalPath } from '../types';

export class QuizEngine {
  private readonly generator: QuestionGenerator;
  private readonly evaluator: AnswerEvaluator;
  private readonly difficulty = new DifficultyManager();
  private readonly sessions = new SessionManager();

  constructor(
    private readonly stateManager: StateManager,
    private readonly apiKeyManager: ApiKeyManager,
    private readonly context: vscode.ExtensionContext
  ) {
    const client = new OpenRouterClient();
    this.generator = new QuestionGenerator(client);
    this.evaluator = new AnswerEvaluator(client);
  }

  async startSession(focusArea?: string, pinnedFiles?: string[]): Promise<QuizSession | null> {
    const analysis = this.stateManager.getAnalysis();
    if (!analysis || analysis.criticalPaths.length === 0) {
      vscode.window.showWarningMessage('No workspace analysis found. Run "VibeAudit: Scan Workspace" first.');
      return null;
    }

    const config = vscode.workspace.getConfiguration('vibeaudit');
    const questionCount = config.get<number>('questionsPerSession', 10);

    const report = this.stateManager.getReport();
    const candidates = this.prioritizeCriticalPaths(analysis.criticalPaths, report?.fileScores ?? [], focusArea, pinnedFiles);

    if (candidates.length === 0) {
      vscode.window.showWarningMessage('No critical paths found to quiz on.');
      return null;
    }

    const session = this.sessions.startSession(questionCount, focusArea);
    const override = config.get<number>('difficultyOverride', 0);
    let difficulty: number;
    if (override > 0) {
      this.difficulty.setDifficulty(override);
      difficulty = override;
    } else {
      const items: (vscode.QuickPickItem & { value: number })[] = [
        { label: 'Adaptive', description: 'Adjusts based on your answers', value: 0 },
        { label: 'Easy (1)', description: 'Beginner questions', value: 1 },
        { label: 'Normal (3)', description: 'Balanced difficulty', value: 3 },
        { label: 'Hard (5)', description: 'Advanced edge cases', value: 5 },
      ];
      const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select difficulty' }) as (vscode.QuickPickItem & { value: number }) | undefined;
      if (!pick) { return null; }
      if (pick.value === 0) {
        this.difficulty.reset();
        difficulty = this.difficulty.getDifficulty();
      } else {
        this.difficulty.setDifficulty(pick.value);
        difficulty = pick.value;
      }
    }

    // Build LocalFile list from critical paths
    const localFiles = this.buildLocalFiles(candidates);

    // PRIMARY: local static analysis — always works, no API key needed
    let questions: QuizQuestion[] = [];
    try {
      const generated = generateLocalQuestions(localFiles, {
        maxQuestions: questionCount,
        difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
        focusFiles: pinnedFiles,
      });
      questions = generated.map(q => this.toQuizQuestion(q));
    } catch (err) {
      console.error('Local question generation failed:', err);
    }

    // OPTIONAL: LLM fallback if no local questions generated and API key exists
    if (questions.length === 0) {
      const apiKey = await this.apiKeyManager.getApiKey();
      if (apiKey) {
        const model = config.get<string>('llmModel', 'deepseek/deepseek-chat-v3-0324:free');
        for (const candidate of candidates) {
          if (questions.length >= questionCount) { break; }
          try {
            const qs = await this.generator.generateQuestions({
              apiKey, model,
              criticalPath: candidate,
              profile: analysis.projectProfile,
              count: Math.min(3, questionCount - questions.length),
              difficulty: this.difficulty.getDifficulty(),
            });
            questions.push(...qs);
          } catch (err) {
            console.error('LLM question generation failed:', err);
          }
        }
      } else {
        vscode.window.showInformationMessage(
          'VibeAudit: No patterns detected in selected files. Add an OpenRouter API key for AI-generated questions.',
          'Add API Key'
        ).then(choice => {
          if (choice === 'Add API Key') {
            vscode.commands.executeCommand('vibeaudit.setApiKey');
          }
        });
      }
    }

    session.questions = questions.slice(0, questionCount);
    session.totalQuestions = session.questions.length;
    return session;
  }

  private buildLocalFiles(candidates: CriticalPath[]): import('./localQuestionGenerator').LocalFile[] {
    const fs = require('fs') as typeof import('fs');
    const seen = new Set<string>();
    const files: import('./localQuestionGenerator').LocalFile[] = [];
    for (const c of candidates) {
      if (seen.has(c.file)) { continue; }
      seen.add(c.file);
      try {
        const content = fs.readFileSync(c.file, 'utf8');
        const lang = c.file.endsWith('.py') ? 'python' : c.file.endsWith('.js') ? 'javascript' : 'typescript';
        files.push({ path: c.file, content, language: lang });
      } catch {
        // skip unreadable files
      }
    }
    return files;
  }

  private toQuizQuestion(q: import('./questionTemplates').GeneratedQuestion): QuizQuestion {
    return {
      id: q.id,
      question: q.question,
      difficulty: q.difficulty,
      category: q.category,
      codeReference: q.codeReference,
      options: q.options.map(o => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
      explanation: q.explanation,
      dangerNote: q.dangerNote,
    };
  }

  async submitAnswer(
    session: QuizSession,
    question: QuizQuestion,
    selectedLabel: string
  ): Promise<QuizAnswer> {
    const apiKey = await this.apiKeyManager.getApiKey() ?? '';
    const config = vscode.workspace.getConfiguration('vibeaudit');
    const model = config.get<string>('llmModel', 'deepseek/deepseek-chat-v3-0324:free');
    const analysis = this.stateManager.getAnalysis();

    let evaluation: import('../types').AnswerEvaluation = { isCorrect: false, understandingDepth: 'surface', feedback: '', conceptGap: null };

    try {
      evaluation = await this.evaluator.evaluate({
        apiKey,
        model,
        question,
        selectedLabel,
        language: analysis?.projectProfile.primaryLanguage ?? 'typescript',
      });
    } catch {
      const correct = question.options.find(o => o.isCorrect);
      evaluation.isCorrect = correct?.label === selectedLabel;
      evaluation.feedback = evaluation.isCorrect ? 'Correct!' : `The correct answer was: ${correct?.text}`;
    }

    this.difficulty.recordAnswer(evaluation.isCorrect);

    const answer: QuizAnswer = {
      questionId: question.id,
      selectedLabel,
      isCorrect: evaluation.isCorrect,
      understandingDepth: evaluation.understandingDepth,
      feedback: evaluation.feedback,
      conceptGap: evaluation.conceptGap,
      timestamp: Date.now(),
    };

    session.answers.push(answer);
    return answer;
  }

  async endSession(session: QuizSession): Promise<QuizSession> {
    const ended = this.sessions.endSession() ?? session;
    ended.answers = session.answers;
    const correct = ended.answers.filter(a => a.isCorrect).length;
    ended.score = ended.answers.length > 0 ? Math.round((correct / ended.answers.length) * 100) : 0;
    await this.stateManager.saveSession(ended);
    return ended;
  }

  private prioritizeCriticalPaths(
    paths: CriticalPath[],
    fileScores: { file: string; score: number }[],
    focusArea?: string,
    pinnedFiles?: string[]
  ): CriticalPath[] {
    let filtered = paths;
    if (pinnedFiles && pinnedFiles.length > 0) {
      filtered = paths.filter(p => pinnedFiles.includes(p.file));
    } else if (focusArea) {
      filtered = paths.filter(p => p.category === focusArea || p.relativePath.includes(focusArea));
    }
    return filtered.sort((a, b) => {
      const scoreA = fileScores.find(s => s.file === a.relativePath)?.score ?? 100;
      const scoreB = fileScores.find(s => s.file === b.relativePath)?.score ?? 100;
      const priorityA = a.riskLevel * (1 - scoreA / 100);
      const priorityB = b.riskLevel * (1 - scoreB / 100);
      return priorityB - priorityA;
    });
  }
}
