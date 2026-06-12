import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { runStrategicAgent } from '../lib/agents';
import type { AgentOutput } from '../lib/agents';
import type { Opportunity, OpportunityMatch, OpportunitySaveStatus } from '../lib/types';
import { getOpportunitySaves, upsertOpportunitySave } from '../lib/api';
import { colors, fontSize, fontWeight, radius, space, transition } from '../styles/tokens';
import { Icon } from '../components/ui/Icon';

type Tab = 'for-you' | 'saved' | 'applied' | 'dismissed';
type OpportunityAction = OpportunitySaveStatus;

const tabLabels: Record<Tab, string> = {
  'for-you': 'For You',
  saved: 'Saved',
  applied: 'Applied',
  dismissed: 'Dismissed',
};

const typeLabels: Record<string, string> = {
  gig: 'Gig',
  grant: 'Grant',
  residency: 'Residency',
  contest: 'Contest',
  festival: 'Festival',
  collab_call: 'Collab',
  radio: 'Radio',
};

function scoreOpportunity(
  opp: Opportunity,
  profileGenres: string[],
  profileLocation?: string | null
): OpportunityMatch {
  const normalizedProfileGenres = profileGenres.map(g => g.toLowerCase());
  const genreHits = opp.genres.filter(g => normalizedProfileGenres.includes(g.toLowerCase()));
  const locationHit =
    profileLocation &&
    [opp.city, opp.location, opp.country]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(profileLocation.toLowerCase()));
  const urgencyBoost = opp.deadline && new Date(opp.deadline).getTime() > Date.now() ? 6 : 0;
  const score = Math.min(96, 56 + genreHits.length * 12 + (locationHit ? 12 : 0) + urgencyBoost);
  const rationaleParts = [
    genreHits.length
      ? `genre overlap: ${genreHits.slice(0, 3).join(', ')}`
      : 'broad underground fit based on tags and role',
    locationHit
      ? 'local geography matches your profile'
      : `${opp.city || opp.country} is within the pilot opportunity graph`,
    opp.deadline ? `deadline ${new Date(opp.deadline).toLocaleDateString()}` : 'no deadline listed',
  ];

  return {
    opportunity: opp,
    score,
    rationale: rationaleParts.join('; '),
  };
}

