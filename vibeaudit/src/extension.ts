import * as vscode from 'vscode';
import { StateManager } from './storage/stateManager';
import { ApiKeyManager } from './storage/apiKeyManager';
import { analyzeWorkspace } from './analyzer/workspaceAnalyzer';
import { QuizEngine } from './quiz/quizEngine';
import { calculateScores } from './scoring/scoreCalculator';
import { detectDangerZones } from './scoring/dangerZoneDetector';
import { StatusBarManager } from './ui/statusBarManager';
import { FileScoresProvider, DangerZonesProvider, PinnedFilesProvider, PinnedFileItem } from './ui/sidebarProvider';
import { VibeAuditCodeLensProvider } from './ui/codeLensProvider';
import { DiagnosticsProvider } from './ui/diagnosticsProvider';
import { VibeAuditHoverProvider } from './ui/hoverProvider';
import { OnboardingPanel } from './ui/webview/onboardingPanel';
import { QuizPanel } from './ui/webview/quizPanel';
import { ReportPanel } from './ui/webview/reportPanel';
import { requireWorkspace } from './utils/guards';
import type { ScoreReport } from './types';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return;
  }

  const stateManager = new StateManager(context.globalState);
  const apiKeyManager = new ApiKeyManager(context.secrets);
  const quizEngine = new QuizEngine(stateManager, apiKeyManager, context);

  const statusBar = new StatusBarManager();
  const fileScoresProvider = new FileScoresProvider();
  const dangerZonesProvider = new DangerZonesProvider();
  const codeLensProvider = new VibeAuditCodeLensProvider();
  const diagnosticsProvider = new DiagnosticsProvider();
  const hoverProvider = new VibeAuditHoverProvider();

  context.subscriptions.push(statusBar, diagnosticsProvider);

  vscode.window.registerTreeDataProvider('vibeaudit.fileScores', fileScoresProvider);
  vscode.window.registerTreeDataProvider('vibeaudit.dangerZones', dangerZonesProvider);
  const pinnedFilesProvider = new PinnedFilesProvider();
  pinnedFilesProvider.update(stateManager.getPinnedFiles());
  vscode.window.registerTreeDataProvider('vibeaudit.pinnedFiles', pinnedFilesProvider);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [{ language: 'typescript' }, { language: 'javascript' }, { language: 'python' }],
      codeLensProvider
    ),
    vscode.languages.registerHoverProvider(
      [{ language: 'typescript' }, { language: 'javascript' }, { language: 'python' }],
      hoverProvider
    )
  );

  function refreshUi(report: ScoreReport): void {
    statusBar.update(report.overallScore);
    fileScoresProvider.update(report.fileScores);
    dangerZonesProvider.update(report.dangerZones);
    codeLensProvider.update(report.fileScores);
    hoverProvider.update(report.fileScores);
    diagnosticsProvider.update(report.dangerZones);
    ReportPanel.current?.refresh();
  }

  async function runScan(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }
    statusBar.setScanning();
    try {
      const analysis = await analyzeWorkspace(workspaceFolder.uri.fsPath);
      await stateManager.saveAnalysis(analysis);
      await stateManager.setInitialized();
      vscode.window.showInformationMessage(
        `VibeAudit: Scanned ${analysis.totalFiles} files, found ${analysis.totalCriticalFunctions} critical paths.`
      );
      const sessions = stateManager.getSessions();
      if (sessions.length > 0) {
        const { fileScores, categoryScores, overallScore } = calculateScores(sessions, analysis);
        const dangerZones = detectDangerZones(analysis.criticalPaths, fileScores);
        const report: ScoreReport = { overallScore, fileScores, dangerZones, categoryScores, sessionHistory: sessions, lastUpdated: Date.now() };
        await stateManager.saveReport(report);
        refreshUi(report);
      } else {
        statusBar.update(0);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`VibeAudit: Scan failed — ${String(err)}`);
      statusBar.update(0);
    }
  }

  async function startQuizCommand(focusArea?: string, pinnedFiles?: string[]): Promise<void> {
    if (!requireWorkspace()) { return; }
    const hasKey = await apiKeyManager.hasApiKey();
    if (!hasKey) {
      const choice = await vscode.window.showWarningMessage(
        'VibeAudit needs an OpenRouter API key to generate quiz questions.',
        'Set API Key'
      );
      if (choice === 'Set API Key') {
        await vscode.commands.executeCommand('vibeaudit.setApiKey');
      }
      return;
    }
    const session = await quizEngine.startSession(focusArea, pinnedFiles);
    if (!session || session.questions.length === 0) {
      vscode.window.showWarningMessage('VibeAudit: No questions generated. Scan workspace first and verify your API key.');
      return;
    }
    const panel = QuizPanel.show(
      context.extensionUri,
      async (questionId, selectedLabel) => {
        const q = session.questions.find(q => q.id === questionId);
        if (!q) { throw new Error('Question not found'); }
        return quizEngine.submitAnswer(session, q, selectedLabel);
      },
      async (completedSession) => {
        await quizEngine.endSession(completedSession);
        const analysis = stateManager.getAnalysis();
        if (!analysis) { return; }
        const sessions = stateManager.getSessions();
        const { fileScores, categoryScores, overallScore } = calculateScores(sessions, analysis);
        const dangerZones = detectDangerZones(analysis.criticalPaths, fileScores);
        const report: ScoreReport = { overallScore, fileScores, dangerZones, categoryScores, sessionHistory: sessions, lastUpdated: Date.now() };
        await stateManager.saveReport(report);
        refreshUi(report);
      }
    );
    panel.startQuiz(session);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('vibeaudit.scanWorkspace', async () => {
      if (!requireWorkspace()) { return; }
      await runScan();
    }),

    vscode.commands.registerCommand('vibeaudit.setApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'Enter your OpenRouter API key',
        password: true,
        placeHolder: 'sk-or-v1-...',
      });
      if (key?.trim()) {
        await apiKeyManager.setApiKey(key.trim());
        vscode.window.showInformationMessage('VibeAudit: API key saved.');
      }
    }),

    vscode.commands.registerCommand('vibeaudit.startQuiz', () => startQuizCommand()),

    vscode.commands.registerCommand('vibeaudit.startFocusedQuiz', async (filePath?: string) => {
      if (!requireWorkspace()) { return; }
      const focusArea = filePath
        ? vscode.workspace.asRelativePath(filePath)
        : vscode.window.activeTextEditor
          ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri)
          : undefined;
      await startQuizCommand(focusArea);
    }),

    vscode.commands.registerCommand('vibeaudit.showReport', () => {
      if (!requireWorkspace()) { return; }
      ReportPanel.show(
        context.extensionUri,
        () => stateManager.getReport(),
        () => stateManager.getSessions()
      );
    }),

    vscode.commands.registerCommand('vibeaudit.showDangerZones', () => {
      if (!requireWorkspace()) { return; }
      const report = stateManager.getReport();
      if (!report || report.dangerZones.length === 0) {
        vscode.window.showInformationMessage('VibeAudit: No danger zones yet. Complete a quiz first.');
        return;
      }
      vscode.commands.executeCommand('vibeaudit.showReport');
    }),

    vscode.commands.registerCommand('vibeaudit.resetScores', async () => {
      if (!requireWorkspace()) { return; }
      const confirm = await vscode.window.showWarningMessage(
        'Reset all VibeAudit scores and history?',
        { modal: true },
        'Reset'
      );
      if (confirm === 'Reset') {
        await stateManager.resetAll();
        fileScoresProvider.update([]);
        dangerZonesProvider.update([]);
        codeLensProvider.update([]);
        hoverProvider.update([]);
        diagnosticsProvider.update([]);
        statusBar.update(0);
        vscode.window.showInformationMessage('VibeAudit: All scores reset.');
      }
    }),

    vscode.commands.registerCommand('vibeaudit.pinCurrentFile', async () => {
      if (!requireWorkspace()) { return; }
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a file first to pin it.');
        return;
      }
      const file = editor.document.uri.fsPath;
      const relativePath = vscode.workspace.asRelativePath(file);
      const pinned = stateManager.getPinnedFiles();
      if (pinned.some(p => p.file === file)) {
        vscode.window.showInformationMessage(`Already pinned: ${relativePath}`);
        return;
      }
      pinned.push({ file, relativePath });
      await stateManager.setPinnedFiles(pinned);
      pinnedFilesProvider.update(pinned);
      vscode.window.showInformationMessage(`Pinned: ${relativePath}`);
    }),

    vscode.commands.registerCommand('vibeaudit.unpinFile', async (item?: PinnedFileItem) => {
      if (!requireWorkspace()) { return; }
      let fileToRemove: string | undefined;
      if (item) {
        fileToRemove = item.pinnedFile.file;
      } else {
        const editor = vscode.window.activeTextEditor;
        fileToRemove = editor?.document.uri.fsPath;
      }
      if (!fileToRemove) { return; }
      const pinned = stateManager.getPinnedFiles().filter(p => p.file !== fileToRemove);
      await stateManager.setPinnedFiles(pinned);
      pinnedFilesProvider.update(pinned);
    }),

    vscode.commands.registerCommand('vibeaudit.startPinnedQuiz', async () => {
      if (!requireWorkspace()) { return; }
      const pinned = stateManager.getPinnedFiles();
      if (pinned.length === 0) {
        vscode.window.showWarningMessage('No pinned files. Open a file and run "VibeAudit: Pin File for Quiz Focus".');
        return;
      }
      await startQuizCommand(undefined, pinned.map(p => p.file));
    }),

    vscode.commands.registerCommand('vibeaudit.exportScores', async () => {
      if (!requireWorkspace()) { return; }
      const data = stateManager.exportState();
      if (!data) {
        vscode.window.showWarningMessage('No scores to export. Complete a quiz first.');
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: 'Your name (shown to teammates)',
        placeHolder: 'e.g. Alice',
      });
      if (name !== undefined) { data.exportedBy = name; }
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('vibeaudit-scores.json'),
        filters: { 'JSON': ['json'] },
      });
      if (!uri) { return; }
      const fs = await import('fs');
      fs.writeFileSync(uri.fsPath, JSON.stringify(data, null, 2), 'utf8');
      vscode.window.showInformationMessage(`Scores exported to ${uri.fsPath}`);
    }),

    vscode.commands.registerCommand('vibeaudit.importScores', async () => {
      if (!requireWorkspace()) { return; }
      const uris = await vscode.window.showOpenDialog({
        filters: { 'JSON': ['json'] },
        canSelectMany: true,
        openLabel: 'Import Score Files',
      });
      if (!uris || uris.length === 0) { return; }
      const fs = await import('fs');
      const imports: import('./types').TeamExport[] = [];
      for (const uri of uris) {
        try {
          const raw = fs.readFileSync(uri.fsPath, 'utf8');
          imports.push(JSON.parse(raw) as import('./types').TeamExport);
        } catch {
          vscode.window.showWarningMessage(`Could not parse: ${uri.fsPath}`);
        }
      }
      if (imports.length === 0) { return; }
      ReportPanel.show(
        context.extensionUri,
        () => stateManager.getReport(),
        () => stateManager.getSessions(),
        imports
      );
    }),
  );

  // First launch or restore
  if (!stateManager.isInitialized()) {
    const hasKey = await apiKeyManager.hasApiKey();
    if (!hasKey) {
      OnboardingPanel.show(context.extensionUri, apiKeyManager, async (key) => {
        await apiKeyManager.setApiKey(key);
        await runScan();
      });
    } else {
      const config = vscode.workspace.getConfiguration('vibeaudit');
      if (config.get<boolean>('autoScanOnOpen', true)) { runScan(); }
    }
  } else {
    const report = stateManager.getReport();
    if (report) { refreshUi(report); }
    const config = vscode.workspace.getConfiguration('vibeaudit');
    if (config.get<boolean>('autoScanOnOpen', true)) { runScan(); }
  }
}

export function deactivate(): void {}
