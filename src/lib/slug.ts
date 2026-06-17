// Normalize a display name into a stable URL/grouping slug.
// "Beatsmith 3000!" -> "beatsmith-3000". Lowercasing folds casing differences so
// the same agent name always maps to one slug (used for "tracks featuring agent").
export function slugify(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
