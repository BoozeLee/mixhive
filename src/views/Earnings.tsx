import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '../styles/tokens';
import { Button } from '../components/ui/Button';
import { supabase } from '../lib/supabase';

interface ConnectStatus {
  onboarded: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  onboarding_state?: string;
  requirements_due?: string[];
}

interface LedgerRow {
  id: string;
  source_type: string;
  source_id: string;
  gross_amount: number;
  platform_fee: number;
  net_to_seller: number;
  currency: string;
  status: string;
  stripe_transfer_id: string | null;
  created_at: string;
}

interface PendingTxn {
  id: string;
  agreed_price: number;
  currency: string;
  transaction_state: string;
}

function sumByCurrency(
  rows: { net_to_seller?: number; agreed_price?: number; currency: string }[],
  key: 'net_to_seller' | 'agreed_price'
) {
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const v = Number(r[key] ?? 0);
    totals[r.currency] = (totals[r.currency] ?? 0) + v;
  }
  return totals;
}

function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return '€0.00';
  return entries
    .map(([cur, amt]) => `${cur === 'EUR' ? '€' : cur + ' '}${amt.toFixed(2)}`)
    .join(' · ');
}

export function Earnings() {
  const t = useTranslations('earnings');
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [pending, setPending] = useState<PendingTxn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view your earnings.');
        setLoading(false);
        return;
      }
      const uid = session.user.id;

      const statusRes = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (statusRes.ok) setStatus(await statusRes.json());

      const [{ data: ledgerRows }, { data: pendingTxns }] = await Promise.all([
        supabase
          .from('platform_fee_ledger')
          .select(
            'id, source_type, source_id, gross_amount, platform_fee, net_to_seller, currency, status, stripe_transfer_id, created_at'
          )
          .eq('seller_profile_id', uid)
          .order('created_at', { ascending: false }),
        supabase
          .from('equipment_transactions')
          .select('id, agreed_price, currency, transaction_state')
          .eq('seller_profile_id', uid)
          .in('transaction_state', ['paid_escrow', 'shipped', 'delivered']),
      ]);

      setLedger((ledgerRows ?? []) as LedgerRow[]);
      setPending((pendingTxns ?? []) as PendingTxn[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Please sign in first');
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start onboarding');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start onboarding');
      setConnecting(false);
    }
  };

  const paidTotals = formatTotals(
    sumByCurrency(
      ledger.filter(l => l.status === 'transferred'),
      'net_to_seller'
    )
  );
  const heldTotals = formatTotals(
    sumByCurrency(
      ledger.filter(l => l.status === 'held'),
      'net_to_seller'
    )
  );
  const pendingTotals = formatTotals(sumByCurrency(pending, 'agreed_price'));

  return (
    <div style={{ padding: '24px 20px', maxWidth: 920, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: 28,
          fontFamily: 'var(--font-display)',
          color: 'var(--hive-gold)',
          margin: 0,
          letterSpacing: '0.05em',
        }}
      >
        {t('title')}
      </h1>
      <p style={{ color: colors.text.muted, margin: '4px 0 24px', fontSize: 14 }}>
        Your marketplace payouts — gear sales and agent packages.
      </p>

      {error && (
        <div
          style={{
            color: colors.dangerStrong,
            padding: 16,
            background: colors.dangerBgDeep,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Payout account status */}
      <div style={cardStyle}>
        {loading && !status ? (
          <p style={{ color: colors.text.faint }}>{t('loadingPayoutStatus')}</p>
        ) : status?.payouts_enabled ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: colors.successStrong, fontSize: 20 }}>✓</span>
            <span style={{ color: colors.text.secondary }}>{t('payoutsActive')}</span>
          </div>
        ) : (
          <div>
            <p style={{ color: colors.white, fontWeight: 600, margin: '0 0 6px' }}>
              {t('setupPayouts')}
            </p>
            <p style={{ color: colors.text.muted, fontSize: 13, margin: '0 0 14px' }}>
              {status?.onboarded ? t('stripeNeedsDetails') : t('connectStripePrompt')}
            </p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              style={{ background: 'var(--hive-gold)' }}
            >
              {connecting
                ? t('openingStripe')
                : status?.onboarded
                  ? t('finishPayoutSetup')
                  : t('setUpPayouts')}
            </Button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginTop: 16,
        }}
      >
        <Stat label={t('paidOut')} value={paidTotals} accent="var(--hive-gold)" />
        <Stat label={t('pendingEscrow')} value={pendingTotals} accent={colors.warning} />
        <Stat label={t('held')} value={heldTotals} accent={colors.text.muted} />
      </div>

      {/* History */}
      <h2
        style={{
          fontSize: 16,
          color: colors.text.secondary,
          margin: '32px 0 12px',
          letterSpacing: '0.04em',
        }}
      >
        {t('payoutHistory')}
      </h2>
      {loading ? (
        <div
          style={{
            height: 160,
            background: colors.surface,
            borderRadius: 10,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ) : ledger.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 20px',
            color: colors.text.faintest,
            background: colors.surfaceMuted,
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>🪙</div>
          <p>{t('noPayouts')}</p>
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            border: `1px solid ${colors.surfaceRaised}`,
            borderRadius: 10,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: colors.text.muted, textAlign: 'left' }}>
                <th style={th}>{t('date')}</th>
                <th style={th}>{t('source')}</th>
                <th style={th}>{t('gross')}</th>
                <th style={th}>{t('fee')}</th>
                <th style={th}>{t('net')}</th>
                <th style={th}>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(row => (
                <tr
                  key={row.id}
                  style={{
                    borderTop: `1px solid ${colors.surfaceRaised}`,
                    color: colors.text.secondary,
                  }}
                >
                  <td style={td}>{new Date(row.created_at).toLocaleDateString()}</td>
                  <td style={td}>{row.source_type === 'gear' ? 'Gear sale' : 'Agent package'}</td>
                  <td style={td}>€{Number(row.gross_amount).toFixed(2)}</td>
                  <td style={td}>€{Number(row.platform_fee).toFixed(2)}</td>
                  <td style={{ ...td, color: 'var(--hive-gold)', fontWeight: 600 }}>
                    €{Number(row.net_to_seller).toFixed(2)}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        color:
                          row.status === 'transferred'
                            ? colors.successStrong
                            : row.status === 'held'
                              ? colors.warning
                              : colors.text.muted,
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={cardStyle}>
      <p
        style={{
          color: colors.text.muted,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 6px',
        }}
      >
        {label}
      </p>
      <p style={{ color: accent, fontSize: 24, fontWeight: 700, margin: 0 }}>{value}</p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: colors.surfaceMuted,
  border: `1px solid ${colors.surfaceRaised}`,
  borderRadius: 10,
  padding: 18,
};

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: '10px 14px' };
