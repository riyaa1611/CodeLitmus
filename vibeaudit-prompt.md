# VibeAudit — VS Code Extension | Claude Code Implementation Prompt

## Project Overview

Build "VibeAudit" — a VS Code extension that tests whether developers actually understand their own codebase. In the age of vibe coding (AI-generated code), developers ship code they never wrote and can't debug when it breaks. VibeAudit scans the open workspace, identifies critical code paths (auth, payments, data mutations, API routes, error handling), generates contextual quiz questions about the ACTUAL code using an LLM, scores the developer's answers, and surfaces dangerous blind spots — areas the developer doesn't understand that are high-risk.

This is NOT a code review tool. This is NOT a linter. This is a **developer self-assessment tool** that reveals the gap between "code that works" and "code you understand."

---

## Tech Stack (STRICT — do not deviate)

- **Language:** TypeScript (strict mode)
- **Runtime:** VS Code Extension API (engine: `^1.85.0`)
- **Bundler:** esbuild
- **LLM Provider:** OpenRouter API (REST calls via `fetch`, no SDKs, no LangChain)
- **Code Parsing:** VS Code built-in language services (DocumentSymbolProvider, CallHierarchyProvider) + custom regex-based AST-lite parsing for broader language support
- **Quiz UI:** Webview panel (plain HTML + CSS + vanilla JS, NO React/Vue/Svelte)
- **Report UI:** Webview panel (same approach)
- **Storage:** VS Code `ExtensionContext.globalState` for scores/history, `SecretStorage` for API key
- **CLI tooling:** `vsce` for packaging, `@vscode/test-electron` for testing

**Do NOT use:** React, Vue, Angular, Svelte, LangChain, any agent framework, any database, any backend server, any Docker, any cloud hosting.

---

## Project Structure

