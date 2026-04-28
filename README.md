# CodeLitmus — Do You Understand Your Own Code?

**Codebase understanding assessment for VS Code. Works offline. No API key required.**

> Stop shipping code you don't understand. Find out what you actually know — before it breaks in production.

---

## The Problem

AI writes your code. You ship it. It works — until it doesn't.

When things break at 2am, you're staring at code you've never truly read. Auth logic copied from a tutorial. An error handler that silently swallows failures. A database mutation with no transaction guard.

**CodeLitmus reveals the gap between code that runs and code you understand.** It finds the dangerous blind spots in your own codebase — the high-risk paths you've never been tested on.

---

## How It Works

**1. Scan** — CodeLitmus walks your workspace and identifies critical code paths: auth, payments, database writes, API routes, error handling, and security patterns.

**2. Quiz** — Static analysis detects real anti-patterns in your code and generates questions from them. Questions come directly from your actual codebase.

**3. Score** — Every file gets an understanding score (0–100%). High-risk code is weighted 3× in the overall score.

**4. Danger Zones** — High risk × low understanding = danger zone. These are the places most likely to break in production.

---

## Features

### Quiz Engine

Detects 12 anti-pattern types directly from your code and turns them into multiple-choice questions:

- Missing error handling around external calls
- Silent catch blocks that swallow failures
- Unchecked parameters with no null/undefined guards
- Unhandled async calls with no `.catch()`
- SQL injection risks from string-concatenated queries
- Hardcoded secrets — API keys, tokens, passwords
- Missing input validation on user-controlled data
- Error swallowing — exceptions caught and discarded
- Exposed internal errors sent to clients
- Dead code after return statements
- Missing `await` on async functions
- Inconsistent return types across code paths

All answers are computed directly from your code's structure — provably correct for your specific codebase.

**Difficulty:** Adaptive (gets harder when you're right, easier when you struggle), or fixed Easy / Normal / Hard.

---

### Understanding Scores

| Score | What it means |
|-------|--------------|
| 81–100% | **Deep** — you own this codebase |
| 61–80% | **Solid** — some blind spots remain |
| 31–60% | **Partial** — dangerous gaps exist |
| 0–30% | **Critical** — flying blind |

Scores are tracked per file, per category (auth, security, error-handling, data-flow), and as a weighted overall — critical paths count 3× more.

---

### Danger Zones

A file becomes a danger zone when it has **both**:
- Risk ≥ 7/10 — auth, payments, DB, or security patterns detected
- Understanding ≤ 40% — you got most questions wrong

Danger zones appear inline as VS Code diagnostics, in the sidebar panel, and in the Report dashboard.

---

### Report Dashboard

- Animated overall score ring
- Per-file and per-category bar charts (click any file to open it)
- Progress timeline across all sessions
- Full quiz history — every past question, your answer, the correct answer, and explanation
- Personalized learning path — ordered by where your knowledge gaps are most dangerous
- Team comparison — import teammates' score files to compare side-by-side

---

### Everything Else

- **Pinned file focus** — pin any file to run targeted quizzes on specific code
- **CodeLens** — inline score annotations above every audited function
- **Hover cards** — hover any function to see its audit score and risk level
- **Sidebar panels** — file scores, danger zones, and pinned files at a glance
- **Status bar** — your score always visible, one click to the full report

---

## Quick Start

1. Open a project folder in VS Code
2. CodeLitmus auto-scans on first launch
3. Press `Ctrl+Alt+V` (`Cmd+Alt+V` on Mac) to start a quiz
4. Press `Ctrl+Alt+R` to view your full report

No setup. No configuration needed.

---

## Commands

| Command | What it does |
|---------|-------------|
| `CodeLitmus: Scan Workspace` | Scan all files and detect critical paths |
| `CodeLitmus: Start Quiz` | Take a quiz across all critical paths |
| `CodeLitmus: Quiz on Current File` | Quiz focused on the file you have open |
| `CodeLitmus: Quiz Pinned Files Only` | Quiz only your pinned files |
| `CodeLitmus: Show Report` | Open the full report dashboard |
| `CodeLitmus: Pin File for Quiz Focus` | Pin the current file for focused quizzing |
| `CodeLitmus: Export Scores (Team)` | Export your scores as JSON to share |
| `CodeLitmus: Import Team Scores` | Import teammates' score files |
| `CodeLitmus: Reset All Scores` | Clear quiz history and start fresh |

**Shortcuts:** `Ctrl+Alt+V` to quiz, `Ctrl+Alt+R` to report.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `codelitmus.questionsPerSession` | `10` | Questions per quiz (3–15) |
| `codelitmus.difficultyOverride` | `0` | Fixed difficulty (1=Easy, 3=Normal, 5=Hard). 0 = prompt each time |
| `codelitmus.autoScanOnOpen` | `true` | Auto-scan when a folder is opened |
| `codelitmus.showCodeLens` | `true` | Show inline annotations above functions |

---

## Supported Languages

TypeScript, JavaScript (JSX/TSX), Python

Auto-detects: Next.js, React, Express, Fastify, Django, Flask, FastAPI

---

## Privacy

No code leaves your machine. Static analysis runs entirely locally — no network calls, no telemetry, no usage tracking. Scores are stored in VS Code's local `globalState`.

---

## License

MIT — [github.com/riyaa1611/CodeLitmus](https://github.com/riyaa1611/CodeLitmus.git)
