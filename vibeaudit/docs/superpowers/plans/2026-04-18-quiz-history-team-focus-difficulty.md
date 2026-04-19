# Quiz History, Team Mode, Custom Focus, Difficulty Override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quiz history review, team score export/import, pinned-file quiz focus, and difficulty override to VibeAudit.

**Architecture:** Each feature touches a thin slice: state → engine → extension commands → webview. Quiz history and team mode extend the existing report panel with new tabs. Custom focus adds a pinned-files sidebar view and new command. Difficulty override adds a QuickPick before quiz start.

**Tech Stack:** TypeScript, VS Code Extension API, plain HTML/CSS/JS webviews, esbuild, globalState for persistence.

---

## File Map

| File | Change |
|------|--------|
| `src/types.ts` | Add `PinnedFile`, `TeamExport` interfaces |
| `src/storage/stateManager.ts` | Add `getPinnedFiles`, `setPinnedFiles`, `exportState`, `importTeamScores` |
| `src/quiz/difficultyManager.ts` | Add `setDifficulty(n)` method |
| `src/quiz/quizEngine.ts` | Accept `difficultyOverride` + `pinnedFiles` in `startSession` |
| `src/extension.ts` | Register 5 new commands, pass pinned files + difficulty to engine |
| `src/ui/sidebarProvider.ts` | Add `PinnedFilesProvider` TreeView |
| `src/ui/webview/reportPanel.ts` | Send full sessions + team data in `sendReport()` |
| `src/ui/webview/templates/report.html` | Add History + Team tabs |
| `src/ui/webview/scripts/report.js` | Render history sessions and team comparison |
| `package.json` | Register 5 new commands, new sidebar view, `difficultyOverride` setting |

---

## Task 1: Types + State — PinnedFiles & TeamExport

**Files:**
- Modify: `src/types.ts`
- Modify: `src/storage/stateManager.ts`

- [ ] **Step 1: Add new interfaces to `src/types.ts`**

Add at the bottom of the file:

```typescript
export interface PinnedFile {
  file: string;
  relativePath: string;
}

export interface TeamExport {
  exportedBy: string;
  exportedAt: number;
  overallScore: number;
  fileScores: FileScore[];
  categoryScores: CategoryScore[];
  sessionCount: number;
}
```

- [ ] **Step 2: Extend `src/storage/stateManager.ts`**

Add `'vibeaudit.pinnedFiles'` key and methods:

```typescript
// Add to KEYS object:
pinnedFiles: 'vibeaudit.pinnedFiles',

// Add these methods to StateManager class:
getPinnedFiles(): PinnedFile[] {
  return this.state.get<PinnedFile[]>(KEYS.pinnedFiles, []);
}

async setPinnedFiles(files: PinnedFile[]): Promise<void> {
  await this.state.update(KEYS.pinnedFiles, files);
}

exportState(): TeamExport | null {
  const report = this.getReport();
  if (!report) { return null; }
  return {
    exportedBy: '',
    exportedAt: Date.now(),
    overallScore: report.overallScore,
    fileScores: report.fileScores,
    categoryScores: report.categoryScores,
    sessionCount: this.getSessions().length,
  };
}
```

Also add `import type { ... PinnedFile }` to the import line.

- [ ] **Step 3: Add `resetAll` to also clear pinnedFiles**

```typescript
async resetAll(): Promise<void> {
  await this.state.update(KEYS.initialized, undefined);
  await this.state.update(KEYS.analysis, undefined);
  await this.state.update(KEYS.sessions, undefined);
  await this.state.update(KEYS.report, undefined);
  await this.state.update(KEYS.pinnedFiles, undefined);
}
```

- [ ] **Step 4: Type-check**

