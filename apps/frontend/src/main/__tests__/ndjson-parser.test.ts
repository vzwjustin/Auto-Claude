import { describe, it, expect, beforeEach } from 'vitest';
import {
  flushOllamaProgressNdjsonBuffer,
  parseOllamaProgressNdjsonChunk,
  type NdjsonBufferRef,
  type OllamaProgressData,
} from '../ollama-progress-parser';

/**
 * Ollama progress data structure.
 * Represents a single progress update from Ollama's download stream.
 */
type ProgressData = OllamaProgressData;

describe('NDJSON Parser', () => {
  let bufferRef: NdjsonBufferRef;

  beforeEach(() => {
    bufferRef = { current: '' };
  });

  describe('Basic Parsing', () => {
    it('should parse single JSON object', () => {
      const chunk = '{"status":"downloading","completed":100,"total":1000}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('downloading');
      expect(results[0].completed).toBe(100);
      expect(results[0].total).toBe(1000);
    });

    it('should parse multiple JSON objects', () => {
      const chunk = '{"completed":100}\n{"completed":200}\n{"completed":300}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(3);
      expect(results[0].completed).toBe(100);
      expect(results[1].completed).toBe(200);
      expect(results[2].completed).toBe(300);
    });
  });

  describe('Buffer Management', () => {
    it('should preserve incomplete line in buffer', () => {
      const chunk = '{"completed":100}\n{"incomplete":true';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(bufferRef.current).toBe('{"incomplete":true');
    });

    it('should complete partial line with next chunk', () => {
      let chunk = '{"completed":100}\n{"status":"down';
      let results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);
      expect(results).toHaveLength(1);
      expect(bufferRef.current).toBe('{"status":"down');

      chunk = 'loading"}\n';
      results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('downloading');
      expect(bufferRef.current).toBe('');
    });

    it('should flush final line without trailing newline', () => {
      const chunk = '{"completed":100}\n{"completed":200}';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(bufferRef.current).toBe('{"completed":200}');

      const flushed = flushOllamaProgressNdjsonBuffer(bufferRef);
      expect(flushed).toHaveLength(1);
      expect(flushed[0].completed).toBe(200);
      expect(bufferRef.current).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should skip invalid JSON and continue', () => {
      const chunk = '{"completed":100}\nINVALID\n{"completed":200}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(2);
      expect(results[0].completed).toBe(100);
      expect(results[1].completed).toBe(200);
    });

    it('should skip empty lines', () => {
      const chunk = '{"completed":100}\n\n{"completed":200}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(2);
    });
  });

  describe('Real Ollama Data', () => {
    it('should parse typical Ollama progress update', () => {
      const ollamaProgress = JSON.stringify({
        status: 'downloading',
        digest: 'sha256:abc123',
        completed: 500000000,
        total: 1000000000,
      });
      const chunk = `${ollamaProgress}\n`;
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('downloading');
      expect(results[0].completed).toBe(500000000);
      expect(results[0].total).toBe(1000000000);
    });

    it('should handle multiple rapid Ollama updates', () => {
      const updates = [
        { status: 'downloading', completed: 100000000, total: 1000000000 },
        { status: 'downloading', completed: 200000000, total: 1000000000 },
        { status: 'downloading', completed: 300000000, total: 1000000000 },
      ];
      const chunk = updates.map((u) => JSON.stringify(u)).join('\n') + '\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(3);
      expect(results[2].completed).toBe(300000000);
    });

    it('should handle success status', () => {
      const chunk = '{"status":"success","digest":"sha256:123"}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
    });
  });

  describe('Streaming Scenarios', () => {
    it('should accumulate data across multiple chunks', () => {
      let allResults: ProgressData[] = [];

      // Simulate streaming 3 progress updates
      for (let i = 1; i <= 3; i += 1) {
        const chunk = JSON.stringify({
          completed: i * 100000000,
          total: 670000000,
        }) + '\n';
        const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);
        allResults = allResults.concat(results);
      }

      expect(allResults).toHaveLength(3);
      expect(allResults[2].completed).toBe(300000000);
    });

    it('should handle very long single line', () => {
      const obj = {
        status: 'downloading',
        completed: 123456789,
        total: 987654321,
        extra: 'x'.repeat(100),
      };
      const chunk = JSON.stringify(obj) + '\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(results[0].completed).toBe(123456789);
    });

    it('should handle very large numbers', () => {
      const chunk = '{"completed":999999999999,"total":1000000000000}\n';
      const results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);

      expect(results).toHaveLength(1);
      expect(results[0].completed).toBe(999999999999);
      expect(results[0].total).toBe(1000000000000);
    });
  });

  describe('Buffer State Preservation', () => {
    it('should maintain buffer state across multiple calls', () => {
      // First call with incomplete data
      let chunk = '{"completed":100}\n{"other';
      let results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);
      expect(results).toHaveLength(1);
      expect(bufferRef.current).toBe('{"other');

      // Second call completes the incomplete data
      chunk = '":200}\n';
      results = parseOllamaProgressNdjsonChunk(chunk, bufferRef);
      expect(results).toHaveLength(1);
      expect((results[0] as { other: number }).other).toBe(200);
      expect(bufferRef.current).toBe('');
    });
  });
});
