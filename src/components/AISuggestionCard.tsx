import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import type { AISuggestion } from '../lib/types';
import { colors, space, radius, fontSize, fontWeight, transition } from '../styles/tokens';
import { trackEvent } from '../lib/experiments';
import { Icon } from './ui/Icon';
import type { IconKey } from '../lib/icons';

const typeLabels: Record<string, string> = {
  profile_bio: 'Bio',
  profile_coach: 'Profile Coach',
  epk: 'Press Kit',
  opportunity_match: 'Opportunity',
  collab_match: 'Collaboration',
  web3_proposal: 'Web3 Pass',
};

const typeIcons: Record<string, IconKey> = {
  profile_bio: 'edit',
  profile_coach: 'profile',
  epk: 'epk',
  opportunity_match: 'events',
  collab_match: 'quests',
  web3_proposal: 'sparkles',
};

interface Props {
  suggestion: AISuggestion;
  profileId?: string;
  onApply?: (id: string, editedPayload?: Record<string, unknown>) => void;
  onReject?: (id: string) => void;
  onRate?: (id: string, rating: number) => void;
}

function getEditableText(suggestion: AISuggestion): string | null {
  if (suggestion.suggestion_type === 'profile_bio')
    return (suggestion.payload.bio as string) ?? null;
  if (suggestion.suggestion_type === 'profile_coach')
    return (suggestion.payload.bio_rewrite as string) ?? null;
  return null;
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
      <div
        style={{
          flex: 1,
          height: 3,
          borderRadius: radius.pill,
          background: colors.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: pct >= 70 ? colors.accent : pct >= 40 ? colors.warning : colors.text.muted,
            borderRadius: radius.pill,
            transition: transition.slow,
          }}
        />
      </div>
      <span style={{ fontSize: fontSize.xs, color: colors.text.dim, flexShrink: 0 }}>{pct}%</span>
    </div>
  );
}

