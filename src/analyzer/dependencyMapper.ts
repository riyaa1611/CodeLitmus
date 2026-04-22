import * as fs from 'fs';
import type { DependencyNode } from '../types';

const IMPORT_REGEX = /(?:import|require)\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)?\s*(?:from\s*)?['"]([^'"]+)['"]/g;

export function mapDependencies(files: { path: string; relativePath: string }[]): DependencyNode[] {
  const graph: DependencyNode[] = [];

  for (const { path: filePath, relativePath } of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const calls: string[] = [];
    for (const match of content.matchAll(IMPORT_REGEX)) {
      const imported = match[1];
      if (imported && !imported.startsWith('.') === false || imported?.startsWith('.')) {
        calls.push(imported);
      }
    }

    if (calls.length > 0) {
      graph.push({
        file: relativePath,
        function: '',
        calledBy: [],
        calls: [...new Set(calls)],
        riskLevel: 0,
      });
    }
  }

  return graph;
}
