import * as vscode from 'vscode';
import { scanWorkspace } from './workspaceScanner';
import { detectProjectProfile } from './languageDetector';
import { extractSymbols } from './symbolExtractor';
import { findCriticalPaths } from './criticalPathFinder';
import { scoreComplexity } from './complexityScorer';
import { mapDependencies } from './dependencyMapper';
import { getLanguageFromExtension } from '../utils/fileUtils';
import type { WorkspaceAnalysis, AnalyzedFile } from '../types';

export async function analyzeWorkspace(workspaceRoot: string): Promise<WorkspaceAnalysis> {
  const profile = detectProjectProfile(workspaceRoot);

  let scanned = 0;
  const progress = await vscode.window.withProgress<WorkspaceAnalysis>({
    location: vscode.ProgressLocation.Notification,
    title: 'CodeLitmus: Scanning workspace...',
    cancellable: false,
  }, async (prog) => {
    const files = await scanWorkspace(workspaceRoot, (done, total) => {
      prog.report({ message: `${done}/${total} files`, increment: (1 / total) * 100 });
    });

    const criticalPaths = findCriticalPaths(files.map(f => ({ path: f.path, relativePath: f.relativePath })));
    const criticalFileSet = new Set(criticalPaths.map(cp => cp.file));

    const analyzedFiles: AnalyzedFile[] = [];
    let totalFunctions = 0;

    for (const file of files) {
      const language = getLanguageFromExtension(file.path);
      const uri = vscode.Uri.file(file.path);
      const symbols = await extractSymbols(uri, language);
      const cp = criticalPaths.find(c => c.file === file.path);
      const riskLevel = cp?.riskLevel ?? 1;
      const complexityScore = scoreComplexity(file.path, riskLevel);

      totalFunctions += symbols.filter(s => s.kind === 'function').length;

      analyzedFiles.push({
        path: file.path,
        relativePath: file.relativePath,
        language,
        lineCount: file.lineCount,
        symbols,
        riskLevel,
        complexityScore,
        isAudited: false,
        lastAuditScore: 0,
        criticalPatterns: cp?.matchedPatterns ?? [],
      });
    }

    const depGraph = mapDependencies(files.map(f => ({ path: f.path, relativePath: f.relativePath })));

    return {
      projectProfile: profile,
      files: analyzedFiles,
      criticalPaths,
      dependencyGraph: depGraph,
      totalFiles: files.length,
      totalFunctions,
      totalCriticalFunctions: criticalPaths.length,
      scanTimestamp: Date.now(),
    };
  });

  return progress;
}