```
vibeaudit/
├── .vscode/
│   ├── launch.json                # Extension debug configuration
│   └── tasks.json                 # Build tasks
├── src/
│   ├── extension.ts               # Entry point — activates extension, registers all providers
│   ├── types.ts                   # All shared TypeScript interfaces and types
│   │
│   ├── analyzer/
│   │   ├── workspaceScanner.ts    # Recursively scans workspace files, respects .gitignore
│   │   ├── languageDetector.ts    # Detects project language, framework, and stack
│   │   ├── symbolExtractor.ts    # Extracts functions, classes, exports, imports from files
│   │   ├── criticalPathFinder.ts  # Identifies high-risk code: auth, payments, DB writes, error handling, API routes
│   │   ├── dependencyMapper.ts    # Maps cross-file dependencies: function A in file X calls function B in file Y
│   │   └── complexityScorer.ts    # Scores each file/function by risk level (1-10)
│   │
│   ├── llm/
│   │   ├── openRouterClient.ts    # OpenRouter API client — handles requests, retries, rate limiting, streaming
│   │   ├── promptTemplates.ts     # All prompt templates for analysis, question generation, answer evaluation
│   │   └── responseParser.ts      # Parses LLM JSON responses, validates structure, handles malformed responses
│   │
│   ├── quiz/
│   │   ├── quizEngine.ts          # Orchestrates full quiz flow: select questions → present → collect answers → score
│   │   ├── questionGenerator.ts   # Sends code chunks + context to LLM, generates quiz questions
│   │   ├── answerEvaluator.ts     # Sends user answer + code context to LLM, evaluates correctness + understanding depth
│   │   ├── difficultyManager.ts   # Adaptive difficulty: adjusts question complexity based on performance
│   │   └── sessionManager.ts      # Manages quiz sessions: start, pause, resume, complete
│   │
│   ├── scoring/
│   │   ├── scoreCalculator.ts     # Calculates per-file, per-module, and overall understanding scores
│   │   ├── dangerZoneDetector.ts  # Cross-references low scores with high-risk code to find dangerous blind spots
│   │   └── progressTracker.ts     # Tracks score history over time, calculates improvement trends
│   │
│   ├── ui/
│   │   ├── sidebarProvider.ts     # TreeView sidebar: file explorer with understanding scores (red/yellow/green)
│   │   ├── codeLensProvider.ts    # CodeLens: inline annotations above functions ("⚠️ Not audited" / "✅ 90% understood")
│   │   ├── statusBarManager.ts    # Status bar item: "VibeAudit: 42% understood" with click to open report
│   │   ├── diagnosticsProvider.ts # Inline warnings on danger zone lines (like ESLint warnings)
│   │   ├── hoverProvider.ts       # Hover over any function → see its audit status and last quiz score
│   │   └── webview/
│   │       ├── quizPanel.ts       # Creates and manages the quiz webview panel
│   │       ├── reportPanel.ts     # Creates and manages the report webview panel
│   │       ├── onboardingPanel.ts # First-time setup: API key input, project scan, welcome screen
│   │       ├── templates/
│   │       │   ├── quiz.html      # Quiz UI template
│   │       │   ├── report.html    # Report dashboard template
│   │       │   ├── onboarding.html# Onboarding/setup template
│   │       │   └── styles.css     # Shared styles for all webviews
│   │       └── scripts/
│   │           ├── quiz.js        # Quiz webview client-side logic (handles postMessage)
│   │           ├── report.js      # Report webview client-side logic
│   │           └── onboarding.js  # Onboarding webview client-side logic
│   │
│   ├── storage/
│   │   ├── stateManager.ts        # Wraps globalState for typed access to all persisted data
│   │   └── apiKeyManager.ts       # Manages OpenRouter API key via SecretStorage (encrypted)
│   │
│   └── utils/
│       ├── fileUtils.ts           # File reading, .gitignore parsing, language detection by extension
│       ├── codeChunker.ts         # Splits large files into LLM-friendly chunks with context preservation
│       └── constants.ts           # All magic strings, default configs, supported languages
│
├── media/
│   ├── icon.png                   # Extension icon (128x128)
│   ├── sidebar-icon.svg           # Sidebar view icon
│   └── screenshots/               # Marketplace screenshots
│
├── package.json                   # Extension manifest with ALL contribution points
├── tsconfig.json
├── esbuild.config.mjs
├── .vscodeignore
├── CHANGELOG.md
├── LICENSE
└── README.md                      # Marketplace README with screenshots, features, usage
```

---

## Detailed Feature Specifications

### Feature 1: Workspace Analysis (Analyzer Module)

**Trigger:** User runs command `VibeAudit: Scan Workspace` from command palette, or automatically on first activation if workspace is open.

**Behavior:**

