import type { QuizSession, FileScore, CategoryScore, WorkspaceAnalysis } from '../types';

export function calculateScores(
  sessions: QuizSession[],
  analysis: WorkspaceAnalysis
): { fileScores: FileScore[]; categoryScores: CategoryScore[]; overallScore: number } {
  const fileMap = new Map<string, { correct: number; total: number; riskLevel: number }>();
  const categoryMap = new Map<string, { correct: number; total: number }>();

  for (const session of sessions) {
    for (const answer of session.answers) {
      const question = session.questions.find(q => q.id === answer.questionId);
      if (!question) { continue; }

      const file = question.codeReference.file;
      const category = question.category;

      const critical = analysis.criticalPaths.find(cp =>
        cp.relativePath === file || cp.file === file
      );
      const riskLevel = critical?.riskLevel ?? 1;

      const existing = fileMap.get(file) ?? { correct: 0, total: 0, riskLevel };
      existing.total++;
      if (answer.isCorrect) { existing.correct++; }
      fileMap.set(file, existing);

      const catExisting = categoryMap.get(category) ?? { correct: 0, total: 0 };
      catExisting.total++;
      if (answer.isCorrect) { catExisting.correct++; }
      categoryMap.set(category, catExisting);
    }
  }

  const fileScores: FileScore[] = Array.from(fileMap.entries()).map(([file, data]) => ({
    file,
    relativePath: file,
    score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    questionCount: data.total,
    riskLevel: data.riskLevel,
    lastUpdated: Date.now(),
  }));

  const categoryScores: CategoryScore[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    questionCount: data.total,
  }));

  let weightedSum = 0;
  let totalWeight = 0;
  for (const fs of fileScores) {
    const weight = fs.riskLevel >= 7 ? 3 : 1;
    weightedSum += fs.score * weight;
    totalWeight += weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { fileScores, categoryScores, overallScore };
}
