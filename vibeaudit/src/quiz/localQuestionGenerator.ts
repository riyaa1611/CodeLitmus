/**
 * localQuestionGenerator.ts
 *
 * Orchestrates the full local (no-LLM) pipeline:
 *   scan files → parse → detect patterns → generate questions → return them.
 *
 * No LLM, no API key, no network, no vscode import — pure logic for easy testing.
 */

import * as path from 'path';
import { extractFunctions } from '../analyzer/astParser';
import { detectPatterns, DetectedPattern } from '../analyzer/patternDetector';
import { traceCodePaths } from '../analyzer/codePathTracer';
import { generateQuestionFromPattern, GeneratedQuestion } from './questionTemplates';

// ─── Exported types ────────────────────────────────────────────────────────────

export interface LocalFile {
  path: string;       // absolute path
  content: string;
  language: 'typescript' | 'javascript' | 'python';
}

export interface QuestionCountSummary {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ─── Severity ordering ─────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateLocalQuestions(
  files: LocalFile[],
  options: {
    maxQuestions: number;
    difficulty?: 1 | 2 | 3 | 4 | 5;
    focusCategory?: string;
    focusFiles?: string[];
  }
): GeneratedQuestion[] {
  // 1. Collect { pattern, paths } pairs from all files
  const collected: Array<{ pattern: DetectedPattern; paths: ReturnType<typeof traceCodePaths> }> = [];

  for (const file of files) {
    const functions = extractFunctions(file.content, file.path, file.language);
    const relativePath = toRelativePath(file.path);

    for (const func of functions) {
      const patterns = detectPatterns(func, relativePath, file.content, file.language);
      const codePaths = traceCodePaths(func, file.language);

      for (const pattern of patterns) {
        collected.push({ pattern, paths: codePaths });
      }
    }
  }

  // 2. Filter by focusFiles (match on file.path)
  let filtered = collected;

  if (options.focusFiles && options.focusFiles.length > 0) {
    const focusSet = new Set(options.focusFiles);
    filtered = filtered.filter(({ pattern }) => focusSet.has(pattern.file));
  }

  // 3. Filter by focusCategory
  if (options.focusCategory) {
    const cat = options.focusCategory;
    filtered = filtered.filter(({ pattern }) => pattern.category === cat);
  }

  // 4. Filter by difficulty (maps to severity ranges)
  if (options.difficulty !== undefined) {
    const allowedSeverities = severitiesForDifficulty(options.difficulty);
    filtered = filtered.filter(({ pattern }) => allowedSeverities.has(pattern.severity));
  }

  // 5. Sort by severity: critical=0, high=1, medium=2, low=3
  filtered.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.pattern.severity] ?? 4) - (SEVERITY_ORDER[b.pattern.severity] ?? 4)
  );

  // 6. Deduplicate: skip same pattern.type + functionName + file
  const seen = new Set<string>();
  const deduped = filtered.filter(({ pattern }) => {
    const key = `${pattern.type}::${pattern.functionName}::${pattern.file}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // 7. Take first maxQuestions
  const candidates = deduped.slice(0, options.maxQuestions);

  // 8. Generate questions, skipping on error
  const questions: GeneratedQuestion[] = [];
  for (const { pattern, paths } of candidates) {
    try {
      const q = generateQuestionFromPattern(pattern, paths);
      questions.push(q);
    } catch (err) {
      console.warn(
        `[localQuestionGenerator] Skipping pattern "${pattern.type}" in "${pattern.file}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return questions;
}

export function countAvailableQuestions(files: LocalFile[]): QuestionCountSummary {
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let total = 0;

  for (const file of files) {
    const functions = extractFunctions(file.content, file.path, file.language);
    const relativePath = toRelativePath(file.path);

    for (const func of functions) {
      const patterns = detectPatterns(func, relativePath, file.content, file.language);
      for (const pattern of patterns) {
        total++;
        byCategory[pattern.category] = (byCategory[pattern.category] ?? 0) + 1;
        bySeverity[pattern.severity] = (bySeverity[pattern.severity] ?? 0) + 1;
      }
    }
  }

  return { total, byCategory, bySeverity };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRelativePath(filePath: string): string {
  try {
    const rel = path.relative(process.cwd(), filePath);
    // If relative path goes up too many levels or is still absolute, use original
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return filePath;
    }
    return rel;
  } catch {
    return filePath;
  }
}

function severitiesForDifficulty(difficulty: 1 | 2 | 3 | 4 | 5): Set<string> {
  if (difficulty <= 2) {
    return new Set(['low', 'medium']);
  }
  if (difficulty === 3) {
    return new Set(['medium', 'high']);
  }
  // difficulty 4-5
  return new Set(['high', 'critical']);
}
