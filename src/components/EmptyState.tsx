import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  icon?: string
  title: string
  body?: ReactNode
  actionLabel?: string
  actionTo?: string
  onAction?: () => void
}

export function EmptyState({ icon = '♪', title, body, actionLabel, actionTo, onAction }: Props) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        color: '#999',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a1a2e, #f0c04022)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          color: '#f0c04088',
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <h2 style={{ margin: 0, color: '#eee', fontSize: 18, fontWeight: 600 }}>{title}</h2>
      {body && <div style={{ marginTop: 8, maxWidth: 380, lineHeight: 1.5 }}>{body}</div>}
      {actionLabel && (actionTo || onAction) && (
        actionTo ? (
          <Link
            to={actionTo}
            style={{
              marginTop: 20,
              padding: '8px 20px',
              borderRadius: 6,
              background: '#f0c040',
              color: '#0a0a0a',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            style={{
              marginTop: 20,
              padding: '8px 20px',
              borderRadius: 6,
              background: '#f0c040',
              color: '#0a0a0a',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}

export function NotFoundState({ what = 'item', backTo = '/feed', backLabel = 'Back to feed' }: { what?: string; backTo?: string; backLabel?: string }) {
  return (
    <EmptyState
      icon="?"
      title={`This ${what} doesn't exist`}
      body="It might have been deleted, made private, or the link is wrong."
      actionLabel={backLabel}
      actionTo={backTo}
    />
  )
}
