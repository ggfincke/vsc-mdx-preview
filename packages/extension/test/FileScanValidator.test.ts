// packages/extension/test/FileScanValidator.test.ts
// unit tests for FileScanValidator (file size validation, parallel reads)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mock functions available during vi.mock hoisting
const { mockStat, mockReadFile } = vi.hoisted(() => ({
  mockStat: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('fs', () => ({
  promises: {
    stat: mockStat,
    readFile: mockReadFile,
  },
}));

import { FileScanValidator } from '../tailwind/FileScanValidator';

describe('FileScanValidator', () => {
  let validator: FileScanValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new FileScanValidator();
  });

  describe('validateFileSize', () => {
    it('returns valid for file within size limit', async () => {
      mockStat.mockResolvedValue({ size: 1000 });

      const result = await validator.validateFileSize('/path/file.ts', 2000);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns invalid for file exceeding size limit', async () => {
      mockStat.mockResolvedValue({ size: 3000 });

      const result = await validator.validateFileSize('/path/file.ts', 2000);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds limit');
    });

    it('returns invalid when file cannot be stat', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));

      const result = await validator.validateFileSize('/path/missing.ts', 2000);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Cannot stat file');
    });

    it('handles non-Error exceptions', async () => {
      mockStat.mockRejectedValue('Unknown error');

      const result = await validator.validateFileSize('/path/file.ts', 2000);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Unknown error');
    });
  });

  describe('validateExtension', () => {
    it('returns valid for allowed extension', () => {
      const result = validator.validateExtension('/path/file.ts', [
        '.ts',
        '.tsx',
        '.js',
      ]);

      expect(result.valid).toBe(true);
    });

    it('returns invalid for disallowed extension', () => {
      const result = validator.validateExtension('/path/file.py', [
        '.ts',
        '.tsx',
        '.js',
      ]);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('.py not in allowed list');
    });

    it('handles files with multiple dots', () => {
      const result = validator.validateExtension('/path/file.test.ts', ['.ts']);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateClassToken', () => {
    it('returns true for valid Tailwind class', () => {
      expect(validator.validateClassToken('flex')).toBe(true);
      expect(validator.validateClassToken('text-red-500')).toBe(true);
      expect(validator.validateClassToken('hover:bg-blue-100')).toBe(true);
    });

    it('returns true for arbitrary value classes', () => {
      expect(validator.validateClassToken('w-[100px]')).toBe(true);
      expect(validator.validateClassToken('text-[#ff0000]')).toBe(true);
    });

    it('returns false for invalid tokens', () => {
      expect(validator.validateClassToken('')).toBe(false);
      expect(validator.validateClassToken('   ')).toBe(false);
    });
  });

  describe('readFileIfValid', () => {
    it('returns content for valid file', async () => {
      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile.mockResolvedValue('file content');

      const result = await validator.readFileIfValid('/path/file.ts', 1000);

      expect(result).toBe('file content');
    });

    it('returns null for oversized file', async () => {
      mockStat.mockResolvedValue({ size: 2000 });

      const result = await validator.readFileIfValid('/path/large.ts', 1000);

      expect(result).toBeNull();
    });

    it('returns null for unreadable file', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT'));

      const result = await validator.readFileIfValid('/path/missing.ts', 1000);

      expect(result).toBeNull();
    });
  });

  describe('readValidFiles', () => {
    it('reads multiple files in parallel', async () => {
      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile
        .mockResolvedValueOnce('content1')
        .mockResolvedValueOnce('content2')
        .mockResolvedValueOnce('content3');

      const paths = ['/path/a.ts', '/path/b.ts', '/path/c.ts'];
      const result = await validator.readValidFiles(paths, 1000);

      expect(result.size).toBe(3);
      expect(result.get('/path/a.ts')).toBe('content1');
      expect(result.get('/path/b.ts')).toBe('content2');
      expect(result.get('/path/c.ts')).toBe('content3');
    });

    it('skips files that fail validation', async () => {
      mockStat
        .mockResolvedValueOnce({ size: 100 }) // valid
        .mockResolvedValueOnce({ size: 2000 }) // too large
        .mockResolvedValueOnce({ size: 100 }); // valid
      mockReadFile
        .mockResolvedValueOnce('content1')
        .mockResolvedValueOnce('content3');

      const paths = ['/path/a.ts', '/path/large.ts', '/path/c.ts'];
      const result = await validator.readValidFiles(paths, 1000);

      expect(result.size).toBe(2);
      expect(result.has('/path/large.ts')).toBe(false);
    });

    it('returns empty map for empty input', async () => {
      const result = await validator.readValidFiles([], 1000);

      expect(result.size).toBe(0);
    });
  });
});