function daysFromNow(deadline: string | null): string {
  if (!deadline) return 'Rolling';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'Closed';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function draftApplication(match: OpportunityMatch, displayName: string) {
  const opp = match.opportunity;
  return [
    `Hi ${opp.organizer || 'team'},`,
    '',
    `I am ${displayName}, and I would like to be considered for ${opp.title}.`,
    `MIXHIVE matched this opportunity because ${match.rationale}.`,
    '',
    'Suggested next step: add your strongest mix link, one short proof point, and your availability before sending.',
  ].join('\n');
}

export function Opportunities() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('for-you');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [actions, setActions] = useState<Record<string, OpportunityAction>>({});
  const [selected, setSelected] = useState<OpportunityMatch | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<AgentOutput | null>(null);
  const [matchBusy, setMatchBusy] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function runOpportunityMatch() {
    setMatchBusy(true);
    setMatchError(null);
    setMatchResult(null);
    try {
      const result = await runStrategicAgent('opportunity_match', {}, false);
      setMatchResult(result);
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Match failed');
    } finally {
      setMatchBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch('/api/opportunities?limit=50')
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load opportunities');
        return body.opportunities as Opportunity[];
      })
      .then(data => {
        if (!alive) return;
        setOpportunities(data);
        setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Unable to load opportunities');
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    getOpportunitySaves(user.id)
      .then(saves => {
        const map: Record<string, OpportunityAction> = {};
        saves.forEach(s => {
          map[s.opportunity_id] = s.status;
        });
        setActions(map);
      })
      .catch(() => undefined);
  }, [user]);

  const matches = useMemo(() => {
    return opportunities
      .map(opp => scoreOpportunity(opp, profile?.genres || [], profile?.location))
      .sort((a, b) => b.score - a.score);
  }, [opportunities, profile?.genres, profile?.location]);

  const visibleMatches = matches.filter(match => {
    const status = actions[match.opportunity.id];
    if (tab === 'for-you') return status !== 'dismissed' && status !== 'applied';
    return status === tab;
  });

  function setAction(id: string, action: OpportunityAction, draftText?: string) {
    setActions(prev => ({ ...prev, [id]: action }));
    if (user) upsertOpportunitySave(user.id, id, action, draftText).catch(() => undefined);
  }

  function openDraft(match: OpportunityMatch) {
    setSelected(match);
    setDraft(
      draftApplication(match, profile?.display_name || profile?.username || 'a MIXHIVE creator')
    );
  }

  return (
    <div
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: `${space[9]}px ${space[8]}px ${space[12]}px`,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: space[8],
          alignItems: 'flex-start',
          marginBottom: space[9],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 700 }}>
          <p
            style={{
              margin: `0 0 ${space[3]}px`,
              color: colors.accent,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            Opportunity Graph
          </p>
          <h1
            style={{
              margin: 0,
              color: colors.text.primary,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              lineHeight: 1.1,
            }}
          >
            Find gigs, grants, radio calls, and scene openings.
          </h1>
          <p
            style={{
              margin: `${space[4]}px 0 0`,
              color: colors.text.muted,
              fontSize: fontSize.base,
              lineHeight: 1.6,
            }}
          >
            Explainable matches for the Belgian pilot. MIXHIVE drafts applications, but never sends
            outreach automatically.
          </p>
        </div>
        <div
          style={{
            minWidth: 220,
            borderRadius: radius.xl,
            border: `1px solid ${colors.accentMuted}`,
            background: 'rgba(7,7,5,0.78)',
            padding: `${space[5]}px ${space[6]}px`,
          }}
        >
          <div
            style={{
              color: colors.text.dim,
              fontSize: fontSize.xs,
              textTransform: 'uppercase',
              fontWeight: fontWeight.bold,
              letterSpacing: 0.8,
            }}
          >
            Pilot inventory
          </div>
          <div
            style={{
              color: colors.accent,
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              marginTop: space[2],
            }}
          >
            {opportunities.length}
          </div>
          <div style={{ color: colors.text.muted, fontSize: fontSize.xs }}>
            manual + Supabase-backed opportunities
          </div>
          {user && (
            <button
              type="button"
              onClick={runOpportunityMatch}
              disabled={matchBusy}
              style={{
                marginTop: space[4],
                border: `1px solid ${colors.accent}`,
                borderRadius: radius.lg,
                background: matchBusy ? '#1a1a1a' : colors.accent,
                color: matchBusy ? '#555' : '#0a0a0a',
                padding: `${space[2]}px ${space[4]}px`,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.xs,
                cursor: matchBusy ? 'default' : 'pointer',
                width: '100%',
              }}
            >
              {matchBusy ? (
                'Matching…'
              ) : (
                <>
                  <Icon name="radar" size={15} color="currentColor" /> Match me to opportunities
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {matchError && (
        <div
          style={{
            marginBottom: space[6],
            padding: `${space[4]}px`,
            borderRadius: radius.lg,
            background: 'rgba(220,0,80,0.08)',
            border: '1px solid rgba(220,0,80,0.2)',
            color: '#e05',
            fontSize: fontSize.sm,
          }}
        >
          {matchError}
        </div>
      )}

      {matchResult && matchResult.suggestions.length > 0 && (
        <div
          style={{
            marginBottom: space[8],
            borderRadius: radius.xl,
            border: `1px solid ${colors.accentMuted}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: `${space[4]}px ${space[5]}px`,
              background: 'rgba(240,192,64,0.06)',
              borderBottom: `1px solid ${colors.accentMuted}`,
              color: colors.accent,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.sm,
            }}
          >
            AI Match Results — top {Math.min(3, matchResult.suggestions.length)} of{' '}
            {matchResult.suggestions.length}
          </div>
          <div style={{ padding: `${space[4]}px ${space[5]}px`, display: 'grid', gap: space[3] }}>
            {matchResult.suggestions.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid #222`,
                  borderRadius: radius.lg,
                  padding: `${space[3]}px ${space[4]}px`,
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: space[1],
                  }}
                >
                  <span
                    style={{
                      color: colors.accent,
                      fontSize: fontSize.xs,
                      fontWeight: fontWeight.bold,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
                    {Math.round(s.confidence * 100)}% match
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: colors.text.secondary,
                    fontSize: fontSize.sm,
                    lineHeight: 1.5,
                  }}
                >
                  {s.rationale}
                </p>
              </div>
            ))}
            <a href="/agents/inbox" style={{ color: colors.accent, fontSize: fontSize.xs }}>
              View all in agents inbox →
            </a>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: space[2],
          marginBottom: space[8],
          overflowX: 'auto',
          paddingBottom: space[2],
        }}
      >
        {(Object.keys(tabLabels) as Tab[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flexShrink: 0,
              border: `1px solid ${tab === key ? colors.accent : colors.border}`,
              background: tab === key ? colors.accentFaint : 'rgba(255,255,255,0.03)',
              color: tab === key ? colors.accent : colors.text.muted,
              borderRadius: radius.pill,
              padding: `${space[3]}px ${space[6]}px`,
              fontWeight: fontWeight.bold,
              cursor: 'pointer',
              transition: transition.base,
            }}
          >
            {tabLabels[key]}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: colors.text.muted }}>Loading opportunity matches...</div>}
      {error && <div style={{ color: colors.danger }}>{error}</div>}
      {!loading && !error && visibleMatches.length === 0 && (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            padding: space[10],
            color: colors.text.muted,
            textAlign: 'center',
          }}
        >
          No opportunities in this lane yet.
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: space[6],
        }}
      >
        {visibleMatches.map(match => {
          const opp = match.opportunity;
          return (
            <article
              key={opp.id}
              style={{
                border: `1px solid ${colors.accentMuted}`,
                borderRadius: radius.xl,
                background:
                  'linear-gradient(135deg, rgba(255,216,74,0.06), transparent 34%), rgba(7,7,5,0.82)',
                padding: `${space[7]}px`,
                display: 'flex',
                flexDirection: 'column',
                gap: space[5],
                minHeight: 360,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: space[5],
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    color: colors.accent,
                    background: colors.accentFaint,
                    border: `1px solid ${colors.accentMuted}`,
                    borderRadius: radius.pill,
                    padding: `${space[1]}px ${space[3]}px`,
                    fontSize: fontSize.xs,
                    fontWeight: fontWeight.bold,
                    textTransform: 'uppercase',
                  }}
                >
                  {typeLabels[opp.opp_type] || opp.opp_type}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      color: colors.accent,
                      fontSize: fontSize.lg,
                      fontWeight: fontWeight.bold,
                    }}
                  >
                    {match.score}
                  </div>
                  <div style={{ color: colors.text.dim, fontSize: fontSize.xs }}>match</div>
                </div>
              </div>

              <div>
                <h2
                  style={{
                    margin: 0,
                    color: colors.text.primary,
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    lineHeight: 1.25,
                  }}
                >
                  {opp.title}
                </h2>
                <div style={{ marginTop: space[2], color: colors.text.dim, fontSize: fontSize.xs }}>
                  {[opp.organizer, opp.city, daysFromNow(opp.deadline)].filter(Boolean).join(' · ')}
                </div>
              </div>

              {opp.description && (
                <p
                  style={{
                    margin: 0,
                    color: colors.text.muted,
                    fontSize: fontSize.base,
                    lineHeight: 1.55,
                  }}
                >
                  {opp.description}
                </p>
              )}

              <div
                style={{
                  color: colors.text.secondary,
                  fontSize: fontSize.sm,
                  lineHeight: 1.5,
                  borderLeft: `2px solid ${colors.accentMuted}`,
                  paddingLeft: space[4],
                }}
              >
                <strong style={{ color: colors.accent }}>Why this fits:</strong> {match.rationale}
              </div>

              <div style={{ display: 'flex', gap: space[2], flexWrap: 'wrap', marginTop: 'auto' }}>
                {opp.tags.slice(0, 4).map((tag: string) => (
                  <span
                    key={tag}
                    style={{
                      color: colors.text.dim,
                      fontSize: fontSize.xs,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.pill,
                      padding: `${space[1]}px ${space[3]}px`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: space[3], flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setAction(opp.id, 'saved')}
                  style={buttonStyle('secondary')}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => openDraft(match)}
                  style={buttonStyle('primary')}
                >
                  Draft application
                </button>
                <button
                  type="button"
                  onClick={() => setAction(opp.id, 'dismissed')}
                  style={buttonStyle('ghost')}
                >
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 400,
            background: 'rgba(0,0,0,0.72)',
            display: 'grid',
            placeItems: 'center',
            padding: space[6],
          }}
        >
          <div
            style={{
              width: 'min(680px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${colors.accentMuted}`,
              borderRadius: radius.xl,
              background: 'rgba(7,7,5,0.98)',
              padding: `${space[8]}px`,
              boxShadow: '0 24px 80px rgba(0,0,0,0.72)',
            }}
          >
            <h2 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize.xl }}>
              Application draft
            </h2>
            <p
              style={{
                margin: `${space[3]}px 0 ${space[6]}px`,
                color: colors.text.muted,
                lineHeight: 1.5,
              }}
            >
              Review and edit this draft manually. MIXHIVE does not send applications or messages
              automatically.
            </p>
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              rows={10}
              style={{
                width: '100%',
                resize: 'vertical',
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                background: 'rgba(255,255,255,0.04)',
                color: colors.text.primary,
                padding: space[5],
                font: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: space[3],
                marginTop: space[6],
                flexWrap: 'wrap',
              }}
            >
              <button type="button" onClick={() => setSelected(null)} style={buttonStyle('ghost')}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setAction(selected.opportunity.id, 'applied', draft);
                  setSelected(null);
                }}
                style={buttonStyle('primary')}
              >
                Mark draft ready
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buttonStyle(variant: 'primary' | 'secondary' | 'ghost'): React.CSSProperties {
  const primary = variant === 'primary';
  const secondary = variant === 'secondary';
  return {
    border: `1px solid ${primary ? colors.accent : colors.border}`,
    background: primary
      ? `linear-gradient(135deg, #ffde4d, ${colors.accent})`
      : secondary
        ? colors.accentFaint
        : 'transparent',
    color: primary ? colors.bg : secondary ? colors.accent : colors.text.muted,
    borderRadius: radius.md,
    padding: `${space[3]}px ${space[5]}px`,
    fontWeight: fontWeight.bold,
    cursor: 'pointer',
    minHeight: 40,
  };
}
