/**
 * NDJSON parsing helpers for Ollama progress streams.
 * Maintains a buffer between chunks and parses complete lines into JSON.
 */

export interface OllamaProgressData {
  status?: string;
  completed?: number;
  total?: number;
  [key: string]: unknown;
}

export interface NdjsonBufferRef {
  current: string;
}

export function parseOllamaProgressNdjsonChunk(
  chunk: string,
  bufferRef: NdjsonBufferRef
): OllamaProgressData[] {
  const results: OllamaProgressData[] = [];

  let buffer = bufferRef.current + chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  lines.forEach((line) => {
    if (line.trim()) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // Skip invalid JSON to keep stream resilient.
      }
    }
  });

  bufferRef.current = buffer;
  return results;
}

export function flushOllamaProgressNdjsonBuffer(
  bufferRef: NdjsonBufferRef
): OllamaProgressData[] {
  const buffer = bufferRef.current;
  bufferRef.current = '';

  if (!buffer.trim()) {
    return [];
  }

  const tempRef: NdjsonBufferRef = { current: '' };
  return parseOllamaProgressNdjsonChunk(`${buffer}\n`, tempRef);
}
