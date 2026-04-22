import * as vscode from 'vscode';
import * as fs from 'fs';
import type { FileSymbol } from '../types';

const JS_TS_FUNC_REGEX = /(?:^|\s)(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:^|\s)(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm;
const JS_TS_CLASS_REGEX = /(?:^|\s)(?:export\s+)?class\s+(\w+)/gm;
const PY_DEF_REGEX = /^(?:async\s+)?def\s+(\w+)/gm;
const PY_CLASS_REGEX = /^class\s+(\w+)/gm;

export async function extractSymbols(uri: vscode.Uri, language: string): Promise<FileSymbol[]> {
  try {
    const vsSymbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider', uri
    );
    if (vsSymbols && vsSymbols.length > 0) {
      return mapVsCodeSymbols(vsSymbols);
    }
  } catch {
    // fall through to regex
  }

  return regexExtractSymbols(uri.fsPath, language);
}

function mapVsCodeSymbols(symbols: vscode.DocumentSymbol[]): FileSymbol[] {
  return symbols.map(s => ({
    name: s.name,
    kind: mapSymbolKind(s.kind),
    startLine: s.range.start.line,
    endLine: s.range.end.line,
    children: mapVsCodeSymbols(s.children),
  }));
}

function mapSymbolKind(kind: vscode.SymbolKind): FileSymbol['kind'] {
  switch (kind) {
    case vscode.SymbolKind.Function:
    case vscode.SymbolKind.Method:
    case vscode.SymbolKind.Constructor:
      return 'function';
    case vscode.SymbolKind.Class:
      return 'class';
    case vscode.SymbolKind.Variable:
    case vscode.SymbolKind.Constant:
      return 'variable';
    case vscode.SymbolKind.Interface:
      return 'interface';
    default:
      return 'other';
  }
}

function regexExtractSymbols(filePath: string, language: string): FileSymbol[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split('\n');
  const symbols: FileSymbol[] = [];

  if (language === 'python') {
    for (const match of content.matchAll(PY_DEF_REGEX)) {
      const name = match[1];
      const startLine = getLineNumber(content, match.index ?? 0);
      symbols.push({ name, kind: 'function', startLine, endLine: startLine + 10, children: [] });
    }
    for (const match of content.matchAll(PY_CLASS_REGEX)) {
      const name = match[1];
      const startLine = getLineNumber(content, match.index ?? 0);
      symbols.push({ name, kind: 'class', startLine, endLine: startLine + 20, children: [] });
    }
  } else {
    for (const match of content.matchAll(JS_TS_FUNC_REGEX)) {
      const name = match[1] ?? match[2];
      if (!name) { continue; }
      const startLine = getLineNumber(content, match.index ?? 0);
      symbols.push({ name, kind: 'function', startLine, endLine: startLine + 10, children: [] });
    }
    for (const match of content.matchAll(JS_TS_CLASS_REGEX)) {
      const name = match[1];
      const startLine = getLineNumber(content, match.index ?? 0);
      symbols.push({ name, kind: 'class', startLine, endLine: startLine + 30, children: [] });
    }
  }

  return symbols;
}

function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split('\n').length - 1;
}
