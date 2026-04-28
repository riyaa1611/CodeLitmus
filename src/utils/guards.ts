import * as vscode from 'vscode';

export function requireWorkspace(): boolean {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showWarningMessage(
      'CodeLitmus requires an open workspace folder. Open a project folder first (File → Open Folder).'
    );
    return false;
  }
  return true;
}