1. `workspaceScanner.ts` recursively walks the workspace:
   - Respects `.gitignore` patterns (use `vscode.workspace.findFiles` with exclude globs)
   - Skips: `node_modules/`, `dist/`, `build/`, `.next/`, `__pycache__/`, `venv/`, `.git/`, binary files, image files, lock files
   - Supported file extensions for MVP: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`
   - Collects: file paths, file sizes, line counts

2. `languageDetector.ts` analyzes the workspace:
   - Checks `package.json` for framework detection (Next.js, Express, React, Fastify, Django, Flask, FastAPI)
   - Checks `requirements.txt` / `pyproject.toml` for Python framework detection
   - Checks for common config files: `next.config.js`, `tsconfig.json`, `prisma/schema.prisma`, `.env`
   - Returns a `ProjectProfile` object: `{ primaryLanguage, framework, hasAuth, hasPayments, hasDatabase, hasTesting }`

3. `symbolExtractor.ts` extracts code symbols from each file:
   - Uses `vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri)` to get functions, classes, interfaces, variables
   - For each symbol: name, kind (function/class/variable), range (start line, end line), children
   - Falls back to regex-based extraction if VS Code language services aren't available for the file type
   - Regex patterns for Python: `def `, `class `, `async def `
   - Regex patterns for JS/TS: `function `, `const .* = `, `export `, `class `, `async `

4. `criticalPathFinder.ts` identifies high-risk code areas:
   - **Auth patterns:** files/functions containing keywords: `auth`, `login`, `signup`, `register`, `password`, `token`, `jwt`, `session`, `oauth`, `middleware`, `verify`, `hash`, `bcrypt`, `passport`
   - **Payment patterns:** `payment`, `stripe`, `razorpay`, `checkout`, `billing`, `subscription`, `invoice`, `charge`, `refund`, `webhook`
   - **Database mutation patterns:** `create`, `update`, `delete`, `remove`, `destroy`, `insert`, `mutation`, `migrate`, `prisma`, `mongoose`, `sequelize`, `sql`, `query`
   - **Error handling patterns:** `try`, `catch`, `throw`, `error`, `reject`, `finally`, files with error/exception in name
   - **API route patterns:** files in `routes/`, `api/`, `controllers/`, `endpoints/`, or containing route decorators (`@app.route`, `router.get`, `app.post`)
   - **Security patterns:** `cors`, `helmet`, `csrf`, `sanitize`, `validate`, `encrypt`, `decrypt`, `secret`, `env`
   - Each detected area gets a `riskLevel` score from 1-10 based on: how many patterns matched + whether it has error handling + whether it has tests covering it

5. `dependencyMapper.ts` traces cross-file dependencies:
   - Parses import/require statements to build a dependency graph
   - For critical functions, traces what calls them and what they call
   - Returns a `DependencyGraph` where each node has: `file`, `function`, `calledBy[]`, `calls[]`, `riskLevel`

6. `complexityScorer.ts` assigns a final complexity score to each file/function:
   - Factors: line count, nesting depth (counted via indentation/braces), number of branches (if/else/switch), number of dependencies, risk level from critical path analysis
   - Output: `{ file, function, complexityScore, riskLevel, isAudited, lastAuditScore }`

**Output:** A `WorkspaceAnalysis` object stored in `globalState`:
```typescript
interface WorkspaceAnalysis {
  projectProfile: ProjectProfile;
  files: AnalyzedFile[];
  criticalPaths: CriticalPath[];
  dependencyGraph: DependencyNode[];
  totalFiles: number;
  totalFunctions: number;
  totalCriticalFunctions: number;
  scanTimestamp: number;
}
```

Show a progress notification during scan: "VibeAudit: Scanning workspace... (24/87 files)"

---

### Feature 2: Quiz Generation & Flow (Quiz Module)

**Trigger:** User runs `VibeAudit: Start Quiz` from command palette, or clicks "Start Quiz" from sidebar, or clicks a CodeLens "Audit this function."

**Question Generation Process:**

1. `questionGenerator.ts` selects code to quiz on:
   - Priority order: critical paths first (highest risk, lowest audit score), then recently modified files, then unaudited files
   - For each selected function/code block, extracts the full source code + surrounding context (imports, related functions)

2. Sends to LLM via `openRouterClient.ts` with this prompt structure (defined in `promptTemplates.ts`):

```
SYSTEM PROMPT:
You are VibeAudit, a code understanding assessment engine. You generate quiz questions that test whether a developer truly understands their own code — not general programming knowledge.

Rules:
- Questions must be SPECIFIC to the provided code. Never ask generic programming questions.
- Focus on: edge cases, error scenarios, data flow, "what happens when X fails?", security implications, performance gotchas, implicit assumptions.
- Every question should be something the developer CANNOT answer correctly unless they genuinely understand the code.
- Generate questions at the specified difficulty level (1-5).
- Return ONLY valid JSON.

USER PROMPT:
Project context:
- Framework: {framework}
- Language: {language}
- This file handles: {fileDescription}

Code to quiz on:
```{language}
{codeBlock}
```

Related code (imported/called by this code):
```{language}
{relatedCode}
```

Generate exactly {count} multiple-choice questions about this code.
Difficulty level: {difficulty}/5

