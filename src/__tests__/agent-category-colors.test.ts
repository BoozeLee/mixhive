import { agentCategoryColors, getAgentCategoryColor } from '../styles/tokens';

// AgentCard builds its CATEGORY_COLORS map from these seven keys at module
// load. A missing export here is not a styling regression — it is a build
// failure, which is exactly what happened when the getter went absent.
const CARD_CATEGORIES = [
  'social',
  'growth',
  'discovery',
  'moderation',
  'release',
  'schedule',
  'engagement',
];

describe('getAgentCategoryColor', () => {
  it.each(CARD_CATEGORIES)('resolves %s to its own colour, not the default', category => {
    expect(getAgentCategoryColor(category)).toBe(agentCategoryColors[category]);
    expect(getAgentCategoryColor(category)).not.toBe(agentCategoryColors.default);
  });

  it('normalizes case and surrounding whitespace, as getGenreColor does', () => {
    expect(getAgentCategoryColor('  SOCIAL ')).toBe(agentCategoryColors.social);
  });

  it('falls back to the default for unknown, empty, null and undefined input', () => {
    expect(getAgentCategoryColor('not-a-category')).toBe(agentCategoryColors.default);
    expect(getAgentCategoryColor('')).toBe(agentCategoryColors.default);
    expect(getAgentCategoryColor(null)).toBe(agentCategoryColors.default);
    expect(getAgentCategoryColor(undefined)).toBe(agentCategoryColors.default);
  });

  it('gives every category a distinct colour, so tag chips stay tellable apart', () => {
    const used = CARD_CATEGORIES.map(c => getAgentCategoryColor(c));
    expect(new Set(used).size).toBe(CARD_CATEGORIES.length);
  });

  it('keeps every value in the warm-anchored hsl band shared with genreColors', () => {
    for (const [name, value] of Object.entries(agentCategoryColors)) {
      const match = value.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
      expect(match).not.toBeNull();
      const [, , sat, light] = match as RegExpMatchArray;
      // No raw hex, and nothing neon: saturation and lightness stay in the
      // range the genre palette was retuned into by commit a362213.
      expect(Number(sat)).toBeLessThanOrEqual(92);
      expect(Number(light)).toBeGreaterThanOrEqual(52);
      expect(Number(light)).toBeLessThanOrEqual(72);
      expect(name).toBeTruthy();
    }
  });
});
