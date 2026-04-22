import type { CriticalPath, FileScore, DangerZone } from '../types';

export function detectDangerZones(
  criticalPaths: CriticalPath[],
  fileScores: FileScore[]
): DangerZone[] {
  const zones: DangerZone[] = [];

  for (const cp of criticalPaths) {
    if (cp.riskLevel < 7) { continue; }

    const fileScore = fileScores.find(
      fs => fs.file === cp.relativePath || fs.file === cp.file
    );
    const understandingScore = fileScore?.score ?? 0;

    if (understandingScore <= 40 || !fileScore) {
      const score = understandingScore / 100;
      zones.push({
        file: cp.file,
        relativePath: cp.relativePath,
        function: cp.function,
        riskLevel: cp.riskLevel,
        understandingScore,
        dangerScore: cp.riskLevel * (1 - score),
        category: cp.category,
        startLine: cp.startLine,
        endLine: cp.endLine,
      });
    }
  }

  return zones.sort((a, b) => b.dangerScore - a.dangerScore);
}
