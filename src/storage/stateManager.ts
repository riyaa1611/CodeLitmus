import * as vscode from 'vscode';
import type { WorkspaceAnalysis, QuizSession, ScoreReport, PinnedFile, TeamExport } from '../types';

const KEYS = {
  initialized: 'codelitmus.initialized',
  analysis: 'codelitmus.workspaceAnalysis',
  sessions: 'codelitmus.quizSessions',
  report: 'codelitmus.scoreReport',
  pinnedFiles: 'codelitmus.pinnedFiles',
  shownQuestions: 'codelitmus.shownQuestions',
} as const;

export class StateManager {
  constructor(private readonly state: vscode.Memento) {}

  isInitialized(): boolean {
    return this.state.get<boolean>(KEYS.initialized, false);
  }

  async setInitialized(): Promise<void> {
    await this.state.update(KEYS.initialized, true);
  }

  getAnalysis(): WorkspaceAnalysis | undefined {
    return this.state.get<WorkspaceAnalysis>(KEYS.analysis);
  }

  async saveAnalysis(analysis: WorkspaceAnalysis): Promise<void> {
    await this.state.update(KEYS.analysis, analysis);
  }

  getSessions(): QuizSession[] {
    return this.state.get<QuizSession[]>(KEYS.sessions, []);
  }

  async saveSession(session: QuizSession): Promise<void> {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.push(session);
    }
    await this.state.update(KEYS.sessions, sessions);
  }

  getReport(): ScoreReport | undefined {
    return this.state.get<ScoreReport>(KEYS.report);
  }

  async saveReport(report: ScoreReport): Promise<void> {
    await this.state.update(KEYS.report, report);
  }

  getPinnedFiles(): PinnedFile[] {
    return this.state.get<PinnedFile[]>(KEYS.pinnedFiles, []);
  }

  async setPinnedFiles(files: PinnedFile[]): Promise<void> {
    await this.state.update(KEYS.pinnedFiles, files);
  }

  exportState(): TeamExport | null {
    const report = this.getReport();
    if (!report) { return null; }
    return {
      exportedBy: '',
      exportedAt: Date.now(),
      overallScore: report.overallScore,
      fileScores: report.fileScores,
      categoryScores: report.categoryScores,
      sessionCount: this.getSessions().length,
    };
  }

  getShownQuestionIds(): Set<string> {
    return new Set(this.state.get<string[]>(KEYS.shownQuestions, []));
  }

  async markQuestionsShown(ids: string[]): Promise<void> {
    const existing = this.state.get<string[]>(KEYS.shownQuestions, []);
    const merged = Array.from(new Set([...existing, ...ids]));
    await this.state.update(KEYS.shownQuestions, merged);
  }

  async resetShownQuestions(): Promise<void> {
    await this.state.update(KEYS.shownQuestions, undefined);
  }

  async resetAll(): Promise<void> {
    await this.state.update(KEYS.initialized, undefined);
    await this.state.update(KEYS.analysis, undefined);
    await this.state.update(KEYS.sessions, undefined);
    await this.state.update(KEYS.report, undefined);
    await this.state.update(KEYS.pinnedFiles, undefined);
    await this.state.update(KEYS.shownQuestions, undefined);
  }
}
