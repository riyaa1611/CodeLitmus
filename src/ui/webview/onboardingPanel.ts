import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getNonce } from './panelUtils';
import { testConnectivity } from '../../llm/openRouterClient';
import type { ApiKeyManager } from '../../storage/apiKeyManager';

export class OnboardingPanel {
  static current: OnboardingPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly apiKeyManager: ApiKeyManager,
    private readonly onSave: (key: string) => Promise<void>
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();
    this.panel.onDidDispose(() => { OnboardingPanel.current = undefined; });
    this.panel.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'saveApiKey') {
        const key = msg.data.key?.trim();
        if (!key) {
          this.panel.webview.postMessage({ type: 'keyValidation', data: { ok: false, error: 'API key cannot be empty.' } });
          return;
        }
        this.panel.webview.postMessage({ type: 'keyValidating', data: {} });
        const result = await testConnectivity(key);
        if (!result.ok) {
          this.panel.webview.postMessage({ type: 'keyValidation', data: { ok: false, error: result.error } });
          return;
        }
        try {
          await this.onSave(key);
          this.panel.webview.postMessage({ type: 'keyValidation', data: { ok: true } });
          setTimeout(() => this.panel.dispose(), 2000);
        } catch (err) {
          this.panel.webview.postMessage({ type: 'keyValidation', data: { ok: false, error: String(err) } });
        }
      }
    });
  }

  static show(
    extensionUri: vscode.Uri,
    apiKeyManager: ApiKeyManager,
    onSave: (key: string) => Promise<void>
  ): void {
    if (OnboardingPanel.current) {
      OnboardingPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'vibeauditOnboarding',
      'VibeAudit — Optional: Add AI Enhancement',
      vscode.ViewColumn.One,
      { enableScripts: true, localResourceRoots: [extensionUri] }
    );
    OnboardingPanel.current = new OnboardingPanel(panel, extensionUri, apiKeyManager, onSave);
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    // __dirname = dist/ at runtime — reliable regardless of extensionUri path
    const templatePath = path.join(__dirname, 'webview', 'templates', 'onboarding.html');
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'templates', 'styles.css')
    );

    let html: string;
    try {
      html = fs.readFileSync(templatePath, 'utf8');
    } catch {
      return this.fallbackHtml(nonce, webview.cspSource);
    }

    return html
      .replace(/\{\{nonce\}\}/g, nonce)
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{stylesUri\}\}/g, stylesUri.toString());
  }

  private fallbackHtml(nonce: string, cspSource: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body { font-family: sans-serif; padding: 40px; background: #1e1e1e; color: #cccccc; }
    h2 { color: #4ec9b0; }
    code { background: #333; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <h2>VibeAudit is ready!</h2>
  <p>You can start quizzing immediately — no API key needed.</p>
  <p>Add an OpenRouter API key to get AI-generated explanations:</p>
  <p>Run in project folder:</p>
  <pre><code>node esbuild.config.mjs</code></pre>
  <p>Then reinstall the extension.</p>
</body>
</html>`;
  }
}