```bash
cd D:\VibeAudit\vibeaudit
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 2: Difficulty Override

**Files:**
- Modify: `src/quiz/difficultyManager.ts`
- Modify: `src/quiz/quizEngine.ts`
- Modify: `package.json`

- [ ] **Step 1: Add `setDifficulty` to DifficultyManager**

```typescript
setDifficulty(n: number): void {
  this.difficulty = Math.max(1, Math.min(5, n));
  this.consecutiveCorrect = 0;
  this.consecutiveWrong = 0;
}
```

- [ ] **Step 2: Show QuickPick in `quizEngine.startSession()`**

In `quizEngine.ts`, replace the line `this.difficulty.reset();` with:

```typescript
const config = vscode.workspace.getConfiguration('vibeaudit');
const override = config.get<number>('difficultyOverride', 0);
if (override > 0) {
  this.difficulty.setDifficulty(override);
} else {
  // prompt user
  const pick = await vscode.window.showQuickPick(
    [
      { label: 'Adaptive', description: 'Adjusts based on your answers', value: 0 },
      { label: 'Easy (1)', description: 'Beginner questions', value: 1 },
      { label: 'Normal (3)', description: 'Balanced difficulty', value: 3 },
      { label: 'Hard (5)', description: 'Advanced edge cases', value: 5 },
    ],
    { placeHolder: 'Select difficulty' }
  );
  if (!pick) { return null; }
  if (pick.value === 0) {
    this.difficulty.reset();
  } else {
    this.difficulty.setDifficulty(pick.value);
  }
}
```

The QuickPick `value` field requires the item type to include it. Define the type inline or cast:

```typescript
const items = [
  { label: 'Adaptive', description: 'Adjusts based on your answers', value: 0 },
  { label: 'Easy (1)', description: 'Beginner questions', value: 1 },
  { label: 'Normal (3)', description: 'Balanced difficulty', value: 3 },
  { label: 'Hard (5)', description: 'Advanced edge cases', value: 5 },
] as const;
type DiffItem = typeof items[number] & vscode.QuickPickItem;
const pick = await vscode.window.showQuickPick(items as DiffItem[], { placeHolder: 'Select difficulty' });
if (!pick) { return null; }
```

- [ ] **Step 3: Add `difficultyOverride` to `package.json` configuration properties**

```json
"vibeaudit.difficultyOverride": {
  "type": "number",
  "default": 0,
  "minimum": 0,
  "maximum": 5,
  "description": "Fixed quiz difficulty (1=Easy, 3=Normal, 5=Hard). Set to 0 to always prompt."
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 3: Custom Question Focus (Pinned Files)

**Files:**
- Modify: `src/ui/sidebarProvider.ts`
- Modify: `src/extension.ts`
- Modify: `src/quiz/quizEngine.ts`
- Modify: `package.json`

- [ ] **Step 1: Add `PinnedFilesProvider` to `sidebarProvider.ts`**

Add these classes at the bottom of the file:

```typescript
export class PinnedFileItem extends vscode.TreeItem {
  constructor(public readonly pinnedFile: import('../types').PinnedFile) {
    super(pinnedFile.relativePath, vscode.TreeItemCollapsibleState.None);
    this.tooltip = pinnedFile.file;
    this.iconPath = new vscode.ThemeIcon('pin');
    this.contextValue = 'vibeauditPinnedFile';
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
```

- [ ] **Step 2: Register `vibeaudit.pinnedFiles` sidebar view in `package.json`**

In the `views.vibeaudit` array, add:

```json
{
  "id": "vibeaudit.pinnedFiles",
  "name": "Pinned Focus Files"
}
```

- [ ] **Step 3: Register 3 new commands in `package.json` `commands` array**

```json
{ "command": "vibeaudit.pinCurrentFile", "title": "VibeAudit: Pin File for Quiz Focus" },
{ "command": "vibeaudit.unpinFile", "title": "VibeAudit: Unpin File" },
{ "command": "vibeaudit.startPinnedQuiz", "title": "VibeAudit: Quiz Pinned Files Only" }
```

- [ ] **Step 4: Add context menu for unpin in `package.json` `menus.view/item/context`**

```json
{
  "command": "vibeaudit.unpinFile",
  "when": "view == vibeaudit.pinnedFiles && viewItem == vibeauditPinnedFile",
  "group": "vibeaudit"
}
```

- [ ] **Step 5: Register commands and provider in `extension.ts`**

Add `PinnedFilesProvider` to imports from `sidebarProvider`.

After the existing `dangerZonesProvider` declaration:

```typescript
const pinnedFilesProvider = new PinnedFilesProvider();
pinnedFilesProvider.update(stateManager.getPinnedFiles());
vscode.window.registerTreeDataProvider('vibeaudit.pinnedFiles', pinnedFilesProvider);
```

Add 3 commands to `context.subscriptions.push(...)`:

```typescript
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

vscode.commands.registerCommand('vibeaudit.unpinFile', async (item?: import('./ui/sidebarProvider').PinnedFileItem) => {
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
```

- [ ] **Step 6: Update `startQuizCommand` signature in `extension.ts`**

Change:

```typescript
async function startQuizCommand(focusArea?: string): Promise<void> {
```

To:

```typescript
async function startQuizCommand(focusArea?: string, pinnedFiles?: string[]): Promise<void> {
```

And change the `quizEngine.startSession` call to:

```typescript
const session = await quizEngine.startSession(focusArea, pinnedFiles);
```

- [ ] **Step 7: Update `quizEngine.startSession` to accept `pinnedFiles`**

Change signature:

```typescript
async startSession(focusArea?: string, pinnedFiles?: string[]): Promise<QuizSession | null> {
```

In `prioritizeCriticalPaths` call:

```typescript
const candidates = this.prioritizeCriticalPaths(analysis.criticalPaths, report?.fileScores ?? [], focusArea, pinnedFiles);
```

Update `prioritizeCriticalPaths` signature and body:

```typescript
private prioritizeCriticalPaths(
  paths: CriticalPath[],
  fileScores: { file: string; score: number }[],
  focusArea?: string,
  pinnedFiles?: string[]
): CriticalPath[] {
  let filtered = paths;
  if (pinnedFiles && pinnedFiles.length > 0) {
    filtered = paths.filter(p => pinnedFiles.includes(p.file));
  } else if (focusArea) {
    filtered = paths.filter(p => p.category === focusArea || p.relativePath.includes(focusArea));
  }
  return filtered.sort((a, b) => {
    const scoreA = fileScores.find(s => s.file === a.relativePath)?.score ?? 100;
    const scoreB = fileScores.find(s => s.file === b.relativePath)?.score ?? 100;
    const priorityA = a.riskLevel * (1 - scoreA / 100);
    const priorityB = b.riskLevel * (1 - scoreB / 100);
    return priorityB - priorityA;
  });
}
```

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

---

## Task 4: Quiz History Tab in Report

**Files:**
- Modify: `src/ui/webview/reportPanel.ts`
- Modify: `src/ui/webview/templates/report.html`
- Modify: `src/ui/webview/scripts/report.js`

- [ ] **Step 1: Send full sessions in `reportPanel.ts` `sendReport()`**

Change:

```typescript
private sendReport(): void {
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
    },
  });
}
```

To:

```typescript
private sendReport(): void {
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
    },
  });
}
```

- [ ] **Step 2: Add "History" tab to `report.html`**

In the `.tabs` div, add after the last existing tab:

```html
<div class="tab" data-tab="history">History</div>
```

After the last `.tab-content` div, add:

```html
<div class="tab-content" id="tab-history">
  <div id="history-list"><p style="opacity:0.5">No quiz sessions yet.</p></div>
</div>
```

- [ ] **Step 3: Add `renderHistory(sessions)` to `report.js`**

Add this function and call it in the `showReport` handler:

```javascript
function renderHistory(sessions) {
  const container = document.getElementById('history-list');
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<p style="opacity:0.5">No quiz sessions yet.</p>';
    return;
  }
  const sorted = [...sessions].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
  container.innerHTML = sorted.map((s, si) => {
    const date = s.startTime ? new Date(s.startTime).toLocaleString() : 'Unknown date';
    const correct = (s.answers || []).filter(a => a.isCorrect).length;
    const total = (s.answers || []).length;
    const qRows = (s.questions || []).map((q, qi) => {
      const ans = (s.answers || []).find(a => a.questionId === q.id);
      const userOpt = ans ? q.options.find(o => o.label === ans.selectedLabel) : null;
      const correctOpt = q.options.find(o => o.isCorrect);
      const icon = ans?.isCorrect
        ? '<span style="color:var(--vscode-charts-green,#89d185)">✓</span>'
        : '<span style="color:var(--vscode-charts-red,#f14c4c)">✗</span>';
      return `<div style="padding:8px 0;border-bottom:1px solid rgba(127,127,127,0.1)">
        <div style="font-size:13px;margin-bottom:4px">${icon} ${q.question}</div>
        <div style="font-size:12px;opacity:0.6">Your answer: ${userOpt ? userOpt.text : '—'}</div>
        ${!ans?.isCorrect ? `<div style="font-size:12px;color:var(--vscode-charts-green,#89d185)">Correct: ${correctOpt ? correctOpt.text : '—'}</div>` : ''}
        ${ans?.feedback ? `<div style="font-size:12px;opacity:0.7;margin-top:4px">${ans.feedback}</div>` : ''}
      </div>`;
    }).join('');
    return `<details style="margin-bottom:12px;border:1px solid rgba(127,127,127,0.2);border-radius:6px;padding:12px">
      <summary style="cursor:pointer;font-size:14px;font-weight:500">
        Session ${sorted.length - si} — ${date} &nbsp; <span style="opacity:0.7">${s.score ?? 0}% (${correct}/${total})</span>
      </summary>
      <div style="margin-top:12px">${qRows || '<p style="opacity:0.5">No question data.</p>'}</div>
    </details>`;
  }).join('');
}
```

In the `showReport` message handler, add:

```javascript
renderHistory(data.sessions);
```

- [ ] **Step 4: Build and verify**

```bash
node esbuild.config.mjs
```

Expected: `Build complete. Static assets copied`

---

## Task 5: Team Mode — Export & Import

**Files:**
- Modify: `src/extension.ts`
- Modify: `package.json`

- [ ] **Step 1: Register 2 new commands in `package.json`**

```json
{ "command": "vibeaudit.exportScores", "title": "VibeAudit: Export Scores (Team)" },
{ "command": "vibeaudit.importScores", "title": "VibeAudit: Import Team Scores" }
```

- [ ] **Step 2: Register commands in `extension.ts`**

Add to `context.subscriptions.push(...)`:

```typescript
vscode.commands.registerCommand('vibeaudit.exportScores', async () => {
  if (!requireWorkspace()) { return; }
  const data = stateManager.exportState();
  if (!data) {
    vscode.window.showWarningMessage('No scores to export. Complete a quiz first.');
    return;
  }
  const name = await vscode.window.showInputBox({ prompt: 'Your name (shown to teammates)', placeHolder: 'e.g. Alice' });
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
```

- [ ] **Step 3: Update `ReportPanel.show` to accept optional team imports**

In `src/ui/webview/reportPanel.ts`, update `show()` signature:

```typescript
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
```

Also update the constructor call in `show()` to match — the private constructor needs no changes, just call `sendReport(teamImports)` after creating.

Update `refresh()` and `sendReport()`:

```typescript
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
```

- [ ] **Step 4: Add "Team" tab to `report.html`**

In the `.tabs` div, after the History tab:

```html
<div class="tab" data-tab="team">Team</div>
```

After the History tab-content div:

```html
<div class="tab-content" id="tab-team">
  <div id="team-list"><p style="opacity:0.5">Import teammate score files to compare. Use "VibeAudit: Import Team Scores".</p></div>
</div>
```

- [ ] **Step 5: Add `renderTeam(teamImports)` to `report.js`**

```javascript
function renderTeam(teamImports) {
  const container = document.getElementById('team-list');
  if (!teamImports || teamImports.length === 0) {
    container.innerHTML = '<p style="opacity:0.5">Import teammate score files to compare. Use "VibeAudit: Import Team Scores".</p>';
    return;
  }
  container.innerHTML = teamImports.map(t => {
    const date = new Date(t.exportedAt).toLocaleDateString();
    const color = t.overallScore >= 81 ? 'var(--vscode-charts-blue,#75beff)'
      : t.overallScore >= 61 ? 'var(--vscode-charts-green,#89d185)'
      : t.overallScore >= 31 ? 'var(--vscode-charts-yellow,#cca700)'
      : 'var(--vscode-charts-red,#f14c4c)';
    const catRows = (t.categoryScores || []).map(c =>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:120px;font-size:12px">${c.category}</span>
        <div style="flex:1;height:8px;background:rgba(127,127,127,0.15);border-radius:4px;overflow:hidden">
          <div style="width:${c.score}%;height:100%;background:${color};border-radius:4px"></div>
        </div>
        <span style="font-size:12px;opacity:0.7;width:32px;text-align:right">${c.score}%</span>
      </div>`
    ).join('');
    return `<div style="border:1px solid rgba(127,127,127,0.2);border-radius:6px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:500">${t.exportedBy || 'Teammate'}</span>
        <span style="font-size:28px;font-weight:700;color:${color}">${t.overallScore}%</span>
      </div>
      <div style="font-size:12px;opacity:0.5;margin-bottom:10px">${t.sessionCount} sessions · exported ${date}</div>
      ${catRows}
    </div>`;
  }).join('');
}
```

In the `showReport` handler, add:

```javascript
renderTeam(data.teamImports);
```

- [ ] **Step 6: Type-check + build**

```bash
npx tsc --noEmit && node esbuild.config.mjs
```

Expected: 0 errors, `Build complete. Static assets copied`

---

## Task 6: Package + Verify

- [ ] **Step 1: Package VSIX**

```bash
npx vsce package
```

Expected: `DONE  Packaged: D:\VibeAudit\vibeaudit\vibeaudit-0.1.0.vsix`

- [ ] **Step 2: Manual smoke test checklist**

1. Install VSIX → Reload Window
2. `Ctrl+Alt+V` → QuickPick shows Adaptive/Easy/Normal/Hard
3. Complete quiz → open History tab → session appears with Q&A
4. Open a file → Command Palette → "VibeAudit: Pin File for Quiz Focus" → appears in Pinned Focus Files sidebar
5. "VibeAudit: Quiz Pinned Files Only" → quiz only asks about pinned file
6. "VibeAudit: Export Scores (Team)" → saves JSON
7. "VibeAudit: Import Team Scores" → import that JSON → Team tab shows score card

---

## Self-Review

**Spec coverage:**
- Quiz history: Task 4 ✓
- Team mode export/import: Task 5 ✓
- Custom question focus (pinned files): Task 3 ✓
- Difficulty override: Task 2 ✓

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:**
- `TeamExport` defined in Task 1, used in Tasks 2, 5 ✓
- `PinnedFile` defined in Task 1, used in Tasks 3 ✓
- `sendReport(teamImports?)` signature consistent across Tasks 4 and 5 ✓
- `startSession(focusArea?, pinnedFiles?)` consistent across Tasks 3 ✓
