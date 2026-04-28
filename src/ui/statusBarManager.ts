import * as vscode from 'vscode';

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;
  private readonly quizItem: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'codelitmus.showReport';
    this.item.tooltip = 'CodeLitmus: Click to view full report';
    this.item.text = '$(shield) CodeLitmus: Not scanned';
    this.item.show();

    this.quizItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.quizItem.command = 'codelitmus.startQuiz';
    this.quizItem.tooltip = 'CodeLitmus: Start Quiz (Ctrl+Alt+V)';
    this.quizItem.text = '$(beaker) Quiz';
    this.quizItem.show();
  }

  update(score: number): void {
    const color = score >= 81
      ? new vscode.ThemeColor('charts.blue')
      : score >= 61
        ? new vscode.ThemeColor('charts.green')
        : score >= 31
          ? new vscode.ThemeColor('charts.yellow')
          : new vscode.ThemeColor('charts.red');

    this.item.text = `$(shield) CodeLitmus: ${score}%`;
    this.item.color = color;
    this.item.tooltip = `Overall codebase understanding: ${score}%. Click to view full report.`;
  }

  setScanning(): void {
    this.item.text = '$(sync~spin) CodeLitmus: Scanning...';
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
    this.quizItem.dispose();
  }
}
