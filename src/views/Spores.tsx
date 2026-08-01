import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SporeCard } from '../components/SporeCard';
import { EmptyState } from '../components/EmptyState';
import { SkeletonBar } from '../components/Skeleton';
import { ErrorComponent } from '../components/ErrorComponent';
import { ritualRequest, type FlowSpore, type GerminationTarget } from '../lib/rituals';
import { hasInjectedWallet, personalSign, requestWalletAddress } from '../lib/browser-wallet';
import { colors, fontSize, fontWeight, layout, space } from '../styles/tokens';

export function Spores() {
  const [spores, setSpores] = useState<FlowSpore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ritualRequest<{ spores: FlowSpore[] }>('/api/flow-spores');
      setSpores(res.spores);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load spores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const germinate = useCallback(
    async (sporeId: string, target: GerminationTarget) => {
      try {
        const res = await ritualRequest<{ generation: number; next: string | null }>(
          `/api/flow-spores/${sporeId}/germinate`,
          { method: 'POST', body: JSON.stringify({ target }) }
        );
        toast.success(`Grown — generation ${res.generation}`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'It would not take root');
      }
    },
    [load]
  );

  const countersign = useCallback(
    async (sporeId: string) => {
      const address = await requestWalletAddress();
      if (!address) {
        toast.error('No wallet available to sign with');
        return;
      }
      try {
        // The message comes from the server, never composed here — both sides
        // must derive it from the same function or the signature will not verify.
        const { message } = await ritualRequest<{ message: string }>(
          `/api/flow-spores/${sporeId}/countersign?address=${address}`
        );
        const signature = await personalSign(address, message);
        if (!signature) {
          // A refusal at the wallet is a choice, not a failure.
          return;
        }
        await ritualRequest(`/api/flow-spores/${sporeId}/countersign`, {
          method: 'POST',
          body: JSON.stringify({ address, signature }),
        });
        toast.success('Signed — that is your word on it now');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not record the signature');
      }
    },
    [load]
  );

  return (
    <div
      style={{
        maxWidth: layout.contentMaxWidth,
        margin: '0 auto',
        padding: `${space[11]}px ${space[8]}px ${space[15]}px`,
      }}
    >
      <h1
        style={{
          fontSize: fontSize['3xl'],
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
          margin: 0,
        }}
      >
        Spores
      </h1>
      <p style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: space[4] }}>
        What the Flow Key drained from your rituals. Each one carries who made it and can be grown
        again.
      </p>

      <div style={{ marginTop: space[10], display: 'flex', flexDirection: 'column', gap: space[6] }}>
        {loading && (
          <>
            <SkeletonBar />
            <SkeletonBar />
          </>
        )}

        {!loading && error && <ErrorComponent message={error} onRetry={() => void load()} />}

        {!loading && !error && spores.length === 0 && (
          <EmptyState
            iconKey="sparkles"
            title="No spores yet"
            body="Turn the Flow Key during a live ritual and the settled material drains here."
            actionLabel="Find a ritual"
            actionTo="/rituals"
          />
        )}

        {!loading &&
          !error &&
          spores.map(spore => (
            <SporeCard
              key={spore.id}
              spore={spore}
              onGerminate={germinate}
              onCountersign={hasInjectedWallet() ? countersign : undefined}
            />
          ))}
      </div>
    </div>
  );
}
