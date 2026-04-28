import * as vscode from 'vscode';
import type { FileScore, DangerZone } from '../types';

export class FileScoreItem extends vscode.TreeItem {
  constructor(
    public readonly fileScore: FileScore,
    collapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(fileScore.relativePath, collapsibleState);
    this.description = `${fileScore.score}%`;
    this.tooltip = `${fileScore.relativePath}\nScore: ${fileScore.score}%\nRisk: ${fileScore.riskLevel}/10`;
    const color = fileScore.score >= 80
      ? new vscode.ThemeColor('charts.green')
      : fileScore.score >= 50
        ? new vscode.ThemeColor('charts.yellow')
        : new vscode.ThemeColor('charts.red');
    this.iconPath = new vscode.ThemeIcon('circle-filled', color);
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(fileScore.file)],
    };
    this.contextValue = 'CodeLitmusFile';
  }
}

export class FileScoresProvider implements vscode.TreeDataProvider<FileScoreItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FileScoreItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private scores: FileScore[] = [];

  update(scores: FileScore[]): void {
    this.scores = scores;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FileScoreItem): vscode.TreeItem {
    return element;
  }

  getChildren(): FileScoreItem[] {
    if (this.scores.length === 0) {
      return [];
    }
    return this.scores
      .sort((a, b) => (a.score - b.score))
      .map(s => new FileScoreItem(s));
  }
}

export class DangerZoneItem extends vscode.TreeItem {
  constructor(public readonly zone: DangerZone) {
    super(zone.relativePath, vscode.TreeItemCollapsibleState.None);
    this.description = `${zone.category} — ${zone.understandingScore}% understood`;
    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
    this.tooltip = `Risk: ${zone.riskLevel}/10\nUnderstanding: ${zone.understandingScore}%\nDanger Score: ${zone.dangerScore.toFixed(1)}`;
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(zone.file)],
    };
  }
}

export class DangerZonesProvider implements vscode.TreeDataProvider<DangerZoneItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DangerZoneItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private zones: DangerZone[] = [];

  update(zones: DangerZone[]): void {
    this.zones = zones;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DangerZoneItem): vscode.TreeItem {
    return element;
  }

  getChildren(): DangerZoneItem[] {
    return this.zones.map(z => new DangerZoneItem(z));
  }
}

export class PinnedFileItem extends vscode.TreeItem {
  constructor(public readonly pinnedFile: import('../types').PinnedFile) {
    super(pinnedFile.relativePath, vscode.TreeItemCollapsibleState.None);
    this.tooltip = pinnedFile.file;
    this.iconPath = new vscode.ThemeIcon('pin');
    this.contextValue = 'codelitmusPinnedFile';
    this.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [vscode.Uri.file(pinnedFile.file)],
    };
  }
}

export class PinnedFilesProvider implements vscode.TreeDataProvider<PinnedFileItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PinnedFileItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private files: import('../types').PinnedFile[] = [];

  update(files: import('../types').PinnedFile[]): void {
    this.files = files;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PinnedFileItem): vscode.TreeItem { return element; }

  getChildren(): PinnedFileItem[] {
    if (this.files.length === 0) { return []; }
    return this.files.map(f => new PinnedFileItem(f));
  }
}
