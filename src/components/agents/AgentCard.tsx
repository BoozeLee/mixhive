import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/Button';
import { colors, fontSize, fontWeight, radius, space, transition } from '../../styles/tokens';
import type { StarterAgent } from '../../lib/starter_agents';
import type { PublicLuaAgent } from '../../lib/agents';

type Agent = ({ kind: 'starter' } & StarterAgent) | ({ kind: 'community' } & PublicLuaAgent);

interface AgentCardProps {
  agent: Agent;
  forking: boolean;
  onFork: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  social: '#8b5cf6',
  growth: '#22c55e',
  discovery: '#3b82f6',
  moderation: '#ef4444',
  release: '#f59e0b',
  schedule: '#06b6d4',
  engagement: '#ec4899',
};

export function AgentCard({ agent, forking, onFork }: AgentCardProps) {
  const t = useTranslations('agentsGallery');
  const [expanded, setExpanded] = useState(false);
  const [forkError, setForkError] = useState('');

  const tags = agent.tags ?? [];
  const codePreviewLength = 320;
  const code = agent.lua_code;
  const hasMore = code.length > codePreviewLength;

  async function handleFork() {
    setForkError('');
    try {
      onFork();
    } catch (e) {
      setForkError(t('forkError', { message: e instanceof Error ? e.message : 'unknown' }));
    }
  }

  return (
    <article
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: space[8],
        display: 'flex',
        flexDirection: 'column',
        gap: space[5],
        height: '100%',
        transition: `border-color ${transition.fast}`,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
    >
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
          <h3
            style={{
              margin: 0,
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
            }}
          >
            {agent.name}
          </h3>
          {agent.kind === 'starter' && (
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: fontWeight.bold,
                padding: '2px 8px',
                borderRadius: radius.pill,
                background: colors.accentFaint,
                color: colors.accent,
                textTransform: 'uppercase',
              }}
            >
              Starter
            </span>
          )}
        </div>
        <div style={{ marginTop: 4, color: colors.text.muted, fontSize: fontSize.sm }}>
          {agent.trigger_type}
          {'kind' in agent &&
            agent.kind === 'community' &&
            agent.cron_expr &&
            ` · ${agent.cron_expr}`}
          {'kind' in agent && agent.kind === 'community' && (
            <>
              {' · '}
              {t('byCreator', { username: agent.owner_username ?? '…' })}
            </>
          )}
          {'kind' in agent && agent.kind === 'community' && (
            <>
              {' · '}
              {t('forks', { count: agent.fork_count ?? 0 })}
            </>
          )}
        </div>
      </header>

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => {
            const tagColor = CATEGORY_COLORS[tag.toLowerCase()] ?? colors.accent;
            return (
              <span
                key={tag}
                style={{
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.semibold,
                  padding: '3px 8px',
                  borderRadius: radius.pill,
                  background: `${tagColor}22`,
                  border: `1px solid ${tagColor}66`,
                  // Category hue stays in the bg/border; text uses a
                  // high-contrast token so the label passes WCAG AA (axe
                  // color-contrast) instead of tinted-on-tinted purple.
                  color: colors.text.primary,
                  textTransform: 'capitalize',
                }}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      <p style={{ margin: 0, color: colors.text.secondary, fontSize: fontSize.md, flex: 1 }}>
        {agent.description}
      </p>

      <div
        style={{
          background: colors.bg,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${space[3]}px ${space[5]}px`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <span
            style={{
              fontSize: fontSize.xs,
              color: colors.text.dim,
              fontWeight: fontWeight.semibold,
            }}
          >
            {t('codePreview')}
          </span>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.accent,
                fontSize: fontSize.xs,
                fontWeight: fontWeight.semibold,
                cursor: 'pointer',
              }}
            >
              {expanded ? t('showLess') : t('showMore')}
            </button>
          )}
        </div>
        {/* A scrollable code region must be keyboard-focusable (WCAG 2.1.1 /
            axe scrollable-region-focusable); jsx-a11y's tabindex rule conflicts
            with that here, so it is scoped-disabled for this one element. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <pre tabIndex={0}
          role="region"
          aria-label="Agent code preview"
          style={{
            margin: 0,
            color: colors.text.muted,
            padding: space[6],
            fontSize: fontSize.xs,
            maxHeight: expanded ? 400 : 140,
            overflow: 'auto',
            fontFamily: 'Menlo, Consolas, monospace',
            transition: `max-height ${transition.base}`,
          }}
        >
          {expanded ? code : `${code.slice(0, codePreviewLength)}${hasMore ? '…' : ''}`}
        </pre>
      </div>

      {forkError && (
        <div
          style={{
            padding: space[4],
            background: colors.dangerBg,
            border: `1px solid ${colors.danger}`,
            borderRadius: radius.md,
            color: colors.danger,
            fontSize: fontSize.sm,
          }}
        >
          {forkError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[3] }}>
        {'kind' in agent && agent.kind === 'community' && (
          <Link to={`/u/${agent.owner_username}`} style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm">
              {t('viewDetails')}
            </Button>
          </Link>
        )}
        <Button onClick={handleFork} loading={forking} size="sm">
          {t('forkIntoMyAccount')}
        </Button>
      </div>
    </article>
  );
}
