// Which comb cells are ready to drain.
//
// A Flow Frame only drains CAPPED honey — uncapped cells hold nectar that is
// still curing. Ported over: the take being played right now is never harvested.
// That refusal is mechanical, not a policy promise, and it is the reason this
// tap is not a surveillance device.

export interface CappableAsset {
  id: string;
  created_at: string;
  upload_complete: boolean;
  deleted_at: string | null;
}

export interface CappingContext {
  /** flow_key_taps.opened_at — the snapshot boundary. */
  boundary: string;
  currentAssetId: string | null;
  playbackStatus: 'paused' | 'playing';
  /** Assets the host explicitly capped via a flow_key_cap event. */
  manuallyCappedIds: string[];
}

export function isCapped<T extends CappableAsset>(asset: T, ctx: CappingContext): boolean {
  // Unconditional gates — a manual cap can never override any of these.
  if (!asset.upload_complete) return false;
  if (asset.deleted_at !== null) return false;
  if (new Date(asset.created_at).getTime() > new Date(ctx.boundary).getTime()) return false;

  const isLiveTake = asset.id === ctx.currentAssetId && ctx.playbackStatus === 'playing';
  if (!isLiveTake) return true;

  // The live take drains only when the host has deliberately capped it.
  return ctx.manuallyCappedIds.includes(asset.id);
}

export function selectCappedCells<T extends CappableAsset>(
  assets: T[],
  ctx: CappingContext
): { capped: T[]; skipped: T[] } {
  const capped: T[] = [];
  const skipped: T[] = [];
  for (const asset of assets) {
    (isCapped(asset, ctx) ? capped : skipped).push(asset);
  }
  return { capped, skipped };
}
