import * as vscode from 'vscode';
import type { FileScore } from '../types';

export class CodeLitmusCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private fileScores: Map<string, number> = new Map();

  update(scores: FileScore[]): void {
    this.fileScores.clear();
    for (const s of scores) {
      this.fileScores.set(s.relativePath, s.score);
      this.fileScores.set(s.file, s.score);
    }
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration('codelitmus');
    if (!config.get<boolean>('showCodeLens', true)) { return []; }

    const score = this.fileScores.get(document.uri.fsPath) ??
      this.fileScores.get(vscode.workspace.asRelativePath(document.uri));

    if (score === undefined) {
      const range = new vscode.Range(0, 0, 0, 0);
      return [new vscode.CodeLens(range, {
        title: 'CodeLitmus: Not audited yet | Click to audit',
        command: 'codelitmus.startFocusedQuiz',
        arguments: [document.uri.fsPath],
      })];
    }

    const action = score >= 80 ? '' : ' | Re-audit';
    const range = new vscode.Range(0, 0, 0, 0);

    return [new vscode.CodeLens(range, {
      title: `CodeLitmus: ${score}% understood${action}`,
      command: score >= 80 ? '' : 'codelitmus.startFocusedQuiz',
      arguments: [document.uri.fsPath],
    })];
  }
}
