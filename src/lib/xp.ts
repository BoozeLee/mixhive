// XP / level math — the single client-side source of truth for progression.
//
// Mirrors the Postgres `calculate_level()` from migration 089 exactly:
//   level = floor(sqrt(xp / 100)) + 1
// Keep these in lockstep so the client and DB never disagree about a user's
// level or how far they are into it.

/** XP at which a given level begins. Inverse of `calculate_level`. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 100 * (l - 1) ** 2;
}

/** Level for a given XP total — identical to the DB `calculate_level()`. */
export function levelForXp(xp: number): number {
  const safe = Math.max(0, xp || 0);
  return Math.floor(Math.sqrt(safe / 100)) + 1;
}

export interface LevelProgress {
  /** Current level (1-based). */
  level: number;
  /** XP at which the current level started. */
  currentLevelFloor: number;
  /** XP at which the next level starts. */
  nextLevelThreshold: number;
  /** XP earned within the current level. */
  xpIntoLevel: number;
  /** Total XP span of the current level. */
  xpForThisLevel: number;
  /** Fractional progress through the current level, clamped 0–1. */
  pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safe = Math.max(0, Math.floor(xp || 0));
  const level = levelForXp(safe);
  const currentLevelFloor = xpForLevel(level);
  const nextLevelThreshold = xpForLevel(level + 1);
  const xpForThisLevel = Math.max(1, nextLevelThreshold - currentLevelFloor);
  const xpIntoLevel = Math.max(0, safe - currentLevelFloor);
  const pct = Math.min(1, Math.max(0, xpIntoLevel / xpForThisLevel));
  return {
    level,
    currentLevelFloor,
    nextLevelThreshold,
    xpIntoLevel,
    xpForThisLevel,
    pct,
  };
}
