import type { QuizSession } from '../types';

export interface ProgressPoint {
  timestamp: number;
  score: number;
  sessionId: string;
}

export function buildProgressTimeline(sessions: QuizSession[]): ProgressPoint[] {
  return sessions
    .filter(s => s.endTime !== undefined)
    .sort((a, b) => (a.endTime ?? 0) - (b.endTime ?? 0))
    .map(s => ({
      timestamp: s.endTime!,
      score: s.score,
      sessionId: s.id,
    }));
}

export function calculateTrend(timeline: ProgressPoint[]): 'improving' | 'declining' | 'stable' {
  if (timeline.length < 2) { return 'stable'; }
  const recent = timeline.slice(-3);
  const first = recent[0].score;
  const last = recent[recent.length - 1].score;
  if (last - first >= 10) { return 'improving'; }
  if (first - last >= 10) { return 'declining'; }
  return 'stable';
}
