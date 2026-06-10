'use client';

import { useEffect, useState } from 'react';
import { colors, fontSize, radius, space, fontWeight } from '../styles/tokens';
import { supabase } from '../lib/supabase';

interface Recap {
  days: number;
  totals: {
    plays: number;
    likes: number;
    comments: number;
    follows: number;
    profile_views: number;
    active_days: number;
    best_day_plays: number;
  };
  top_mix: { id: string; title: string; play_count: number; like_count: number } | null;
}

export function CreatorRecap() {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (active) setLoading(false);
          return;
        }
        const res = await fetch('/api/creator/recap', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const d = await res.json();
        if (active && d.recap) setRecap(d.recap as Recap);
      } catch {
        /* ignore */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading || !recap) return null;
  const t = recap.totals;
  const hasActivity = t.active_days > 0 || (recap.top_mix?.play_count ?? 0) > 0;

  const stat = (label: string, value: number) => (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: space[4],
        minWidth: 92,
      }}
    >
      <div style={{ fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: colors.text.primary }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: fontSize.xs, color: colors.text.dim, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  return (
    <section style={{ marginTop: space[8] }}>
      <h2 style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: colors.text.primary }}>
        Your last {recap.days} days
      </h2>
      {!hasActivity ? (
        <p style={{ fontSize: fontSize.sm, color: colors.text.dim, marginTop: space[2] }}>
          No activity yet — upload a mix and your recap will fill in.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3], marginTop: space[4] }}>
            {stat('plays', t.plays)}
            {stat('likes', t.likes)}
            {stat('comments', t.comments)}
            {stat('new follows', t.follows)}
            {stat('profile views', t.profile_views)}
          </div>
          {recap.top_mix && (
            <p style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginTop: space[4] }}>
              Top mix: <strong style={{ color: colors.text.primary }}>{recap.top_mix.title}</strong> ·{' '}
              {recap.top_mix.play_count.toLocaleString()} plays · {recap.top_mix.like_count.toLocaleString()} likes
            </p>
          )}
        </>
      )}
    </section>
  );
}
