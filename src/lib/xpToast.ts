import toast from 'react-hot-toast';

// XP is awarded server-side by a DB trigger, so the client gets no push. We
// detect a gain by diffing the signed-in user's own XP against the last value
// we saw in localStorage, and celebrate once. Pure client, no backend.
const KEY_PREFIX = 'mixhive:lastXp:';

export function maybeAnnounceXpGain(userId: string, currentXp: number, currentLevel: number): void {
  if (typeof window === 'undefined' || !userId) return;
  const key = `${KEY_PREFIX}${userId}`;
  let prev: number | null = null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) prev = parsed;
    }
  } catch {
    // localStorage unavailable (private mode / blocked) — skip the toast.
    return;
  }

  if (prev !== null && currentXp > prev) {
    const gained = currentXp - prev;
    toast.success(`+${gained.toLocaleString()} XP — Level ${currentLevel}`, { icon: '🐝' });
  }

  try {
    window.localStorage.setItem(key, String(currentXp));
  } catch {
    // ignore write failures
  }
}