function SuggestionBody({ suggestion }: { suggestion: AISuggestion }) {
  const p = suggestion.payload;

  if (suggestion.suggestion_type === 'profile_coach') {
    const suggestions = p.suggestions as
      | Array<{ field: string; issue: string; suggestion: string; priority: number }>
      | undefined;
    const bioRewrite = p.bio_rewrite as string | null | undefined;
    const score = p.score as number | undefined;
    const headline = p.headline as string | undefined;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
        {score !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: space[4] }}>
            <span
              style={{
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.bold,
                color:
                  score >= 70 ? colors.accent : score >= 40 ? colors.warning : colors.text.muted,
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontSize: fontSize.sm,
                color: colors.text.dim,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              /100 · {headline}
            </span>
          </div>
        )}

        {suggestions?.map((s, i) => (
          <div
            key={i}
            style={{
              padding: `${space[4]}px ${space[5]}px`,
              borderRadius: radius.md,
              background: s.priority === 1 ? 'rgba(255,85,85,0.06)' : colors.accentFaint,
              border: `1px solid ${s.priority === 1 ? 'rgba(255,85,85,0.2)' : colors.accentMuted}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                marginBottom: space[2],
              }}
            >
              <span
                style={{
                  fontSize: fontSize.xs,
                  color: s.priority === 1 ? colors.danger : colors.accent,
                  fontWeight: fontWeight.bold,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {s.priority === 1 ? '● Critical' : s.priority === 2 ? '◐ Important' : '○ Optional'}{' '}
                · {s.field}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: fontSize.base,
                color: colors.text.secondary,
                marginBottom: space[2],
              }}
            >
              {s.issue}
            </p>
            <p style={{ margin: 0, fontSize: fontSize.base, color: colors.text.primary }}>
              {s.suggestion}
            </p>
          </div>
        ))}

        {bioRewrite && (
          <div
            style={{
              padding: `${space[4]}px ${space[5]}px`,
              borderRadius: radius.md,
              background: 'rgba(240,192,64,0.04)',
              border: `1px solid ${colors.accentMuted}`,
            }}
          >
            <div
              style={{
                fontSize: fontSize.xs,
                color: colors.accent,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                marginBottom: space[3],
              }}
            >
              ✎ Suggested bio rewrite
            </div>
            <p
              style={{
                margin: 0,
                fontSize: fontSize.base,
                color: colors.text.primary,
                lineHeight: 1.6,
                fontStyle: 'italic',
              }}
            >
              "{bioRewrite}"
            </p>
          </div>
        )}
      </div>
    );
  }

  if (suggestion.suggestion_type === 'profile_bio') {
    const bio = p.bio as string | undefined;
    return bio ? (
      <p
        style={{
          margin: 0,
          fontSize: fontSize.base,
          color: colors.text.primary,
          lineHeight: 1.6,
          fontStyle: 'italic',
        }}
      >
        "{bio}"
      </p>
    ) : null;
  }

  if (suggestion.suggestion_type === 'web3_proposal') {
    const action = p.action as string | undefined;
    const reasonTemplate = p.reason_template as string | undefined;
    const contextStats = p.context_stats as Record<string, string | number> | undefined;
    const text =
      reasonTemplate?.replace(/\{(\w+)\}/g, (_, key) =>
        contextStats?.[key] !== undefined ? String(contextStats[key]) : `{${key}}`
      ) ?? 'A new supporter pass is suggested for this release.';
    const actionLabel =
      action === 'create_pass'
        ? 'Supporter pass'
        : action === 'open_quest_backing'
          ? 'Quest backing'
          : 'Gig proof';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <span
            style={{
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
              color: colors.accent,
              padding: `${space[1]}px ${space[3]}px`,
              borderRadius: radius.pill,
              background: colors.accentFaint,
              border: `1px solid ${colors.accentMuted}`,
            }}
          >
            {actionLabel}
          </span>
          <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>Base L2 · Zora</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: fontSize.base,
            color: colors.text.secondary,
            lineHeight: 1.6,
          }}
        >
          {text}
        </p>
      </div>
    );
  }

  // Generic fallback
  return (
    <pre
      style={{
        margin: 0,
        fontSize: fontSize.xs,
        color: colors.text.muted,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {JSON.stringify(p, null, 2)}
    </pre>
  );
}

function StarRating({ onRate }: { onRate: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: space[1] }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          aria-label={`Rate ${n} stars`}
          onClick={() => onRate(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none',
            border: 'none',
            padding: `${space[1]}px`,
            cursor: 'pointer',
            lineHeight: 0,
            color: n <= hovered ? colors.accent : colors.text.faint,
            transition: transition.fast,
          }}
        >
          <Icon name="rating" size={16} color="currentColor" />
        </button>
      ))}
    </div>
  );
}

export function AISuggestionCard({ suggestion, profileId, onApply, onReject, onRate }: Props) {
  const t = useTranslations('aISuggestionCard');
  const [showRationale, setShowRationale] = useState(false);
  const [localStatus, setLocalStatus] = useState(suggestion.status);
  const [rated, setRated] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(() => getEditableText(suggestion) ?? '');
  const viewedRef = useRef(false);

  // Fire viewed event once on mount (doc 33 — agent_rec_shown)
  useEffect(() => {
    if (profileId && !viewedRef.current) {
      viewedRef.current = true;
      trackEvent(profileId, 'agent_rec_shown', suggestion.source ?? 'ai_suggestions', {
        agent_id: suggestion.source ?? null,
        rank: suggestion.rank ?? null,
        candidate_id: suggestion.candidate_id ?? suggestion.id,
        candidate_type: suggestion.suggestion_type,
      });
    }
  }, [
    profileId,
    suggestion.id,
    suggestion.suggestion_type,
    suggestion.source,
    suggestion.rank,
    suggestion.candidate_id,
  ]);

  const isApplied = localStatus === 'applied';
  const isRejected = localStatus === 'rejected';
  const isDone = isApplied || isRejected;
  const canEdit = getEditableText(suggestion) !== null;

  const label = typeLabels[suggestion.suggestion_type] ?? suggestion.suggestion_type;
  const iconKey: IconKey = typeIcons[suggestion.suggestion_type] ?? 'sparkles';

  function handleApply() {
    setLocalStatus('applied');
    setEditMode(false);
    if (profileId) {
      trackEvent(profileId, 'agent_rec_accepted', suggestion.source ?? 'ai_suggestions', {
        agent_id: suggestion.source ?? null,
        rank: suggestion.rank ?? null,
        candidate_id: suggestion.candidate_id ?? suggestion.id,
        action_type: 'apply',
      });
    }
    const edited = editText !== getEditableText(suggestion) ? editText : undefined;
    const editedPayload =
      edited !== undefined
        ? suggestion.suggestion_type === 'profile_bio'
          ? { ...suggestion.payload, bio: edited }
          : { ...suggestion.payload, bio_rewrite: edited }
        : undefined;
    onApply?.(suggestion.id, editedPayload);
  }

  function handleReject() {
    setLocalStatus('rejected');
    setEditMode(false);
    if (profileId) {
      trackEvent(profileId, 'agent_rec_skipped', suggestion.source ?? 'ai_suggestions', {
        agent_id: suggestion.source ?? null,
        rank: suggestion.rank ?? null,
        candidate_id: suggestion.candidate_id ?? suggestion.id,
      });
    }
    onReject?.(suggestion.id);
  }

  function handleRate(r: number) {
    setRated(true);
    onRate?.(suggestion.id, r);
  }

  return (
    <article
      style={{
        background:
          'linear-gradient(135deg, rgba(255,216,74,0.06), transparent 32%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent), rgba(7,7,5,0.78)',
        border: `1px solid ${isDone ? colors.border : colors.accentMuted}`,
        borderRadius: radius.xl,
        padding: `${space[7]}px ${space[8]}px`,
        opacity: isRejected ? 0.5 : 1,
        transition: transition.slow,
      }}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'flex-start', gap: space[5], marginBottom: space[6] }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
            background: isDone ? colors.border : colors.accentFaint,
            color: isDone ? colors.text.faint : colors.accent,
            border: `1px solid ${isDone ? colors.border : colors.accentMuted}`,
            fontSize: 14,
            fontWeight: fontWeight.bold,
          }}
        >
          {isApplied ? (
            '✓'
          ) : isRejected ? (
            '✗'
          ) : (
            <Icon name={iconKey} size={15} color="currentColor" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: space[4], marginBottom: space[2] }}
          >
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: isApplied ? colors.success : isRejected ? colors.text.faint : colors.accent,
              }}
            >
              {isApplied ? 'Applied' : isRejected ? 'Dismissed' : label}
            </span>
            {suggestion.model && !isDone && (
              <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>
                via {suggestion.model}
              </span>
            )}
          </div>
          <ConfidenceBar value={suggestion.confidence} />
        </div>
      </div>

      {/* Body / Edit */}
      {!isRejected && (
        <div style={{ marginBottom: space[6] }}>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
              <div
                style={{
                  fontSize: fontSize.xs,
                  color: colors.text.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                ✎ Editing suggestion
              </div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: `${space[5]}px`,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${colors.accentMuted}`,
                  borderRadius: radius.md,
                  color: colors.text.primary,
                  fontSize: fontSize.base,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <SuggestionBody suggestion={suggestion} />
          )}
        </div>
      )}

      {/* Rationale accordion */}
      {suggestion.rationale && !isRejected && (
        <div style={{ marginBottom: space[6] }}>
          <button
            onClick={() => setShowRationale(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: fontSize.xs,
              color: colors.text.muted,
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              textDecoration: 'underline',
              textDecorationColor: colors.accentMuted,
              transition: transition.fast,
            }}
          >
            {showRationale ? '▲' : '▼'} Why this analysis?
          </button>
          {showRationale && (
            <p
              style={{
                margin: `${space[4]}px 0 0`,
                fontSize: fontSize.base,
                color: colors.text.muted,
                lineHeight: 1.6,
                paddingLeft: space[5],
                borderLeft: `2px solid ${colors.accentMuted}`,
              }}
            >
              {suggestion.rationale}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {!isDone ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: space[4], flexWrap: 'wrap' }}>
          {editMode ? (
            <>
              <button
                onClick={handleApply}
                style={{
                  padding: `${space[3]}px ${space[7]}px`,
                  borderRadius: radius.md,
                  background: `linear-gradient(135deg, ${colors.accentBrightest}, ${colors.accent} 58%, ${colors.accentDeep})`,
                  color: colors.black,
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.base,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Save &amp; Apply
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditText(getEditableText(suggestion) ?? '');
                }}
                style={{
                  padding: `${space[3]}px ${space[6]}px`,
                  borderRadius: radius.md,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  color: colors.text.muted,
                  fontWeight: fontWeight.medium,
                  fontSize: fontSize.base,
                  cursor: 'pointer',
                }}
              >
                {t('cancel')}
              </button>
            </>
          ) : (
            <>
              {suggestion.suggestion_type === 'profile_coach' && (
                <Link
                  to="/settings"
                  style={{
                    padding: `${space[3]}px ${space[7]}px`,
                    borderRadius: radius.md,
                    background: `linear-gradient(135deg, ${colors.accentBrightest}, ${colors.accent} 58%, ${colors.accentDeep})`,
                    color: colors.black,
                    fontWeight: fontWeight.bold,
                    fontSize: fontSize.base,
                    textDecoration: 'none',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('applySuggestions')}
                </Link>
              )}
              {suggestion.suggestion_type !== 'profile_coach' && onApply && (
                <button
                  onClick={handleApply}
                  style={{
                    padding: `${space[3]}px ${space[7]}px`,
                    borderRadius: radius.md,
                    background: `linear-gradient(135deg, ${colors.accentBrightest}, ${colors.accent} 58%, ${colors.accentDeep})`,
                    color: colors.black,
                    fontWeight: fontWeight.bold,
                    fontSize: fontSize.base,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {suggestion.suggestion_type === 'web3_proposal' ? 'Open' : 'Apply'}
                </button>
              )}
              {canEdit && !isDone && (
                <button
                  onClick={() => setEditMode(true)}
                  style={{
                    padding: `${space[3]}px ${space[6]}px`,
                    borderRadius: radius.md,
                    background: 'transparent',
                    border: `1px solid ${colors.accentMuted}`,
                    color: colors.accent,
                    fontWeight: fontWeight.medium,
                    fontSize: fontSize.base,
                    cursor: 'pointer',
                  }}
                >
                  {t('edit')}
                </button>
              )}
              <button
                onClick={handleReject}
                style={{
                  padding: `${space[3]}px ${space[6]}px`,
                  borderRadius: radius.md,
                  background: 'transparent',
                  border: `1px solid ${colors.border}`,
                  color: colors.text.muted,
                  fontWeight: fontWeight.medium,
                  fontSize: fontSize.base,
                  cursor: 'pointer',
                }}
              >
                {t('dismiss')}
              </button>
              {!rated && onRate && <StarRating onRate={handleRate} />}
              {rated && (
                <span style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                  {t('thanksForTheFeedback')}
                </span>
              )}
            </>
          )}
        </div>
      ) : (
        isApplied &&
        !rated &&
        onRate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
            <span style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
              {t('howUsefulWasThis')}
            </span>
            <StarRating onRate={handleRate} />
          </div>
        )
      )}
    </article>
  );
}
