import * as vscode from 'vscode';
import type { FileScore } from '../types';

export class CodeLitmusHoverProvider implements vscode.HoverProvider {
  private fileScores: Map<string, FileScore> = new Map();

  update(scores: FileScore[]): void {
    this.fileScores.clear();
    for (const s of scores) {
      this.fileScores.set(s.file, s);
      this.fileScores.set(s.relativePath, s);
    }
  }

  provideHover(document: vscode.TextDocument): vscode.Hover | null {
    const score = this.fileScores.get(document.uri.fsPath) ??
      this.fileScores.get(vscode.workspace.asRelativePath(document.uri));

    if (!score) { return null; }

    const daysAgo = Math.floor((Date.now() - score.lastUpdated) / (1000 * 60 * 60 * 24));
    const timeStr = daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
    const md = new vscode.MarkdownString(
      `**CodeLitmus Score:** ${score.score}% (${score.questionCount} questions)\n\n` +
      `**Risk Level:** ${score.riskLevel}/10\n\n` +
      `**Last audited:** ${timeStr}\n\n` +
      `[Re-audit](command:codelitmus.startFocusedQuiz) | [View Report](command:codelitmus.showReport)`
    );
    md.isTrusted = true;
    return new vscode.Hover(md);
  }
}
