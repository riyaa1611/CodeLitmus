# VibeAudit — Do You Understand Your Own Code?

**Codebase understanding assessment for VS Code. Works offline, zero API key required.**

> Stop vibe coding blindly. Find out what you actually know — before it breaks in production.

---

## The Problem

AI writes your code. You ship it. It works — until it doesn't. When it breaks, you have no idea why, because you never actually understood it.

VibeAudit reveals the gap between *code that runs* and *code you understand*. It finds the dangerous blind spots in your own codebase — especially the high-risk parts (auth, payments, database mutations) that you copied from AI and hoped for the best.

---

## How It Works

1. **Scan** — VibeAudit walks your workspace and identifies critical code paths (auth, payments, DB writes, API routes, error handling, security)
2. **Quiz** — Static analysis detects real anti-patterns in YOUR code and generates questions from them. No LLM required — questions are derived directly from the AST. Add an OpenRouter key for AI-enhanced explanations.
3. **Score** — Every file and function gets an understanding score (0–100%). Critical code is weighted higher
4. **Danger Zones** — High-risk code × low understanding score = danger zone. These are the things most likely to break in production while you stare helplessly at the logs

---

## Features

### Workspace Analysis
- Recursively scans TypeScript, JavaScript, and Python files
- Detects frameworks: Next.js, Express, Fastify, Django, Flask, FastAPI
- Identifies critical patterns: auth, payments, DB mutations, API routes, error handling, security
- Respects `.gitignore`, skips `node_modules`, `dist`, `build`, etc.
- Risk scoring (1–10) per file based on matched patterns

### Quiz Engine (works offline, no API key needed)
- **Static analysis is the primary source** — detects 12 anti-pattern types directly from your code
- Detected patterns: missing error handling, silent catch, unchecked parameters, unhandled async, SQL injection risk, hardcoded secrets, missing input validation, error swallowing, exposed internal errors, dead code, missing await, inconsistent return types
- Questions are provably correct — answers are computed from the AST, not hallucinated by an LLM
- **Optional:** Add an OpenRouter API key to get AI-enhanced explanations when local analysis finds no patterns
- Questions focus on: edge cases, error scenarios, data flow, security implications, "what happens when X fails?"
- Difficulty selection before each quiz: Adaptive / Easy / Normal / Hard
- Adaptive mode gets harder when you're right, easier when you're struggling

### Understanding Scores
- Per-file score: % of questions answered correctly
- Per-category score: auth, payments, error handling, data flow, API
- Overall score: weighted average (critical paths count 3×)
- Progress timeline: track improvement over time

### Quiz History
- Full session history in the Report dashboard
- Review every past question — see what you answered, the correct answer, and AI feedback
- Sessions sorted newest-first, collapsible per-session view

### Pinned File Focus
- Pin any file for targeted quizzing: `VibeAudit: Pin File for Quiz Focus`
- Run `VibeAudit: Quiz Pinned Files Only` to quiz only your pinned files
- Pinned files shown in dedicated sidebar panel

### Team Mode
- Export your scores as a JSON file: `VibeAudit: Export Scores (Team)`
- Import teammates' score files: `VibeAudit: Import Team Scores`
- Side-by-side score comparison in the Report → Team tab

### Danger Zone Detection
- Cross-references high risk (≥7/10) with low understanding (≤40%)
- Sorted by `riskLevel × (1 − understanding)` — highest = most dangerous
- Inline VS Code diagnostics on danger zone lines
- Clickable in sidebar and report

### VS Code Native UI
| Component | What it shows |
|-----------|--------------|
| **Status Bar** | `VibeAudit: 42%` — click to open report |
| **Sidebar** | File tree with color-coded scores per file |
| **Danger Zones panel** | Sorted list of critical blind spots |
| **Pinned Files panel** | Files pinned for focused quizzing |
| **CodeLens** | Inline annotation above every audited function |
| **Diagnostics** | Blue underline on danger zone lines (like ESLint) |
| **Hover cards** | Hover any function → see audit score + risk level |

### Report Dashboard
- Large overall score with animated ring
- Module breakdown bar charts (pure SVG, no library)
- Category breakdown by area
- Progress timeline across sessions
- Quiz history with full Q&A review
- Team comparison tab
- Personalized learning path (ordered by danger score)

---

## Installation

### From Marketplace
Search "VibeAudit" in the VS Code Extensions panel.

### From VSIX (local)
```bash
code --install-extension vibeaudit-0.1.0.vsix
```

---

## Quick Start

1. **Open a project folder** in VS Code — no API key needed
2. VibeAudit auto-scans on first launch (or run `VibeAudit: Scan Workspace` manually)
3. Press `Ctrl+Alt+V` (or `Cmd+Alt+V` on Mac) to start a quiz immediately
4. Press `Ctrl+Alt+R` to view your full report

