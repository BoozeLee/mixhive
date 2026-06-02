import { formatFileSize, formatDuration, generateSlug } from '@/lib/utils';

describe('Utils', () => {
  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1500)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('should handle edge cases', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-1)).toBe('0 B');
    });
  });

  describe('formatDuration', () => {
    it('should format duration correctly', () => {
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should handle invalid input', () => {
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
    });
  });

  describe('generateSlug', () => {
    it('should generate slugs correctly', () => {
      expect(generateSlug('Test Mix Title')).toBe('test-mix-title');
      expect(generateSlug('Hello World!')).toBe('hello-world');
      expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
      expect(generateSlug('special@chars#here')).toBe('special-chars-here');
    });

    it('should handle edge cases', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug('a'.repeat(100))).toBe('a'.repeat(100));
    });
  });
});
