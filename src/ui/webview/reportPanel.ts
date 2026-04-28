import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './panelUtils';
import type { ScoreReport, QuizSession, LearningPathItem } from '../../types';
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
      } else if (msg.type === 'openFile' && msg.data.command) {
        vscode.commands.executeCommand(msg.data.command);
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
      'CodeLitmusReport',
      'CodeLitmus Report',
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
        learningPath: this.buildLearningPath(report, sessions),
        sessions,
        teamImports: teamImports ?? [],
      },
    });
  }

  private buildLearningPath(report: ScoreReport | undefined, sessions: QuizSession[]): LearningPathItem[] {
    const items: LearningPathItem[] = [];
    const seen = new Set<string>();

    // Wrong answers from recent sessions — use question category + explanation
    for (const session of [...sessions].reverse()) {
      for (let i = 0; i < session.answers.length; i++) {
        const ans = session.answers[i];
        if (ans.isCorrect) { continue; }
        const q = session.questions[i];
        if (!q?.codeReference) { continue; }
        const key = `${q.codeReference.file}:${q.codeReference.startLine}`;
        if (seen.has(key)) { continue; }
        seen.add(key);
        items.push({
          file: q.codeReference.file,
          startLine: q.codeReference.startLine,
          endLine: q.codeReference.endLine,
          concept: `${q.category.replace(/-/g, ' ')} — ${q.question.slice(0, 60)}…`,
          whyItMatters: ans.feedback,
          priority: items.length + 1,
        });
        if (items.length >= 10) { break; }
      }
      if (items.length >= 10) { break; }
    }

    // Danger zones as additional items
    const zones = [...(report?.dangerZones ?? [])].sort((a, b) => b.dangerScore - a.dangerScore);
    for (const dz of zones) {
      if (items.length >= 10) { break; }
      const key = `${dz.file}:${dz.startLine}`;
      if (seen.has(key)) { continue; }
      seen.add(key);
      items.push({
        file: dz.relativePath,
        startLine: dz.startLine,
        endLine: dz.endLine,
        concept: dz.function ? `${dz.function} (${dz.category})` : dz.category,
        whyItMatters: `Risk level ${dz.riskLevel}/5 — understanding score ${dz.understandingScore}%`,
        priority: items.length + 1,
      });
    }

    // Fallback: always show bottom 5 files by score if nothing else populated
    if (items.length === 0 && report?.fileScores && report.fileScores.length > 0) {
      const sorted = [...report.fileScores].sort((a, b) => a.score - b.score);
      for (const f of sorted.slice(0, 5)) {
        items.push({
          file: f.relativePath,
          startLine: 1,
          endLine: 1,
          concept: `Review: ${f.relativePath} (${f.score}% understood)`,
          whyItMatters: f.score >= 80
            ? `Strong score but worth revisiting to maintain mastery.`
            : `Scored below 80% — review and retake quiz.`,
          priority: items.length + 1,
        });
      }
    }

    return items;
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
      return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:40px;}h2{color:#f14c4c;}</style></head><body><h2>CodeLitmus: Report template not found</h2><p>Run <code>node esbuild.config.mjs</code> then reinstall.</p></body></html>`;
    }

    return html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
  }
}
