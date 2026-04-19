import * as path from 'path';
import { SUPPORTED_EXTENSIONS, SKIP_DIRS } from './constants';

export function getLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
  };
  return map[ext] ?? 'unknown';
}

export function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function shouldSkipDir(dirName: string): boolean {
  return SKIP_DIRS.has(dirName) || dirName.startsWith('.');
}

export function getRelativePath(filePath: string, workspaceRoot: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
}

export function isInPriorityDir(relativePath: string): boolean {
  const priorityDirs = ['src/', 'app/', 'pages/', 'lib/', 'api/'];
  return priorityDirs.some(d => relativePath.startsWith(d));
}