Return JSON in this exact format:
{
  "questions": [
    {
      "id": "q1",
      "question": "The actual question text",
      "difficulty": 3,
      "category": "error-handling" | "security" | "data-flow" | "edge-case" | "architecture" | "performance",
      "codeReference": {
        "file": "relative/path/to/file.ts",
        "startLine": 45,
        "endLine": 52
      },
      "options": [
        {"label": "A", "text": "Option A text", "isCorrect": false},
        {"label": "B", "text": "Option B text", "isCorrect": true},
        {"label": "C", "text": "Option C text", "isCorrect": false},
        {"label": "D", "text": "Option D text", "isCorrect": false}
      ],
      "explanation": "Detailed explanation of why the correct answer is correct and why others are wrong, referencing specific lines of code",
      "dangerNote": "If the developer gets this wrong, here's the real-world consequence (e.g., 'Users could be charged without their order being created')"
    }
  ]
}
```

3. `responseParser.ts` validates the LLM response:
   - Tries to parse JSON from the response (strip markdown code fences if present)
   - Validates all required fields exist
   - Validates exactly one option has `isCorrect: true`
   - If parsing fails, retry once with a simpler prompt
   - If retry fails, skip this code block and move to next

**Quiz Flow (managed by `quizEngine.ts`):**

1. Quiz starts → show quiz webview panel (split editor: code on left, quiz on right)
2. Present one question at a time
3. When a question references specific code lines, send a message to the extension host to highlight those lines in the editor (using `TextEditorDecorationType`)
4. User selects an answer in the webview → webview sends answer via `postMessage` to extension
5. Extension sends answer + original code + question to LLM for evaluation via `answerEvaluator.ts`

**Answer Evaluation Prompt:**
```
The developer was asked:
"{question}"

About this code:
```{language}
{code}
```

They answered: "{userAnswer}"
Correct answer: "{correctAnswer}"

