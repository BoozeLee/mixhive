// Profile Art Studio — schema-driven cosmic-funk prompt compiler.
//
// Design: a LOCKED style layer (the cosmic-funk clause never changes, so the
// platform's look stays consistent) + an EDITABLE content layer (the user's
// character/theme/outfit/palette/symbols). The same recipe drives the form,
// validation, and this compiler — the editor's live preview IS the exact
// prompt sent to the image model.
import { z } from 'zod';

export type ArtMode = 'avatar' | 'poster' | 'banner';

/** The locked style clause — keep (almost) unchanged across generations. */
export const STYLE_CORE =
  'vintage blacklight funk record sleeve mixed with underground psychedelic festival ' +
  'poster art, sci-fi comic-book illustration, neon screen-print aesthetics, thick ' +
  'hand-drawn linework, glowing halftone textures, psychedelic smoke, cosmic portals, ' +
  'maximalist ornamental details, electric neon colors, deep black shadows';

// ---- Option lists (imported by the editor UI for chips) ----
export const CHARACTERS = ['DJ', 'astronaut', 'alien', 'robot', 'pirate', 'shaman', 'animal', 'superhero', 'cyborg', 'deity'] as const;
export const THEMES = ['cosmic funk', 'psytrance', 'reggae', 'space', 'mushrooms', 'cyberpunk', 'carnival', 'Greek myth', 'jungle', 'underwater'] as const;
export const OBJECTS = ['disco ball', 'planets', 'flowers', 'speakers', 'portals', 'mushrooms', 'stars', 'chains', 'lightning', 'lasers', 'vinyl records', 'sacred geometry'] as const;
export const PALETTE = ['electric purple', 'acid green', 'hot pink', 'cosmic blue', 'bright orange', 'yellow gold', 'magenta', 'blacklight teal'] as const;

export const ArtRecipeSchema = z.object({
  mode: z.enum(['avatar', 'poster', 'banner']).default('avatar'),
  subjectName: z.string().trim().min(1, 'Name your artist identity').max(60),
  character: z.string().trim().min(1).max(40),
  theme: z.string().trim().min(1).max(40),
  objects: z.array(z.string().max(40)).max(8).default([]),
  palette: z.array(z.string().max(40)).max(6).default([]),
  outfit: z.string().trim().max(80).optional(),
  head: z.string().trim().max(80).optional(),
  expression: z.string().trim().max(40).optional(),
  intensity: z.number().int().min(0).max(100).default(50), // 0 = more cosmic, 100 = more funky
  freeText: z.string().trim().max(300).optional(),
  text: z
    .object({
      topLeft: z.string().max(40).optional(),
      topRight: z.string().max(40).optional(),
      badge: z.string().max(40).optional(),
      bottom: z.string().max(40).optional(),
    })
    .optional(),
});

export type ArtRecipe = z.infer<typeof ArtRecipeSchema>;

function intensityClause(intensity: number): string {
  if (intensity <= 33) return 'deeply cosmic and mystical, swirling galaxy energy';
  if (intensity >= 67) return 'extra funky, groovy, rebellious 1970s funk energy';
  return 'balanced cosmic-funk energy';
}

/**
 * Compile a recipe into the final image prompt. Avatar mode forces a square,
 * face-first, head-and-shoulders portrait with NO typography (tiny poster text
 * is unreadable at avatar sizes); poster mode includes the text slots.
 */
export function compileRecipe(input: ArtRecipe): string {
  const r = ArtRecipeSchema.parse(input);
  const isAvatar = r.mode === 'avatar';
  const objects = r.objects.length ? r.objects.join(', ') : 'planets, stars, glowing portals';
  const palette = r.palette.length ? r.palette.join(', ') : 'electric purple, acid green, hot pink, cosmic blue, deep black';

  const subject = [
    `a ${r.character} named ${r.subjectName}`,
    r.head ? `with ${r.head}` : '',
    r.outfit ? `wearing ${r.outfit}` : '',
    r.expression ? `, ${r.expression} expression` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const composition = isAvatar
    ? 'Square 1:1 profile-picture composition, head-and-shoulders, face centered and front-facing, bold and readable at small sizes, no text'
    : r.mode === 'banner'
      ? 'Wide 16:9 banner composition, central figure offset, room for a profile header'
      : 'Symmetrical poster composition, central figure front and center';

  const parts = [
    `Create a highly detailed psychedelic cosmic-funk ${isAvatar ? 'character portrait' : 'poster/album-cover artwork'} featuring ${subject}.`,
    `${composition}.`,
    `Theme: ${r.theme}. Surround the figure with ${objects}.`,
    `Ultra-vibrant neon palette: ${palette}.`,
    `Mood: ${intensityClause(r.intensity)}.`,
    `Style: ${STYLE_CORE}.`,
  ];

  // Poster mode only: typography slots.
  if (r.mode === 'poster' && r.text) {
    const t = r.text;
    const titles: string[] = [];
    if (t.bottom) titles.push(`large dripping psychedelic bubble-letter title "${t.bottom}" at the bottom`);
    if (t.topLeft) titles.push(`"${t.topLeft}" top-left`);
    if (t.topRight) titles.push(`"${t.topRight}" top-right`);
    if (t.badge) titles.push(`a badge reading "${t.badge}"`);
    if (titles.length) parts.push(`Hand-painted funk-poster typography: ${titles.join(', ')}.`);
  }

  if (r.freeText) parts.push(r.freeText);

  // Negative guidance (DALL·E has no negative-prompt param; bake into the text).
  parts.push('No minimalism, no plain background, no dull colors, no realistic photography, no empty space, no flat modern vector style.');

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
