import { useState } from 'react';
import { reportContent } from '../lib/api';
import { colors, radius, space } from '../styles/tokens';

interface Props {
  sourceTable: 'buzzes' | 'mixes' | 'profiles' | 'equipment_listings';
  sourceId: string;
}

/** User-facing "report this content" affordance. Mirrors BlockButton but opens
 *  a small reason field, then posts via reportContent → /api/reports. */
export function ReportButton({ sourceTable, sourceId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = await reportContent({ sourceTable, sourceId, reason: reason.trim() });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setOpen(false);
    } else {
      setError(res.error ?? 'Could not file report');
    }
  }

  if (done) {
    return (
      <span style={{ color: colors.text.dim, fontSize: 11 }}>✓ Reported — thanks</span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent',
          border: `1px solid ${colors.border}`,
          color: colors.text.dim,
          padding: '4px 12px',
          borderRadius: radius.md,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        Report
      </button>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: space[3],
        padding: space[4],
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        background: colors.surface,
        maxWidth: 320,
      }}
    >
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="What's wrong with this? (optional)"
        rows={2}
        aria-label="Report reason"
        style={{
          background: colors.bg,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radius.sm,
          color: colors.text.primary,
          padding: space[3],
          fontSize: 12,
          resize: 'vertical',
        }}
      />
      {error && <span style={{ color: colors.danger, fontSize: 11 }}>{error}</span>}
      <div style={{ display: 'flex', gap: space[3] }}>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            background: colors.danger,
            border: 'none',
            color: colors.bg,
            padding: '5px 12px',
            borderRadius: radius.sm,
            cursor: busy ? 'wait' : 'pointer',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {busy ? 'Reporting…' : 'Submit report'}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            color: colors.text.dim,
            padding: '5px 12px',
            borderRadius: radius.sm,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
