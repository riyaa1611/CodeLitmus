import type { QuizSession } from '../types';

export class SessionManager {
  private currentSession: QuizSession | null = null;

  startSession(totalQuestions: number, focusArea?: string): QuizSession {
    this.currentSession = {
      id: `session_${Date.now()}`,
      startTime: Date.now(),
      questions: [],
      answers: [],
      score: 0,
      totalQuestions,
      focusArea,
      difficulty: 3,
    };
    return this.currentSession;
  }

  getSession(): QuizSession | null {
    return this.currentSession;
  }

  endSession(): QuizSession | null {
    if (!this.currentSession) { return null; }
    this.currentSession.endTime = Date.now();
    const correct = this.currentSession.answers.filter(a => a.isCorrect).length;
    this.currentSession.score = this.currentSession.answers.length > 0
      ? Math.round((correct / this.currentSession.answers.length) * 100)
      : 0;
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }
}
