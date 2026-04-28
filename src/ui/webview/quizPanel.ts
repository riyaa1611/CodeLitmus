import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './panelUtils';
import type { QuizQuestion, QuizAnswer, QuizSession } from '../../types';

type AnswerHandler = (questionId: string, selectedLabel: string) => Promise<QuizAnswer>;
type CompleteHandler = (session: QuizSession) => Promise<void>;

export class QuizPanel {
  static current: QuizPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private session: QuizSession | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private onAnswer: AnswerHandler,
    private onComplete: CompleteHandler
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => { QuizPanel.current = undefined; });
    this.panel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'submitAnswer' && this.session) {
        const q = this.session.questions.find(q => q.id === msg.data.questionId);
        if (!q) { return; }
        const answer = await this.onAnswer(q.id, msg.data.selectedLabel);
        this.panel.webview.postMessage({
          type: 'showResult',
          data: { ...answer, dangerNote: q.dangerNote },
        });
      } else if (msg.type === 'quizComplete' && this.session) {
        await this.onComplete(this.session);
        this.showSummary();
      } else if (msg.type === 'openFile' && msg.data.command) {
        vscode.commands.executeCommand(msg.data.command);
      } else if (msg.type === 'startQuiz') {
        this.panel.dispose();
        setTimeout(() => vscode.commands.executeCommand('codelitmus.startQuiz'), 100);
      } else if (msg.type === 'openFile' && msg.data.filePath) {
        vscode.window.showTextDocument(vscode.Uri.file(msg.data.filePath), { preview: false });
      }
    });
  }

  static show(extensionUri: vscode.Uri, onAnswer: AnswerHandler, onComplete: CompleteHandler): QuizPanel {
    if (QuizPanel.current) {
      QuizPanel.current.onAnswer = onAnswer;
      QuizPanel.current.onComplete = onComplete;
      QuizPanel.current.panel.reveal();
      return QuizPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      'CodeLitmusQuiz',
      'CodeLitmus Quiz',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri], retainContextWhenHidden: true }
    );
    QuizPanel.current = new QuizPanel(panel, extensionUri, onAnswer, onComplete);
    return QuizPanel.current;
  }

  startQuiz(session: QuizSession): void {
    this.session = session;
    this.panel.webview.postMessage({ type: 'startQuiz', data: { questions: session.questions } });
  }

  private showSummary(): void {
    if (!this.session) { return; }
    const correct = this.session.answers.filter(a => a.isCorrect).length;
    this.panel.webview.postMessage({
      type: 'showSummary',
      data: { score: this.session.score, correct, total: this.session.answers.length },
    });
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();
    const templatePath = path.join(__dirname, 'webview', 'templates', 'quiz.html');
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'templates', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'scripts', 'quiz.js')
    );

    let html: string;
    try {
      html = fs.readFileSync(templatePath, 'utf8');
    } catch {
      return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{background:#1e1e1e;color:#ccc;font-family:sans-serif;padding:40px;}h2{color:#f14c4c;}</style></head><body><h2>CodeLitmus: Quiz template not found</h2><p>Run <code>node esbuild.config.mjs</code> then reinstall.</p></body></html>`;
    }

    return html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString())
      .replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
  }
}
