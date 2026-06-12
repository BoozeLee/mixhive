import { isUuid } from '../lib/validation';

describe('isUuid', () => {
  it('accepts valid UUIDs', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('rejects malformed database identifiers before queries are made', () => {
    expect(isUuid('test-id')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