Evaluate their understanding. Return JSON:
{
  "isCorrect": boolean,
  "understandingDepth": "surface" | "moderate" | "deep",
  "feedback": "Specific feedback about their understanding or misunderstanding",
  "conceptGap": "If wrong, what specific concept they're missing (or null if correct)"
}
```

6. Show result immediately in the webview: correct/wrong, explanation, danger note if applicable
7. After all questions, show session summary
8. Save results to `globalState`

**Adaptive Difficulty (`difficultyManager.ts`):**
- Start at difficulty 3/5
- If developer gets 3 in a row correct → increase difficulty
- If developer gets 2 in a row wrong → decrease difficulty
- Never go below 1 or above 5

**Quiz Session Structure:**
```typescript
interface QuizSession {
  id: string;
  startTime: number;
  endTime?: number;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score: number;
  totalQuestions: number;
  focusArea?: string; // "auth", "payments", etc. — if user chose specific focus
  difficulty: number;
}
```

---

### Feature 3: Scoring & Reports (Scoring Module)

**`scoreCalculator.ts`:**
- Per-function score: percentage of questions about that function answered correctly
- Per-file score: weighted average of function scores (critical functions weighted 2x)
- Per-module score: average of file scores in that directory
- Overall score: weighted average (critical path scores weighted 3x, other scores weighted 1x)

**`dangerZoneDetector.ts`:**
- A "danger zone" = code that has BOTH:
  - High risk level (≥ 7/10 from critical path analysis) AND
  - Low understanding score (≤ 40% quiz accuracy)
- These are the most dangerous blind spots — code that matters AND the developer doesn't understand
- Sort by: `riskLevel * (1 - understandingScore)` — highest product = most dangerous

**`progressTracker.ts`:**
- Stores all quiz session results with timestamps
- Calculates: score trend over time, improvement rate, most improved areas, still-weak areas
- Detects if a developer's understanding is degrading (e.g., they haven't audited in weeks and codebase changed)

**Report Webview (`reportPanel.ts` + `report.html`):**

The report dashboard shows:

1. **Overall Understanding Score** — large, prominent number with color coding:
   - 0-30%: Red, "🔴 Critical — you're flying blind"
   - 31-60%: Yellow, "🟡 Partial — dangerous gaps exist"
   - 61-80%: Green, "🟢 Solid — some blind spots remain"
   - 81-100%: Blue, "🔵 Deep — you own this codebase"

2. **Module/Directory Breakdown** — horizontal bar chart showing score per directory

3. **Danger Zones** — list of critical code areas with low understanding, each clickable → opens the file at that line

4. **Category Breakdown** — radar/spider chart:
   - Auth Understanding: X%
   - Payment Understanding: X%
   - Error Handling Understanding: X%
   - Data Flow Understanding: X%
   - API Understanding: X%

5. **Progress Timeline** — line chart showing overall score over time (dates on X axis, score on Y axis)

6. **Learning Path** — ordered list of specific files to study, generated by the LLM based on danger zones:
   ```
   LLM PROMPT: Given these danger zones in the codebase:
   {dangerZones}
   
   Generate a prioritized learning path. For each item, specify:
   - Which file to read
   - Which specific lines to focus on
   - What concept to understand
   - Why it matters (real-world consequence of not understanding it)
   
   Return JSON array ordered by priority.
   ```

**Design the report webview with:**
- Dark theme that matches VS Code's default dark theme (use `--vscode-editor-background`, `--vscode-editor-foreground` CSS variables)
- Clean, minimal layout — no clutter
- Charts rendered with pure SVG (no charting library needed for simple bar charts and line charts)
- Smooth transitions when switching between sections
- All data sections clickable — clicking a file/function opens it in the editor

---

### Feature 4: VS Code UI Integration

**Sidebar (TreeView — `sidebarProvider.ts`):**
- Registers a view container with id `vibeaudit-sidebar` in the Activity Bar (left icon bar)
- Custom icon: a shield or brain icon (SVG in `media/`)
- Tree structure mirrors the file explorer but with understanding indicators:
  ```
  📁 src/
    📁 api/
      🔴 checkout.ts (15%)
      🟡 users.ts (55%)
      🟢 health.ts (92%)
    📁 auth/
      🔴 middleware.ts (20%)
      🟡 jwt.ts (45%)
    📁 utils/
      🟢 formatters.ts (88%)
      ⚪ helpers.ts (not audited)
  ```
- Each file node shows: filename, score percentage, colored icon
- Right-click context menu: "Audit this file", "View report for this file"
- Click on a file → opens it in editor

**CodeLens (`codeLensProvider.ts`):**
- Shows annotations above every function in critical paths:
  - Unaudited: `⚠️ VibeAudit: Not audited yet | Click to audit`
  - Low score: `🔴 VibeAudit: 20% understood | Re-audit`
  - Medium score: `🟡 VibeAudit: 55% understood | Re-audit`
  - High score: `🟢 VibeAudit: 90% understood`
- Clicking the CodeLens opens the quiz panel focused on that specific function
- Only shows CodeLens for files that have been scanned (don't show for unscanned files)

**Status Bar (`statusBarManager.ts`):**
- Left side of status bar: `$(shield) VibeAudit: 42%`
- Color matches score (red/yellow/green)
- Click → opens the full report webview
- Tooltip on hover: "Overall codebase understanding: 42%. Click to view full report."

**Diagnostics (`diagnosticsProvider.ts`):**
- For danger zone lines, show inline information diagnostics (blue underline, like VS Code's info hints)
- Message: "VibeAudit: You scored 15% on understanding this function. This handles payment processing."
- Severity: `DiagnosticSeverity.Information` (not error or warning — this isn't a code problem, it's a knowledge gap)

**Hover Provider (`hoverProvider.ts`):**
- When hovering over any function that has been audited, show a hover card:
  ```
  VibeAudit Score: 45% (3/7 questions correct)
  Risk Level: High (payment processing)
  Last audited: 3 days ago
  
  [Re-audit] [View questions]
  ```

---

### Feature 5: Onboarding & Settings

**First Launch (`onboardingPanel.ts`):**
1. Detect this is first activation (check `globalState` for `vibeaudit.initialized`)
2. Open onboarding webview:
   - Welcome message explaining what VibeAudit does (2-3 sentences, not a wall of text)
   - Input field for OpenRouter API key with link to get one: "Get your free API key at https://openrouter.ai/keys"
   - "Scan Workspace" button
   - API key gets stored in `SecretStorage`
3. After key is entered and scan completes, close onboarding and show the sidebar + status bar

**Extension Settings (contributes.configuration in package.json):**
```json
{
  "vibeaudit.llmModel": {
    "type": "string",
    "default": "deepseek/deepseek-chat-v3-0324:free",
    "description": "OpenRouter model to use for quiz generation",
    "enum": [
      "deepseek/deepseek-chat-v3-0324:free",
      "meta-llama/llama-3.3-8b-instruct:free",
      "mistralai/mistral-small-3.1-24b-instruct:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen3-32b:free"
    ]
  },
  "vibeaudit.questionsPerSession": {
    "type": "number",
    "default": 5,
    "minimum": 3,
    "maximum": 15,
    "description": "Number of questions per quiz session"
  },
  "vibeaudit.autoScanOnOpen": {
    "type": "boolean",
    "default": true,
    "description": "Automatically scan workspace when opened"
  },
  "vibeaudit.showCodeLens": {
    "type": "boolean",
    "default": true,
    "description": "Show VibeAudit CodeLens annotations above functions"
  },
  "vibeaudit.supportedLanguages": {
    "type": "array",
    "default": ["typescript", "javascript", "python"],
    "description": "Languages to analyze"
  }
}
```

**Commands (contributes.commands in package.json):**
- `vibeaudit.scanWorkspace` — "VibeAudit: Scan Workspace"
- `vibeaudit.startQuiz` — "VibeAudit: Start Quiz"
- `vibeaudit.startFocusedQuiz` — "VibeAudit: Quiz on Current File"
- `vibeaudit.showReport` — "VibeAudit: Show Report"
- `vibeaudit.showDangerZones` — "VibeAudit: Show Danger Zones"
- `vibeaudit.setApiKey` — "VibeAudit: Set OpenRouter API Key"
- `vibeaudit.resetScores` — "VibeAudit: Reset All Scores"

**Keybindings:**
- `Ctrl+Shift+V` (or `Cmd+Shift+V` on Mac): Start Quiz
- `Ctrl+Shift+R`: Show Report

---

### Feature 6: OpenRouter LLM Client

**`openRouterClient.ts`:**

```typescript
// Configuration
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Request function with retry logic
async function chatCompletion(
  messages: {role: string, content: string}[],
  config: OpenRouterConfig
): Promise<string> {
  // Implementation requirements:
  // 1. Set headers: Authorization: Bearer {apiKey}, HTTP-Referer: https://github.com/vibeaudit, X-Title: VibeAudit
  // 2. Retry up to 2 times on 429 (rate limit) with exponential backoff (1s, 3s)
  // 3. Retry once on 500/502/503
  // 4. Timeout after 30 seconds
  // 5. If all retries fail, throw a user-friendly error
  // 6. Log token usage from response headers for monitoring
}
```

- Always request JSON mode in the API call: `response_format: { type: "json_object" }`
- Default model: `deepseek/deepseek-chat-v3-0324:free` (best free model for code understanding)
- Temperature: `0.3` for question generation (focused but not deterministic), `0.1` for answer evaluation (more deterministic)

---

## package.json Extension Manifest

The `package.json` must include all of the following contribution points:

```json
{
  "name": "vibeaudit",
  "displayName": "VibeAudit — Do You Understand Your Own Code?",
  "description": "AI-powered codebase understanding assessment. Stop vibe coding blindly — find out what you actually know.",
  "version": "0.1.0",
  "publisher": "riyaa1611",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Testing", "Education", "Other"],
  "keywords": ["vibe coding", "code understanding", "quiz", "ai", "assessment", "audit", "learning"],
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "icon": "media/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/riyaa1611/vibeaudit"
  },
  "contributes": {
    "commands": [],
    "configuration": {},
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vibeaudit",
          "title": "VibeAudit",
          "icon": "media/sidebar-icon.svg"
        }
      ]
    },
    "views": {
      "vibeaudit": [
        {
          "id": "vibeaudit.fileScores",
          "name": "Understanding Scores"
        },
        {
          "id": "vibeaudit.dangerZones",
          "name": "Danger Zones"
        }
      ]
    },
    "menus": {},
    "keybindings": []
  }
}
```

Fill in all the contribution points fully based on the commands, settings, and features described above.

---

## Webview UI Design Direction

**Overall aesthetic:** Dark, minimal, developer-focused. Think "VS Code native" — it should feel like a built-in feature, not a third-party plugin.

**Use VS Code CSS variables for theming** (these automatically match the user's VS Code theme):
- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-button-background`
- `--vscode-button-foreground`
- `--vscode-badge-background`
- `--vscode-charts-red`
- `--vscode-charts-yellow`
- `--vscode-charts-green`
- `--vscode-charts-blue`
- `--vscode-input-background`
- `--vscode-input-border`
- `--vscode-input-foreground`
- `--vscode-focusBorder`