**Optional:** Add an OpenRouter API key (`VibeAudit: Set OpenRouter API Key`) to get AI-generated explanations when static analysis finds no patterns in a file.

### Commands (Command Palette)
| Command | Description |
|---------|-------------|
| `VibeAudit: Scan Workspace` | Analyze all files and detect critical paths |
| `VibeAudit: Start Quiz` | Take a quiz across all critical paths |
| `VibeAudit: Quiz on Current File` | Quiz focused on the file you have open |
| `VibeAudit: Quiz Pinned Files Only` | Quiz only your pinned files |
| `VibeAudit: Pin File for Quiz Focus` | Pin the current file for focused quizzing |
| `VibeAudit: Unpin File` | Remove a file from pinned list |
| `VibeAudit: Show Report` | Open the full dashboard |
| `VibeAudit: Show Danger Zones` | Jump to danger zones in the report |
| `VibeAudit: Export Scores (Team)` | Export your scores as JSON to share |
| `VibeAudit: Import Team Scores` | Import teammates' score files for comparison |
| `VibeAudit: Set OpenRouter API Key` | Update your API key |
| `VibeAudit: Reset All Scores` | Clear all quiz history |

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+V` / `Cmd+Alt+V` | Start Quiz |
| `Ctrl+Alt+R` | Show Report |

---

## Understanding the Score

| Score | Label | What it means |
|-------|-------|---------------|
| 0–30% | Critical | Flying blind — dangerous gaps in high-risk code |
| 31–60% | Partial | Dangerous gaps exist — some critical areas not understood |
| 61–80% | Solid | Good understanding — some blind spots remain |
| 81–100% | Deep | You own this codebase |

### What Makes a Danger Zone?
A file/function is a **danger zone** when it has BOTH:
- **Risk >= 7/10** (auth, payments, DB writes, security patterns detected)
- **Understanding <= 40%** (you got most quiz questions wrong)

The danger score formula: `riskLevel × (1 − understandingScore)`. Higher = more dangerous.

---

## Configuration

Settings available under `vibeaudit.*` in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `vibeaudit.llmModel` | `deepseek/deepseek-chat-v3-0324:free` | OpenRouter model for quiz generation |
| `vibeaudit.questionsPerSession` | `10` | Questions per quiz session (3–15) |
| `vibeaudit.difficultyOverride` | `0` | Fixed difficulty (1=Easy, 3=Normal, 5=Hard). 0 = prompt each time |
| `vibeaudit.autoScanOnOpen` | `true` | Auto-scan workspace on open |
| `vibeaudit.showCodeLens` | `true` | Show CodeLens annotations above functions |
| `vibeaudit.supportedLanguages` | `["typescript","javascript","python"]` | Languages to analyze |

### Recommended Free Models
These work well as of April 2026. Browse the latest at [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free).

| Model ID | Notes |
|----------|-------|
| `deepseek/deepseek-chat-v3-0324:free` | Best code understanding on free tier |
| `meta-llama/llama-3.3-8b-instruct:free` | Fast, good for quick quizzes |
| `qwen/qwen3-32b:free` | Strong multilingual + code support |
| `google/gemma-3-27b-it:free` | Good balance of speed and quality |

The `vibeaudit.llmModel` setting accepts any model ID — type any ID from the OpenRouter catalog. If your configured model is removed or renamed, VibeAudit will prompt you to select a new one.

---

## Supported Languages & Frameworks

**Languages:** TypeScript, JavaScript (including JSX/TSX), Python

**Auto-detected frameworks:**
- Next.js, React, Express, Fastify (JS/TS)
- Django, Flask, FastAPI (Python)

**Critical pattern detection:**
- Auth: `jwt`, `bcrypt`, `passport`, `session`, `oauth`, `token`
- Payments: `stripe`, `checkout`, `billing`, `webhook`, `subscription`
- Database: `prisma`, `mongoose`, `sequelize`, `sql`, `mutation`
- Security: `cors`, `helmet`, `csrf`, `sanitize`, `encrypt`
- API routes: files in `routes/`, `api/`, `controllers/`
- Error handling: `try/catch`, `throw`, `reject`

---

## Tech Stack

- **Runtime:** VS Code Extension API (^1.85.0)
- **Language:** TypeScript (strict mode)
- **Bundler:** esbuild
- **Static analysis:** Regex-based AST extraction — zero native dependencies, works offline
- **LLM (optional):** OpenRouter REST API (no SDKs, plain `fetch`) — only used as fallback
- **UI:** Plain HTML + CSS + vanilla JS webviews (no React/Vue)
- **Charts:** Pure SVG (no charting library)
- **Storage:** `ExtensionContext.globalState` for scores, `SecretStorage` for API key

---

## Privacy & Security

- **By default, no code leaves your machine** — static analysis runs entirely locally
- Code is only sent to OpenRouter if you have set an API key AND local analysis produces no questions for a file
- **No code is stored** by VibeAudit or OpenRouter beyond the API request
- Your API key is stored in VS Code's encrypted `SecretStorage` — never in plain text, never in settings.json
- You control which LLM model processes your code
- Only relevant code chunks (<=2000 lines) are sent per request — never the entire codebase at once

---

## Architecture

```
vibeaudit/src/
├── extension.ts              # Entry point — wires everything together
├── types.ts                  # All shared TypeScript interfaces
├── analyzer/                 # Static analysis (no LLM)
│   ├── workspaceScanner.ts   # Recursive file collection
│   ├── languageDetector.ts   # Framework detection from package.json
│   ├── symbolExtractor.ts    # Function/class extraction (VS Code API + regex fallback)
│   ├── criticalPathFinder.ts # Pattern matching for high-risk code
│   ├── complexityScorer.ts   # Branch/nesting complexity scoring
│   ├── dependencyMapper.ts   # Import graph construction
│   ├── workspaceAnalyzer.ts  # Orchestrates full scan with progress UI
│   ├── astParser.ts          # Deep function metadata extraction (params, try-catch, returns, calls)
│   ├── patternDetector.ts    # 12 anti-pattern detectors (missing error handling, SQL injection, etc.)
│   └── codePathTracer.ts     # Traces execution paths through branches and try-catch
├── llm/                      # OpenRouter integration (optional)
│   ├── openRouterClient.ts   # HTTP client with retry + timeout
│   ├── promptTemplates.ts    # All LLM prompts (quiz, eval, learning path)
│   └── responseParser.ts     # JSON parsing + validation
├── quiz/                     # Quiz flow
│   ├── questionGenerator.ts  # LLM-based question generation (fallback only)
│   ├── answerEvaluator.ts    # Answer evaluation — local fast path + optional LLM enhancement
│   ├── questionTemplates.ts  # Template engine: pattern + evidence → MCQ question
│   ├── answerComputer.ts     # Deterministic answer evaluation (no LLM)
│   ├── localQuestionGenerator.ts # Orchestrates: detect patterns → generate questions → compute answers
│   ├── difficultyManager.ts  # Adaptive difficulty (3 right → harder, 2 wrong → easier)
│   ├── sessionManager.ts     # Session lifecycle
│   └── quizEngine.ts         # Full quiz orchestration (local primary, LLM optional)
├── scoring/
│   ├── scoreCalculator.ts    # Weighted score aggregation
│   ├── dangerZoneDetector.ts # High risk × low understanding
│   └── progressTracker.ts    # Timeline and trend analysis
├── ui/
│   ├── statusBarManager.ts   # Bottom bar score item
│   ├── sidebarProvider.ts    # TreeView providers
│   ├── codeLensProvider.ts   # Inline function annotations
│   ├── diagnosticsProvider.ts# Danger zone inline warnings
│   ├── hoverProvider.ts      # Hover cards
│   └── webview/
│       ├── quizPanel.ts      # Quiz webview panel
│       ├── reportPanel.ts    # Report webview panel
│       └── onboardingPanel.ts# First-launch setup
├── storage/
│   ├── stateManager.ts       # Typed globalState wrapper
│   └── apiKeyManager.ts      # SecretStorage wrapper
└── utils/
    ├── codeChunker.ts        # Splits large files into LLM-safe chunks
    ├── constants.ts          # Shared constants (limits, labels, defaults)
    ├── fileUtils.ts          # File path helpers and filtering
    └── guards.ts             # TypeScript type guards
```

> **Webview assets** live under `ui/webview/`:
> - `panelUtils.ts` — shared panel lifecycle helpers
> - `templates/` — `quiz.html`, `report.html`, `onboarding.html`, `styles.css`
> - `scripts/` — `quiz.js`, `report.js`, `onboarding.js` (vanilla JS, no bundler)

---

## Development

```bash
git clone https://github.com/riyaa1611/vibeaudit
cd vibeaudit
npm install

# Build
node esbuild.config.mjs

# Watch mode
node esbuild.config.mjs --watch

# Type check
npx tsc --noEmit

# Package
npx vsce package
```

Press `F5` in VS Code to launch the Extension Development Host.

---

## Repository

[github.com/riyaa1611/vibeaudit](https://github.com/riyaa1611/vibeaudit)

## License

MIT — see [LICENSE](LICENSE)
