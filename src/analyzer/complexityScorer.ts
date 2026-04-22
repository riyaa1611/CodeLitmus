import * as fs from 'fs';

export function scoreComplexity(filePath: string, riskLevel: number): number {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return riskLevel;
  }

  const lines = content.split('\n');
  const lineScore = Math.min(3, lines.length / 200);

  const branchCount = (content.match(/\bif\b|\belse\b|\bswitch\b|\bcase\b|\?\s/g) ?? []).length;
  const branchScore = Math.min(3, branchCount / 10);

  const nestingDepth = estimateNestingDepth(content);
  const nestingScore = Math.min(2, nestingDepth / 5);

  return Math.min(10, Math.round(riskLevel * 0.4 + lineScore + branchScore + nestingScore));
}

function estimateNestingDepth(content: string): number {
  let maxDepth = 0;
  let depth = 0;
  for (const ch of content) {
    if (ch === '{' || ch === '(') { depth++; maxDepth = Math.max(maxDepth, depth); }
    else if (ch === '}' || ch === ')') { depth = Math.max(0, depth - 1); }
  }
  return maxDepth;
}
