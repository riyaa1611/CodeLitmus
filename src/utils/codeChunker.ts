import { MAX_LINES_PER_LLM_CALL } from './constants';

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
}

export function chunkCode(lines: string[], maxLines = MAX_LINES_PER_LLM_CALL): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const slice = lines.slice(i, i + maxLines);
    chunks.push({
      content: slice.join('\n'),
      startLine: i + 1,
      endLine: i + slice.length,
    });
  }
  return chunks;
}

export function extractFunctionCode(
  lines: string[],
  startLine: number,
  endLine: number,
  contextLines = 5
): string {
  const start = Math.max(0, startLine - 1 - contextLines);
  const end = Math.min(lines.length, endLine + contextLines);
  return lines.slice(start, end).join('\n');
}