**Quiz Panel Layout:**
- Question number and progress bar at the top (e.g., "Question 3 of 5")
- Question text (large, readable)
- Code reference (monospace, highlighted, scrollable)
- Four options as clickable cards (hover effect, selected state)
- "Submit" button
- After submit: show result (correct/wrong with animated checkmark/cross), explanation text, danger note if applicable, "Next Question" button
- After quiz complete: show session summary with score and option to "View Full Report"

**Report Panel Layout:**
- Top hero section: large score number with circular progress ring (SVG animated)
- Below: tabbed sections — "Overview", "Danger Zones", "Progress", "Learning Path"
- Overview tab: module breakdown bars + category radar chart
- Danger Zones tab: clickable list with red badges
- Progress tab: timeline chart
- Learning Path tab: ordered steps with file links

**All webview communication via postMessage:**
```typescript
// Extension → Webview
webview.postMessage({ type: 'showQuestion', data: question });
webview.postMessage({ type: 'showResult', data: result });
webview.postMessage({ type: 'showReport', data: reportData });

// Webview → Extension
vscode.postMessage({ type: 'submitAnswer', data: { questionId, selectedOption } });
vscode.postMessage({ type: 'openFile', data: { filePath, lineNumber } });
vscode.postMessage({ type: 'startQuiz', data: { focusArea } });
```

