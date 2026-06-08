import { isDisposableEmail } from '@/lib/disposableEmail';

describe('isDisposableEmail', () => {
  it('flags known throwaway domains', () => {
    expect(isDisposableEmail('a@mailinator.com')).toBe(true);
    expect(isDisposableEmail('x@yopmail.com')).toBe(true);
  });

  it('allows normal providers', () => {
    expect(isDisposableEmail('dj@gmail.com')).toBe(false);
    expect(isDisposableEmail('artist@label.co')).toBe(false);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isDisposableEmail('  USER@Mailinator.COM ')).toBe(true);
  });

  it('handles malformed input safely', () => {
    expect(isDisposableEmail('not-an-email')).toBe(false);
    expect(isDisposableEmail('')).toBe(false);
  });
});
