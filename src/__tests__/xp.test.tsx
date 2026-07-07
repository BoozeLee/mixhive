import { render, screen } from '@testing-library/react';
import { levelForXp, levelProgress, xpForLevel } from '@/lib/xp';
import { LevelBadge } from '@/components/LevelBadge';

describe('xp math', () => {
  // Boundaries must match Postgres calculate_level() in migration 089:
  //   level = floor(sqrt(xp / 100)) + 1
  it('matches the DB level boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(399)).toBe(2);
    expect(levelForXp(400)).toBe(3);
    expect(levelForXp(900)).toBe(4);
  });

  it('computes xpForLevel as the inverse of the level curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
    expect(xpForLevel(4)).toBe(900);
  });

  it('reports progress within the current level', () => {
    const p = levelProgress(250);
    expect(p.level).toBe(2);
    expect(p.currentLevelFloor).toBe(100);
    expect(p.nextLevelThreshold).toBe(400);
    expect(p.xpForThisLevel).toBe(300);
    expect(p.xpIntoLevel).toBe(150);
    expect(p.pct).toBeCloseTo(0.5, 5);
  });

  it('clamps pct and handles non-positive / nullish xp', () => {
    expect(levelProgress(0).pct).toBe(0);
    expect(levelProgress(-50).level).toBe(1);
    // exactly at a threshold → fresh level, 0% progress
    expect(levelProgress(100).pct).toBe(0);
  });
});

describe('LevelBadge', () => {
  it('renders the level number with an accessible label', () => {
    render(<LevelBadge level={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 7')).toBeInTheDocument();
  });

  it('floors to a minimum of level 1', () => {
    render(<LevelBadge level={0} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
