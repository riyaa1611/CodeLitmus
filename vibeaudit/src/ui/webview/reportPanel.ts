import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './panelUtils';
import type { ScoreReport, QuizSession } from '../../types';
import { buildProgressTimeline } from '../../scoring/progressTracker';

export class ReportPanel {
  static current: ReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private teamImports: import('../../types').TeamExport[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly getReport: () => ScoreReport | undefined,
    private readonly getSessions: () => QuizSession[]
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => { ReportPanel.current = undefined; });
    this.panel.webview.onDidReceiveMessage(msg => {
      if (msg.type === 'requestReport') {
        this.sendReport();
      } else if (msg.type === 'openFile' && msg.data.filePath) {
        const uri = vscode.Uri.file(msg.data.filePath);
        const opts: vscode.TextDocumentShowOptions = {};
        if (msg.data.lineNumber) {
          opts.selection = new vscode.Range(msg.data.lineNumber, 0, msg.data.lineNumber, 0);
        }
        vscode.window.showTextDocument(uri, opts);
      }
    });
  }

  static show(
    extensionUri: vscode.Uri,
    getReport: () => ScoreReport | undefined,
    getSessions: () => QuizSession[],
    teamImports?: import('../../types').TeamExport[]
  ): void {
    if (ReportPanel.current) {
      ReportPanel.current.panel.reveal();
      ReportPanel.current.sendReport(teamImports);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'vibeauditReport',
      'VibeAudit Report',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri], retainContextWhenHidden: true }
    );
    ReportPanel.current = new ReportPanel(panel, extensionUri, getReport, getSessions);
    ReportPanel.current.sendReport(teamImports);
  }

  refresh(): void {
    this.sendReport();
  }

  private sendReport(teamImports?: import('../../types').TeamExport[]): void {
    const report = this.getReport();
    const sessions = this.getSessions();
    const timeline = buildProgressTimeline(sessions);
    this.panel.webview.postMessage({
      type: 'showReport',
      data: {
        overallScore: report?.overallScore ?? 0,
        fileScores: report?.fileScores ?? [],
        dangerZones: report?.dangerZones ?? [],
        categoryScores: report?.categoryScores ?? [],
        timeline,
        learningPath: [],
        sessions,
        teamImports: teamImports ?? [],
      },
    });
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const templatePath = path.join(__dirname, 'webview', 'templates', 'report.html');
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'templates', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'scripts', 'report.js')
    );

    let html: string;
    try {
      html = fs.readFileSync(templatePath, 'utf8');
    } catch {
      return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:40px;}h2{color:#f14c4c;}</style></head><body><h2>VibeAudit: Report template not found</h2><p>Run <code>node esbuild.config.mjs</code> then reinstall.</p></body></html>`;
    }

    return html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
  }
}
