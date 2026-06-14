import { useState } from 'react';
import { reportContent } from '../lib/api';
import { colors, radius, space } from '../styles/tokens';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';

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
    return <span style={{ color: colors.text.dim, fontSize: 11 }}>✓ Reported — thanks</span>;
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Report
      </Button>
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
      <Textarea
        label="Report reason"
        hideLabel
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="What's wrong with this? (optional)"
        rows={2}
        style={{ resize: 'vertical' }}
      />
      {error && <span style={{ color: colors.danger, fontSize: 11 }}>{error}</span>}
      <div style={{ display: 'flex', gap: space[3] }}>
        <Button variant="danger" size="sm" onClick={submit} disabled={busy} loading={busy}>
          {busy ? 'Reporting…' : 'Submit report'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
