import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Beatsmith 3000')).toBe('beatsmith-3000');
  });

  it('folds casing so the same name maps to one slug', () => {
    expect(slugify('Acid Oracle')).toBe(slugify('acid oracle'));
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('  DJ__Echo!! ')).toBe('dj-echo');
  });

  it('handles empty / non-alphanumeric input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('—')).toBe('');
  });
});
