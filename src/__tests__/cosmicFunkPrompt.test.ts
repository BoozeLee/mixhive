import { compileRecipe, ArtRecipeSchema, STYLE_CORE, type ArtRecipe } from '../lib/cosmicFunkPrompt';

const base: ArtRecipe = ArtRecipeSchema.parse({
  mode: 'avatar',
  subjectName: 'DJ Nefke',
  character: 'DJ',
  theme: 'cosmic funk',
  objects: ['disco ball', 'planets'],
  palette: ['electric purple', 'acid green'],
  head: 'bald with glowing headphones',
  intensity: 50,
});

describe('compileRecipe', () => {
  it('always embeds the locked style core', () => {
    expect(compileRecipe(base)).toContain(STYLE_CORE);
  });

  it('avatar mode forces a square face-first portrait with no text', () => {
    const p = compileRecipe(base);
    expect(p).toMatch(/Square 1:1/i);
    expect(p).toMatch(/head-and-shoulders/i);
    expect(p).toMatch(/no text/i);
  });

  it('includes the editable content (character, name, objects, palette)', () => {
    const p = compileRecipe(base);
    expect(p).toContain('DJ Nefke');
    expect(p).toContain('disco ball, planets');
    expect(p).toContain('electric purple, acid green');
    expect(p).toContain('bald with glowing headphones');
  });

  it('avatar mode ignores poster text slots', () => {
    const p = compileRecipe({ ...base, text: { bottom: 'SHOULD NOT APPEAR' } });
    expect(p).not.toContain('SHOULD NOT APPEAR');
  });

  it('poster mode renders the title typography', () => {
    const p = compileRecipe({ ...base, mode: 'poster', text: { bottom: 'DJ NEFKE' } });
    expect(p).toMatch(/bubble-letter title "DJ NEFKE"/);
  });

  it('falls back to sensible defaults when objects/palette empty', () => {
    const p = compileRecipe({ ...base, objects: [], palette: [] });
    expect(p).toMatch(/planets, stars, glowing portals/);
    expect(p).toMatch(/electric purple, acid green, hot pink/);
  });

  it('rejects an empty subject name', () => {
    expect(() => compileRecipe({ ...base, subjectName: '' })).toThrow();
  });
});
