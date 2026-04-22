import * as vscode from 'vscode';

export class StatusBarManager {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'vibeaudit.showReport';
    this.item.tooltip = 'VibeAudit: Click to view full report';
    this.item.text = '$(shield) VibeAudit: Not scanned';
    this.item.show();
  }

  update(score: number): void {
    const color = score >= 81
      ? new vscode.ThemeColor('charts.blue')
      : score >= 61
        ? new vscode.ThemeColor('charts.green')
        : score >= 31
          ? new vscode.ThemeColor('charts.yellow')
          : new vscode.ThemeColor('charts.red');

    this.item.text = `$(shield) VibeAudit: ${score}%`;
    this.item.color = color;
    this.item.tooltip = `Overall codebase understanding: ${score}%. Click to view full report.`;
  }

  setScanning(): void {
    this.item.text = '$(sync~spin) VibeAudit: Scanning...';
    this.item.color = undefined;
  }

  dispose(): void {
    this.item.dispose();
  }
}