---

## Implementation Order (Build in this sequence)

### Phase 1: Foundation
1. Scaffold the extension project with `yo code` or manually create the structure
2. Set up esbuild bundling
3. Set up `.vscode/launch.json` for Extension Development Host debugging
4. Implement `extension.ts` — register commands, activate/deactivate
5. Implement `apiKeyManager.ts` — store/retrieve API key from SecretStorage
6. Implement `openRouterClient.ts` — test with a simple ping to verify API connectivity
7. Implement basic `onboardingPanel.ts` — API key input + save

### Phase 2: Analysis Engine
8. Implement `workspaceScanner.ts`
9. Implement `languageDetector.ts`
10. Implement `symbolExtractor.ts`
11. Implement `criticalPathFinder.ts`
12. Implement `complexityScorer.ts`
13. Implement `dependencyMapper.ts`
14. Test: scan a real project and verify the analysis output makes sense

### Phase 3: Quiz Core
15. Implement `promptTemplates.ts` — all LLM prompts
16. Implement `responseParser.ts` — JSON parsing with error handling
17. Implement `questionGenerator.ts` — generate questions for a code block
18. Implement `answerEvaluator.ts` — evaluate user answers
19. Implement `quizEngine.ts` — full quiz flow orchestration
20. Implement `difficultyManager.ts`
21. Implement `sessionManager.ts`

