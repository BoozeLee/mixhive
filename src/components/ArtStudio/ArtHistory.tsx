'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { colors, fontSize, radius, space } from '../../styles/tokens';

interface Generation {
  id: string;
  prompt: string;
  negative_prompt: string;
  style: string;
  aspect_ratio: string;
  result_url: string | null;
  created_at: string;
}

export function ArtHistory() {
  const t = useTranslations('artStudio');
  const { user } = useAuth();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/ai/art-generations?page=${page}&limit=${limit}`, {
      // NOTE: this sends the anon key, not the signed-in user's access token, so
      // an auth-gated endpoint would reject it. Typed rather than changed here to
      // keep this PR to a lint fix; see the PR discussion.
      headers: {
        Authorization: `Bearer ${(supabase as unknown as { supabaseKey?: string }).supabaseKey || ''}`,
      },
    })
      .then(r => r.json())
      .then(data => {
        setGenerations(data.generations || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, page]);

  if (!user || loading) return null;
  if (generations.length === 0) return null;

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: space[4],
        }}
      >
        {t('history')} ({total})
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: space[5],
        }}
      >
        {generations.map(gen => (
          <div
            key={gen.id}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              overflow: 'hidden',
              background: colors.surface,
            }}
          >
            {gen.result_url ? (
              <img
                src={gen.result_url}
                alt={gen.prompt}
                style={{
                  width: '100%',
                  aspectRatio: '1/1',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1/1',
                  background: colors.surfaceRaised,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.text.dim,
                  fontSize: fontSize.xs,
                }}
              >
                No preview
              </div>
            )}
            <div style={{ padding: space[3] }}>
              <div
                style={{
                  fontSize: fontSize.xs,
                  color: colors.text.secondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={gen.prompt}
              >
                {gen.prompt}
              </div>
              <div style={{ fontSize: 11, color: colors.text.faint, marginTop: 2 }}>
                {gen.style} · {gen.aspect_ratio} · {new Date(gen.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div
          style={{ display: 'flex', gap: space[3], marginTop: space[6], justifyContent: 'center' }}
        >
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 12px',
              background: colors.surface,
              color: colors.text.secondary,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              fontSize: fontSize.sm,
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: fontSize.sm, color: colors.text.dim, alignSelf: 'center' }}>
            {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 12px',
              background: colors.surface,
              color: colors.text.secondary,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              fontSize: fontSize.sm,
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              opacity: page === totalPages ? 0.5 : 1,
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
