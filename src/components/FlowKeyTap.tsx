'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ritualRequest, type FlowKeyState } from '@/lib/rituals';
import { FlowKeyGlyph } from '@/components/FlowKeyGlyph';
import { colors, fontSize, radius, space } from '@/styles/tokens';

export function FlowKeyTap({ sessionId, isCreator }: { sessionId: string; isCreator: boolean }) {
  const [state, setState] = useState<FlowKeyState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await ritualRequest<FlowKeyState>(`/api/mythic/sessions/${sessionId}/flow-key`));
    } catch {
      // The tap is ambient. A failed poll must never interrupt the ritual.
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const turn = useCallback(async () => {
    setBusy(true);
    try {
      const turned = await ritualRequest<{ spore_id: string }>(
        `/api/mythic/sessions/${sessionId}/flow-key`,
        { method: 'POST' }
      );
      // Snapshot-on-turn: seal immediately. The drain is not a live stream, and
      // the session never pauses for either step.
      await ritualRequest(`/api/mythic/sessions/${sessionId}/flow-key/seal`, {
        method: 'POST',
        body: JSON.stringify({ spore_id: turned.spore_id }),
      });
      toast.success('Comb drained — spore sealed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The key would not turn');
    } finally {
      setBusy(false);
      void load();
    }
  }, [sessionId, load]);

  const capLiveTake = useCallback(async () => {
    if (!state?.live_take) return;
    setBusy(true);
    try {
      await ritualRequest(`/api/mythic/sessions/${sessionId}/flow-key/cap`, {
        method: 'POST',
        body: JSON.stringify({ asset_id: state.live_take.id, capped: true }),
      });
      toast.success(`Capped “${state.live_take.name}”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cap that cell');
    } finally {
      setBusy(false);
      void load();
    }
  }, [sessionId, state, load]);

  if (!state) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space[2] }}>
      <FlowKeyGlyph
        capped={state.capped}
        skipped={state.skipped}
        isOpen={state.is_open}
        canTurn={isCreator}
        busy={busy}
        onTurn={() => void turn()}
      />
      {/* The one deliberate exception to "uncapped is never harvested": the host
          can cap the take they have just finished. Host-only, and hidden once
          the drain is open so the boundary cannot shift mid-harvest. */}
      {isCreator && state.live_take && !state.is_open && (
        <button
          type="button"
          onClick={() => void capLiveTake()}
          disabled={busy}
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            background: 'transparent',
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.sm,
            padding: `${space[1]}px ${space[4]}px`,
            cursor: busy ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          cap this take
        </button>
      )}
    </span>
  );
}
