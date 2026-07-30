'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ritualRequest, type FlowKeyState } from '@/lib/rituals';
import { FlowKeyGlyph } from '@/components/FlowKeyGlyph';

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

  if (!state) return null;

  return (
    <FlowKeyGlyph
      capped={state.capped}
      skipped={state.skipped}
      isOpen={state.is_open}
      canTurn={isCreator}
      busy={busy}
      onTurn={() => void turn()}
    />
  );
}
