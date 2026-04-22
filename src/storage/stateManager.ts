import * as vscode from 'vscode';
import type { WorkspaceAnalysis, QuizSession, ScoreReport, PinnedFile, TeamExport } from '../types';

const KEYS = {
  initialized: 'vibeaudit.initialized',
  analysis: 'vibeaudit.workspaceAnalysis',
  sessions: 'vibeaudit.quizSessions',
  report: 'vibeaudit.scoreReport',
  pinnedFiles: 'vibeaudit.pinnedFiles',
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

  async resetAll(): Promise<void> {
    await this.state.update(KEYS.initialized, undefined);
    await this.state.update(KEYS.analysis, undefined);
    await this.state.update(KEYS.sessions, undefined);
    await this.state.update(KEYS.report, undefined);
    await this.state.update(KEYS.pinnedFiles, undefined);
  }
}
