import * as fs from 'fs';
import * as path from 'path';
import type { CriticalPath } from '../types';
import { AUTH_PATTERNS, PAYMENT_PATTERNS, DB_PATTERNS, ERROR_PATTERNS, ROUTE_PATTERNS, SECURITY_PATTERNS } from '../utils/constants';

interface PatternCategory {
  category: CriticalPath['category'];
  patterns: string[];
  routeDirs?: string[];
}

const CATEGORIES: PatternCategory[] = [
  { category: 'auth', patterns: AUTH_PATTERNS },
  { category: 'payments', patterns: PAYMENT_PATTERNS },
  { category: 'database', patterns: DB_PATTERNS },
  { category: 'error-handling', patterns: ERROR_PATTERNS },
  { category: 'api-route', patterns: ROUTE_PATTERNS, routeDirs: ['routes', 'api', 'controllers', 'endpoints'] },
  { category: 'security', patterns: SECURITY_PATTERNS },
];

export function findCriticalPaths(
  filePaths: { path: string; relativePath: string }[]
): CriticalPath[] {
  const results: CriticalPath[] = [];

  for (const { path: filePath, relativePath } of filePaths) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8').toLowerCase();
    } catch {
      continue;
    }

    const fileName = path.basename(relativePath).toLowerCase();
    const dirParts = relativePath.toLowerCase().split('/');

    for (const { category, patterns, routeDirs } of CATEGORIES) {
      const matched: string[] = [];

      for (const pattern of patterns) {
        if (content.includes(pattern) || fileName.includes(pattern)) {
          matched.push(pattern);
        }
      }

      if (routeDirs) {
        for (const dir of routeDirs) {
          if (dirParts.includes(dir)) {
            matched.push(`dir:${dir}`);
          }
        }
      }

      if (matched.length > 0) {
        const riskLevel = Math.min(10, 3 + matched.length * 1.5);
        results.push({
          file: filePath,
          relativePath,
          function: null,
          category,
          riskLevel: Math.round(riskLevel),
          matchedPatterns: matched,
          startLine: 0,
          endLine: 0,
        });
        break; // one category per file
      }
    }
  }

  return results;
}
