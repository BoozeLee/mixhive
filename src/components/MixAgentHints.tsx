// Collapsible "Automate this" panel on MixDetail.
//
// Surfaces the Lua agent layer where creators actually look every day.
// Two variants:
//   - Mix owner: list the events this mix fires, with deep-links into
//     the agent editor pre-loaded with the right trigger + starter.
//   - Visitor : a single CTA pointing at the public gallery.
//
// The panel ships collapsed (<details>) so it never pushes the comments
// below the fold on first view.

import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Mix } from '../lib/types';
import type { LuaAgentTrigger } from '../lib/agents';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { Icon } from './ui/Icon';

interface Props {
  mix: Mix;
  djUsername?: string | null;
}

const OWNER_TRIGGERS: { trigger: LuaAgentTrigger; label: string; example: string }[] = [
  {
    trigger: 'on_comment',
    label: 'On comment',
    example: 'Reply to every commenter with a thank-you.',
  },
  { trigger: 'on_like', label: 'On like', example: 'Follow back anyone who likes your mix.' },
  {
    trigger: 'on_repost',
    label: 'On repost',
    example: 'Like the reposter’s most recent mix back.',
  },
  {
    trigger: 'on_mention',
    label: 'On mention',
    example: 'Get a private notification when you’re tagged.',
  },
];

export function MixAgentHints({ mix, djUsername }: Props) {
  const { user } = useAuth();
  const isOwner = user?.id === mix.dj_id;

  return (
    <section
      style={{
        marginTop: space[11],
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <details>
        <summary
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[5],
            padding: space[8],
            cursor: 'pointer',
            listStyle: 'none',
            color: colors.text.primary,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.md,
          }}
        >
          <span aria-hidden="true" style={{ display: 'inline-flex' }}>
            <Icon name="agents" size={16} />
          </span>
          <span style={{ flex: 1 }}>
            {isOwner ? 'Automate this mix with Lua' : 'Automate how you engage'}
          </span>
          <span aria-hidden="true" style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
            ▾
          </span>
        </summary>

        <div
          style={{
            padding: `0 ${space[8]}px ${space[8]}px`,
            color: colors.text.secondary,
            fontSize: fontSize.md,
            lineHeight: 1.5,
          }}
        >
          {isOwner ? (
            <>
              <p style={{ margin: `0 0 ${space[7]}px`, color: colors.text.muted }}>
                Each of these events fires on this mix. Click any one to open the editor with a
                starter template for that trigger pre-loaded.
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[5],
                }}
              >
                {OWNER_TRIGGERS.map(({ trigger, label, example }) => (
                  <li
                    key={trigger}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: space[6],
                      padding: space[6],
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: colors.text.primary,
                          fontWeight: fontWeight.semibold,
                          fontSize: fontSize.sm,
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{ color: colors.text.muted, fontSize: fontSize.xs, marginTop: 2 }}
                      >
                        {example}
                      </div>
                    </div>
                    <Link
                      to={`/agents?new=1&trigger=${trigger}`}
                      style={{
                        flexShrink: 0,
                        padding: '6px 12px',
                        borderRadius: radius.md,
                        background: colors.accent,
                        color: colors.bg,
                        textDecoration: 'none',
                        fontWeight: fontWeight.bold,
                        fontSize: fontSize.sm,
                      }}
                    >
                      Create agent →
                    </Link>
                  </li>
                ))}
              </ul>
              <p
                style={{
                  margin: `${space[7]}px 0 0`,
                  color: colors.text.dim,
                  fontSize: fontSize.xs,
                }}
              >
                Lua agents run server-side in a sandboxed Lupa runtime.{' '}
                <Link to="/agents/gallery" style={{ color: colors.accent }}>
                  Browse the starter library →
                </Link>
              </p>
            </>
          ) : (
            <p style={{ margin: 0 }}>
              Write a tiny Lua script that reacts when you engage with @{djUsername ?? 'this DJ'}’s
              mixes — auto-thank them for a great set, queue up a follow-back, schedule a weekly
              listening reminder.{' '}
              <Link to="/agents/gallery" style={{ color: colors.accent }}>
                Browse the starter library →
              </Link>
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
