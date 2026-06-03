import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { AISuggestionCard } from '../components/AISuggestionCard';
import { NftMintModal } from '../components/NftMintModal';
import type { AISuggestion, CreatorTask, Opportunity } from '../lib/types';
import { colors, space, radius, fontSize, fontWeight, transition } from '../styles/tokens';
import { trackEvent } from '../lib/experiments';

type Web3ProposalTarget = {
  sourceType: 'mix' | 'quest' | 'event';
  sourceId: string;
  estimatedSupply?: number;
};

type Tab = 'suggestions' | 'tasks' | 'opportunities';

async function patchSuggestion(
  token: string,
  id: string,
  action: 'apply' | 'reject' | 'rate',
  rating?: number
) {
  await fetch(`/api/ai/suggestions/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, rating }),
  });
}

const oppTypeLabels: Record<string, string> = {
  gig: 'Gig',
  grant: 'Grant',
  residency: 'Residency',
  contest: 'Contest',
  festival: 'Festival',
  collab_call: 'Collab Call',
  radio: 'Radio',
};

const taskTypeLabels: Record<string, string> = {
  complete_profile: 'Complete Profile',
  upload_mix: 'Upload Mix',
  apply_opportunity: 'Apply to Opportunity',
  review_suggestion: 'Review Suggestion',
};

function daysFromNow(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / 86400000);
}

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const daysUntil = opp.deadline ? daysFromNow(opp.deadline) : null;

  return (
    <article
      style={{
        background:
          'linear-gradient(135deg, rgba(255,216,74,0.04), transparent 32%), rgba(7,7,5,0.78)',
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.xl,
        padding: `${space[7]}px ${space[8]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space[4],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space[5],
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              marginBottom: space[2],
              flexWrap: 'wrap',
            }}
          >
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
              {oppTypeLabels[opp.opp_type] ?? opp.opp_type}
            </span>
            {opp.city && (
              <span style={{ fontSize: fontSize.xs, color: colors.text.muted }}>◈ {opp.city}</span>
            )}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: fontSize.md,
              fontWeight: fontWeight.bold,
              color: colors.text.primary,
              lineHeight: 1.4,
            }}
          >
            {opp.title}
          </h3>
          {opp.organizer && (
            <div style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: space[1] }}>
              by {opp.organizer}
            </div>
          )}
        </div>
        {daysUntil !== null && (
          <div
            style={{
              flexShrink: 0,
              textAlign: 'right',
              padding: `${space[2]}px ${space[4]}px`,
              borderRadius: radius.md,
              background: daysUntil <= 7 ? 'rgba(255,85,85,0.1)' : colors.accentFaint,
              border: `1px solid ${daysUntil <= 7 ? 'rgba(255,85,85,0.3)' : colors.accentMuted}`,
            }}
          >
            <div
              style={{
                fontSize: fontSize.xs,
                color: daysUntil <= 7 ? colors.danger : colors.text.muted,
              }}
            >
              Deadline
            </div>
            <div
              style={{
                fontSize: fontSize.base,
                fontWeight: fontWeight.bold,
                color: daysUntil <= 7 ? colors.danger : colors.text.secondary,
              }}
            >
              {daysUntil <= 0 ? 'Closed' : `${daysUntil}d`}
            </div>
          </div>
        )}
      </div>

      {opp.description && (
        <p
          style={{
            margin: 0,
            fontSize: fontSize.base,
            color: colors.text.muted,
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {opp.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: space[5], flexWrap: 'wrap' }}>
        {opp.compensation && (
          <span style={{ fontSize: fontSize.xs, color: colors.success }}>
            💶 {opp.compensation}
          </span>
        )}
        {opp.genres.slice(0, 3).map(g => (
          <span
            key={g}
            style={{
              fontSize: fontSize.xs,
              color: colors.text.dim,
              padding: `${space[1]}px ${space[3]}px`,
              borderRadius: radius.pill,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${colors.border}`,
            }}
          >
            {g}
          </span>
        ))}
        {opp.source_url && (
          <a
            href={opp.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 'auto',
              fontSize: fontSize.xs,
              color: colors.accent,
              textDecoration: 'underline',
              textDecorationColor: colors.accentMuted,
            }}
          >
            View →
          </a>
        )}
      </div>
    </article>
  );
}

function TaskCard({ task, onDone }: { task: CreatorTask; onDone: (id: string) => void }) {
  return (
    <div
      style={{
        background: 'rgba(7,7,5,0.78)',
        border: `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding: `${space[5]}px ${space[7]}px`,
        display: 'flex',
        alignItems: 'center',
        gap: space[5],
      }}
    >
      <button
        onClick={() => onDone(task.id)}
        aria-label="Mark as done"
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: radius.sm,
          border: `2px solid ${colors.accentMuted}`,
          background: 'transparent',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          color: colors.accent,
          fontSize: 12,
          transition: transition.fast,
        }}
      >
        ✓
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: fontSize.base,
            color: colors.text.primary,
            fontWeight: fontWeight.medium,
          }}
        >
          {task.title}
        </div>
        <div style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: space[1] }}>
          {taskTypeLabels[task.task_type] ?? task.task_type}
          {task.due_date && ` · due ${new Date(task.due_date).toLocaleDateString()}`}
        </div>
      </div>
      <div
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background:
            task.priority === 1
              ? colors.danger
              : task.priority === 2
                ? colors.warning
                : colors.text.faint,
        }}
      />
    </div>
  );
}

