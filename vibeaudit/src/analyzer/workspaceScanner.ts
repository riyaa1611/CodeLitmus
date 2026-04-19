import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isSupportedFile, shouldSkipDir, getRelativePath } from '../utils/fileUtils';
import { MAX_FILES_DEFAULT, PRIORITY_DIRS } from '../utils/constants';

export interface ScannedFile {
  path: string;
  relativePath: string;
  lineCount: number;
}

export async function scanWorkspace(
  workspaceRoot: string,
  onProgress?: (scanned: number, total: number) => void
): Promise<ScannedFile[]> {
  const allFiles = await collectFiles(workspaceRoot);
  const results: ScannedFile[] = [];

  for (let i = 0; i < allFiles.length; i++) {
    const filePath = allFiles[i];
    onProgress?.(i + 1, allFiles.length);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lineCount = content.split('\n').length;
      results.push({
        path: filePath,
        relativePath: getRelativePath(filePath, workspaceRoot),
        lineCount,
      });
    } catch {
      // skip unreadable files
    }
  }

  return results;
}

async function collectFiles(dir: string, files: string[] = []): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        await collectFiles(path.join(dir, entry.name), files);
      }
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
      files.push(path.join(dir, entry.name));
      if (files.length >= MAX_FILES_DEFAULT) {
        return files;
      }
    }
  }

  return files;
}