### Phase 4: Quiz UI
22. Implement `quizPanel.ts` + `quiz.html` + `quiz.js` + `styles.css`
23. Wire up postMessage communication between extension and webview
24. Test: complete a full quiz session end-to-end

### Phase 5: Scoring & Storage
25. Implement `stateManager.ts`
26. Implement `scoreCalculator.ts`
27. Implement `dangerZoneDetector.ts`
28. Implement `progressTracker.ts`

### Phase 6: Report UI
29. Implement `reportPanel.ts` + `report.html` + `report.js`
30. Build all charts with pure SVG
31. Wire up clickable elements → open files in editor

### Phase 7: VS Code Native UI
32. Implement `sidebarProvider.ts` — TreeView with file scores
33. Implement `codeLensProvider.ts` — inline annotations
34. Implement `statusBarManager.ts` — bottom bar score
35. Implement `diagnosticsProvider.ts` — inline info hints
36. Implement `hoverProvider.ts` — hover cards

### Phase 8: Polish & Publish
37. Add extension icon and sidebar icon
38. Write comprehensive README.md for VS Code Marketplace
39. Add screenshots to README
40. Test on a real-world project (use any popular open source repo)
41. Package with `vsce package`
42. Publish with `vsce publish`

---

## Error Handling Requirements

- **No API key:** Show onboarding panel, don't crash
- **Invalid API key:** Show clear error message with link to get a new key
- **Rate limited (429):** Retry with backoff, show "Rate limited, retrying in {n}s..." notification
- **LLM returns malformed JSON:** Retry once with simpler prompt, skip if still fails
- **Empty workspace:** Show "Open a project folder to use VibeAudit"
- **No supported files found:** Show "No TypeScript, JavaScript, or Python files found in this workspace"
- **Very large workspace (1000+ files):** Scan only `src/`, `app/`, `pages/`, `lib/`, `api/` directories by default, let user configure
- **Network offline:** Detect before API call, show offline message

Every error should surface as a VS Code notification (`vscode.window.showErrorMessage` or `vscode.window.showWarningMessage`), never a silent failure. Never crash the extension — always catch and display.

---

## Testing Strategy

- Use `@vscode/test-electron` for integration tests
- Test the analyzer on a known project structure (include a `test-fixtures/` directory with sample projects)
- Test LLM prompt/response parsing with mocked responses
- Test scoring calculations with known inputs
- Test webview postMessage communication

---

## README.md for VS Code Marketplace

Write a compelling README that includes:
1. One-line hook: "Do you actually understand your own code? Find out."
2. Problem statement (2 sentences about vibe coding blind spots)
3. Feature list with screenshots (use placeholder paths)
4. Installation instructions
5. Quick start guide (3 steps)
6. How scoring works (brief)
7. Supported languages
8. Privacy note: "Your code is sent to OpenRouter for analysis. No code is stored. You control which LLM model is used."
9. Link to GitHub repo
10. License: MIT

---

## Critical Constraints

- **NEVER send the entire codebase to the LLM in one request.** Always chunk. Max ~2000 lines of code per LLM call. Send only the relevant function + its immediate dependencies.
- **ALWAYS validate LLM JSON responses.** LLMs return malformed JSON frequently. Handle gracefully.
- **ALWAYS use VS Code CSS variables for webview theming.** The extension must look native in any VS Code theme (light, dark, high contrast).
- **NEVER block the extension host.** All LLM calls must be async. Show loading indicators during API calls.
- **ALWAYS respect .gitignore.** Never scan files the developer has excluded.
- **Store API key in SecretStorage only.** Never in globalState, never in settings.json, never in plain text.

---

Now build the entire extension end-to-end following this specification exactly. Start from Phase 1 and work through to Phase 8. Commit working code at the end of each phase. Test each phase before moving to the next.