export function AgentInbox() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('suggestions');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [tasks, setTasks] = useState<CreatorTask[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState<Record<Tab, boolean>>({
    suggestions: true,
    tasks: true,
    opportunities: true,
  });
  const [error, setError] = useState<Record<Tab, string | null>>({
    suggestions: null,
    tasks: null,
    opportunities: null,
  });
  const [web3Target, setWeb3Target] = useState<Web3ProposalTarget | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from('ai_suggestions')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error: err }) => {
        setSuggestions((data ?? []) as AISuggestion[]);
        if (err) setError(prev => ({ ...prev, suggestions: err.message }));
        setLoading(prev => ({ ...prev, suggestions: false }));
      });

    supabase
      .from('creator_tasks')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', 'open')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error: err }) => {
        setTasks((data ?? []) as CreatorTask[]);
        if (err) setError(prev => ({ ...prev, tasks: err.message }));
        setLoading(prev => ({ ...prev, tasks: false }));
      });

    fetch('/api/opportunities?limit=20')
      .then(r => r.json())
      .then((json: { opportunities?: Opportunity[] }) => {
        setOpportunities(json.opportunities ?? []);
        setLoading(prev => ({ ...prev, opportunities: false }));
      })
      .catch(err => {
        setError(prev => ({ ...prev, opportunities: err.message }));
        setLoading(prev => ({ ...prev, opportunities: false }));
      });
  }, [user]);

  async function handleApply(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const suggestion = suggestions.find(s => s.id === id);

    // web3_proposal: patch status then open the appropriate modal
    if (suggestion?.suggestion_type === 'web3_proposal') {
      await patchSuggestion(session.access_token, id, 'apply');
      setSuggestions(prev =>
        prev.map(s => (s.id === id ? { ...s, status: 'applied' as const } : s))
      );
      const p = suggestion.payload;
      const action = p.action as string | undefined;
      const sourceId = p.source_id as string | undefined;
      const estimatedSupply = (p.estimated_supply as number | undefined) ?? 50;
      if (sourceId) {
        const sourceType: 'mix' | 'quest' | 'event' =
          action === 'open_quest_backing'
            ? 'quest'
            : action === 'check_gig_proof'
              ? 'event'
              : 'mix';
        setWeb3Target({ sourceType, sourceId, estimatedSupply });
      }
      if (user) {
        trackEvent(user.id, 'web3_proposal_accepted', 'ai_suggestions', {
          agent_id: suggestion.source ?? null,
          action: action ?? null,
          source_id: sourceId ?? null,
        });
      }
      return;
    }

    await patchSuggestion(session.access_token, id, 'apply');
    setSuggestions(prev => prev.map(s => (s.id === id ? { ...s, status: 'applied' as const } : s)));
  }

  async function handleReject(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await patchSuggestion(session.access_token, id, 'reject');
    setSuggestions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: 'rejected' as const } : s))
    );
    const suggestion = suggestions.find(s => s.id === id);
    if (suggestion?.suggestion_type === 'web3_proposal' && user) {
      trackEvent(user.id, 'web3_proposal_dismissed', 'ai_suggestions', {
        agent_id: suggestion.source ?? null,
        action: (suggestion.payload.action as string | null) ?? null,
        source_id: (suggestion.payload.source_id as string | null) ?? null,
      });
    }
  }

  async function handleRate(id: string, rating: number) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await patchSuggestion(session.access_token, id, 'rate', rating);
  }

  async function handleTaskDone(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await supabase
      .from('creator_tasks')
      .update({ status: 'done' })
      .eq('id', id)
      .eq('owner_id', user!.id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    {
      key: 'suggestions',
      label: 'Suggestions',
      count: suggestions.filter(s => s.status === 'pending').length || undefined,
    },
    { key: 'tasks', label: 'Tasks', count: tasks.length || undefined },
    { key: 'opportunities', label: 'Opportunities', count: opportunities.length || undefined },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: `${space[9]}px ${space[8]}px` }}>
      {/* Page header */}
      <div style={{ marginBottom: space[7] }}>
        <h1
          style={{
            margin: 0,
            fontSize: fontSize['3xl'],
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
          }}
        >
          Agent Inbox
        </h1>
        <p
          style={{ margin: `${space[3]}px 0 0`, fontSize: fontSize.base, color: colors.text.muted }}
        >
          Your AI suggestions, tasks, and matched opportunities.
        </p>
      </div>

      {/* Trust statement */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[5],
          padding: `${space[4]}px ${space[6]}px`,
          marginBottom: space[8],
          borderRadius: radius.md,
          background: 'rgba(255,216,74,0.04)',
          border: `1px solid ${colors.accentMuted}`,
        }}
      >
        <span style={{ flexShrink: 0, fontSize: 14, color: colors.accent }}>⬡</span>
        <p style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.dim, lineHeight: 1.5 }}>
          AI is <strong style={{ color: colors.text.muted }}>assistive, not autonomous</strong> —
          every suggestion requires your review and approval before it changes anything on your
          profile.
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: space[2],
          marginBottom: space[8],
          borderBottom: `1px solid ${colors.border}`,
          position: 'sticky',
          top: 73,
          zIndex: 10,
          background: 'linear-gradient(180deg, rgba(3,3,3,0.95) 80%, transparent)',
          paddingTop: space[4],
        }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: `${space[4]}px ${space[6]}px`,
              fontSize: fontSize.base,
              fontWeight: tab === t.key ? fontWeight.bold : fontWeight.normal,
              color: tab === t.key ? colors.accent : colors.text.muted,
              borderBottom: `2px solid ${tab === t.key ? colors.accent : 'transparent'}`,
              transition: transition.base,
              marginBottom: -1,
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: radius.pill,
                  background: tab === t.key ? colors.accent : colors.border,
                  color: tab === t.key ? colors.bg : colors.text.muted,
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Suggestions tab */}
      {tab === 'suggestions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          {loading.suggestions && (
            <div style={{ color: colors.text.muted, fontSize: fontSize.base }}>
              Loading suggestions…
            </div>
          )}
          {error.suggestions && (
            <div style={{ color: colors.danger, fontSize: fontSize.base }}>{error.suggestions}</div>
          )}
          {!loading.suggestions && suggestions.length === 0 && (
            <div
              style={{ textAlign: 'center', padding: `${space[12]}px 0`, color: colors.text.muted }}
            >
              <div style={{ fontSize: 32, marginBottom: space[5] }}>⬡</div>
              <div style={{ fontSize: fontSize.md }}>No AI suggestions yet.</div>
              <div style={{ fontSize: fontSize.base, marginTop: space[3] }}>
                Go to your Dashboard and click "Analyse profile" to get started.
              </div>
            </div>
          )}
          {suggestions.map(s => (
            <AISuggestionCard
              key={s.id}
              suggestion={s}
              profileId={user?.id}
              onApply={handleApply}
              onReject={handleReject}
              onRate={handleRate}
            />
          ))}
        </div>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          {loading.tasks && (
            <div style={{ color: colors.text.muted, fontSize: fontSize.base }}>Loading tasks…</div>
          )}
          {error.tasks && (
            <div style={{ color: colors.danger, fontSize: fontSize.base }}>{error.tasks}</div>
          )}
          {!loading.tasks && tasks.length === 0 && (
            <div
              style={{ textAlign: 'center', padding: `${space[12]}px 0`, color: colors.text.muted }}
            >
              <div style={{ fontSize: 32, marginBottom: space[5] }}>✓</div>
              <div style={{ fontSize: fontSize.md }}>All caught up.</div>
              <div style={{ fontSize: fontSize.base, marginTop: space[3] }}>
                No open tasks right now.
              </div>
            </div>
          )}
          {tasks.map(t => (
            <TaskCard key={t.id} task={t} onDone={handleTaskDone} />
          ))}
        </div>
      )}

      {/* Opportunities tab */}
      {tab === 'opportunities' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          {loading.opportunities && (
            <div style={{ color: colors.text.muted, fontSize: fontSize.base }}>
              Loading opportunities…
            </div>
          )}
          {error.opportunities && (
            <div style={{ color: colors.danger, fontSize: fontSize.base }}>
              {error.opportunities}
            </div>
          )}
          {!loading.opportunities && opportunities.length === 0 && (
            <div
              style={{ textAlign: 'center', padding: `${space[12]}px 0`, color: colors.text.muted }}
            >
              <div style={{ fontSize: 32, marginBottom: space[5] }}>◇</div>
              <div style={{ fontSize: fontSize.md }}>No opportunities available.</div>
            </div>
          )}
          {opportunities.map(o => (
            <OpportunityCard key={o.id} opp={o} />
          ))}
          <p
            style={{
              margin: `${space[6]}px 0 0`,
              fontSize: fontSize.xs,
              color: colors.text.faint,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            MixHive never contacts anyone automatically. All applications and outreach require your
            review.
          </p>
        </div>
      )}

      {web3Target && (
        <NftMintModal
          isOpen
          onClose={() => setWeb3Target(null)}
          sourceType={web3Target.sourceType}
          sourceId={web3Target.sourceId}
          defaultConfig={{ max_supply: web3Target.estimatedSupply }}
        />
      )}
    </div>
  );
}
