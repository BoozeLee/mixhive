// Hypercube model spec — the mathematically-defined test space for MixHive.
//
// We model verification as an n-dimensional hypercube. Each dimension is an
// independent factor; a test "cell" is one coordinate. The full Cartesian
// product is ~10^5 cells (infeasible), so we partition Targets into RELEVANCE
// CLASSES, vary only each class's relevant dimensions, and forbid meaningless
// tuples via `forbidden()`. The generator emits a t=2 covering array per class;
// an independent verifier (coverage.mjs) proves pairwise coverage ρ=1.0.
//
// This file is the SINGLE SOURCE OF TRUTH. It is plain .mjs (no build step) so
// the node generator/verifier/executors and the Playwright .ts spec all import
// the same object.

/** Global dimensions and their levels. `target` is an additional per-class dim. */
export const DIMENSIONS = {
  auth: ['anon', 'new-incomplete', 'completed', 'admin'],
  data: ['empty', 'populated', 'error'],
  viewport: ['320', '390', '768', '1440'],
  locale: ['en', 'fr', 'nl', 'de', 'es'],
  motion: ['reduced', 'full'],
  gate: ['keys-absent', 'test-keys'],
};

// ---- Target builders -------------------------------------------------------

/**
 * @typedef {Object} Target
 * @property {string} id            unique id, e.g. "route:/ai-band"
 * @property {'ui'|'api'|'agent'} kind
 * @property {string} class         relevance class name
 * @property {string} path          URL path or endpoint (may contain :params)
 * @property {'GET'|'POST'} [method]
 * @property {Record<string,string>} [params]  concrete values for :params
 * @property {string} [oracle]      named oracle set
 * @property {'stripe'|'openai'|null} [gate]
 * @property {boolean} [dataFetching] false => only data=empty is meaningful
 * @property {boolean} [onboardingSensitive] true => auth=new-incomplete relevant
 * @property {string} [note]
 */

const ui = (path, extra = {}) => ({
  id: `route:${path}`,
  kind: 'ui',
  path,
  oracle: 'ui-render',
  dataFetching: true,
  ...extra,
});
const api = (path, extra = {}) => ({
  id: `api:${extra.method || 'GET'} ${path}`,
  kind: 'api',
  path,
  method: 'GET',
  oracle: 'api-status',
  ...extra,
});

// ---- Public UI routes (no auth) -------------------------------------------
const PUBLIC_UI = [
  ui('/'),
  ui('/login', { dataFetching: false }),
  ui('/register', { dataFetching: false }),
  ui('/dev-login', { dataFetching: false }),
  ui('/auth/forgot-password', { dataFetching: false }),
  ui('/auth/reset-password', { dataFetching: false }),
  ui('/feed', { onboardingSensitive: true }),
  ui('/trending'),
  ui('/discover'),
  ui('/search'),
  ui('/scenes'),
  ui('/scene/:slug', { params: { slug: 'test-scene' } }),
  ui('/u/:username', { params: { username: 'test-user' } }),
  ui('/mix/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/embed/mix/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/playlist/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/buzz/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/pricing', { dataFetching: false }),
  ui('/notifications'),
  ui('/agents/gallery'),
  ui('/marketplace/agents'),
  ui('/ai-band'), // FLAGSHIP DEFECT: listAIAgents queries non-existent columns
  ui('/ai-band/:slug', { params: { slug: 'acid-oracle' } }),
  ui('/ai-band/agent/:slug', { params: { slug: 'acid-oracle' } }),
  ui('/collab-quests'),
  ui('/collab-quests/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/epk/:slug', { params: { slug: 'test-user' } }),
  ui('/rituals'),
  ui('/marketplace/gear'),
  ui('/marketplace/gear/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/hive-story'),
  ui('/hive-story/:slug', { params: { slug: 'test' }, dataFetching: false }),
  ui('/hub', { dataFetching: false }),
  ui('/help', { dataFetching: false }),
  ui('/help/:slug', { params: { slug: 'getting-started' }, dataFetching: false }),
  ui('/leaderboard'),
  ui('/privacy', { dataFetching: false }),
  ui('/terms', { dataFetching: false }),
  ui('/cookies', { dataFetching: false }),
  ui('/styleguide', { dataFetching: false }),
  ui('/nonexistent-route-404', { dataFetching: false, oracle: 'ui-notfound' }),
].map(t => ({ ...t, class: 'public-ui' }));

// ---- Authed UI routes (ProtectedRoute) ------------------------------------
const AUTHED_UI = [
  ui('/setup', { onboardingSensitive: true }),
  ui('/dashboard', { onboardingSensitive: true }),
  ui('/settings'),
  ui('/upload', { onboardingSensitive: true }),
  ui('/mix/:id/edit', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/agents'),
  ui('/agents/inbox'),
  ui('/scene-radar'),
  ui('/opportunities'),
  ui('/quests'),
  ui('/quests/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/collab-quests/new'),
  ui('/studio/avatar'),
  ui('/epk'),
  ui('/composer'),
  ui('/marketplace/gear/new'),
  ui('/earnings'),
  ui('/messages'),
  ui('/messages/:conversationId', { params: { conversationId: '00000000-0000-0000-0000-000000000000' } }),
  ui('/session/:id', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
  ui('/session/:id/replay', { params: { id: '00000000-0000-0000-0000-000000000000' } }),
].map(t => ({ ...t, class: 'authed-ui' }));

// ---- Admin UI routes ------------------------------------------------------
const ADMIN_UI = [
  ui('/admin/verification'),
  ui('/admin/moderation'),
].map(t => ({ ...t, class: 'admin-ui' }));

// ---- API endpoints --------------------------------------------------------
const PUBLIC_API = [
  api('/api/health'),
  api('/api/health/database'),
  api('/api/health/storage'),
  api('/api/health/worker'),
  api('/api/feed?type=trending'),
  api('/api/feed?type=latest'),
  api('/api/search?q=techno'),
  api('/api/scenes'),
  api('/api/opportunities'),
  api('/api/hive-story'),
  api('/api/upload/validate', { method: 'POST', oracle: 'api-status' }),
].map(t => ({ ...t, class: 'public-api' }));

const AUTHED_API = [
  api('/api/notifications', { note: 'must-401-anon' }),
  api('/api/mixes', { method: 'POST', note: 'must-401-anon' }),
  api('/api/buzzes', { method: 'POST', note: 'must-401-anon' }),
  api('/api/cache/invalidate', { method: 'POST', note: 'must-401-anon' }),
  api('/api/admin/agents', { note: 'must-401-anon' }),
].map(t => ({ ...t, class: 'authed-api' }));

const GATED_API = [
  api('/api/subscription/create', { method: 'POST', gate: 'stripe' }),
  api('/api/marketplace/gear/00000000-0000-0000-0000-000000000000/buy', { method: 'POST', gate: 'stripe' }),
  api('/api/ai/generate-image', { method: 'POST', gate: 'openai' }),
  api('/api/composer/suggest', { method: 'POST', gate: 'openai' }),
].map(t => ({ ...t, class: 'gated-api' }));

// ---- Agent systems (one probe-class each; fixed oracle, no UI dims) --------
const agent = (id, cls, extra = {}) => ({
  id: `agent:${id}`,
  kind: 'agent',
  class: cls,
  path: extra.path || '',
  oracle: `agent-${id}`,
  ...extra,
});
const AGENTS = [
  agent('lua', 'agent-lua', { path: '/api/lua-agent/run', method: 'GET' }),
  agent('wasmoon', 'agent-wasmoon', { path: '/api/agents/wasmoon-test', method: 'GET' }),
  agent('strategic', 'agent-strategic', { path: '/api/cron/strategic-agents', method: 'POST' }),
  agent('notif-prioritizer', 'agent-notif', { path: '/api/cron/notification-prioritizer', method: 'POST' }),
  agent('session-spirit', 'agent-session-spirit', { path: '/api/mythic/sessions/:id/agent', method: 'POST' }),
  agent('audio-worker', 'agent-audio', { path: 'worker/audio --selftest' }),
  agent('ai-band-bridge', 'agent-aiband', { path: 'scripts/provenance_publish_demo.mjs' }),
];

export const TARGETS = [
  ...PUBLIC_UI, ...AUTHED_UI, ...ADMIN_UI,
  ...PUBLIC_API, ...AUTHED_API, ...GATED_API, ...AGENTS,
];

// ---- Relevance classes: which dims vary, with per-class level subsets ------
// A dim entry is either a string (use DIMENSIONS[name]) or {name, levels}.
export const CLASSES = [
  { name: 'public-ui', relevantDims: ['data', 'viewport', 'locale', 'motion'], pinned: { auth: 'anon' } },
  { name: 'authed-ui', relevantDims: [{ name: 'auth', levels: ['anon', 'new-incomplete', 'completed'] }, 'data', 'viewport', 'locale', 'motion'] },
  { name: 'admin-ui', relevantDims: [{ name: 'auth', levels: ['completed', 'admin'] }, 'viewport', 'locale'], pinned: { data: 'populated' } },
  { name: 'public-api', relevantDims: ['data'], pinned: { auth: 'anon' } },
  { name: 'authed-api', relevantDims: [{ name: 'auth', levels: ['anon', 'completed'] }, 'data'] },
  { name: 'gated-api', relevantDims: [{ name: 'auth', levels: ['completed'] }, 'gate', 'data'] },
  // agent classes: single target, no varied dims (1-row arrays)
  { name: 'agent-lua', relevantDims: [] },
  { name: 'agent-wasmoon', relevantDims: [] },
  { name: 'agent-strategic', relevantDims: [{ name: 'auth', levels: ['anon', 'completed'] }] }, // ±Bearer
  { name: 'agent-notif', relevantDims: [{ name: 'auth', levels: ['anon', 'completed'] }] },
  { name: 'agent-session-spirit', relevantDims: [] },
  { name: 'agent-audio', relevantDims: [] },
  { name: 'agent-aiband', relevantDims: [] },
];

/**
 * Constraint predicate: is this (partial) row forbidden for this target?
 * Both the generator and the independent verifier call THIS SAME function, but
 * the verifier still recomputes the coverable-pair denominator from scratch, so
 * a generator bug cannot inflate ρ. Keeps constraints declarative + auditable.
 * @param {Record<string,string>} row  assignment over the class's dims
 * @param {Target} t
 */
export function forbidden(row, t) {
  // Non-data-fetching routes: only data=empty is meaningful.
  if (t.dataFetching === false && row.data != null && row.data !== 'empty') return true;
  // auth=new-incomplete only exercises onboarding-sensitive routes.
  if (row.auth === 'new-incomplete' && !t.onboardingSensitive) return true;
  // auth=admin only for admin classes.
  if (row.auth === 'admin' && t.class !== 'admin-ui' && t.class !== 'admin-api') return true;
  // gate=test-keys only for gated targets.
  if (row.gate === 'test-keys' && !t.gate) return true;
  return false;
}

/** Resolve a class's varied dims to [{name, levels}], including the target dim. */
export function classDims(cls) {
  const dims = [{ name: 'target', levels: TARGETS.filter(t => t.class === cls.name).map(t => t.id) }];
  for (const d of cls.relevantDims) {
    if (typeof d === 'string') dims.push({ name: d, levels: DIMENSIONS[d] });
    else dims.push({ name: d.name, levels: d.levels });
  }
  return dims;
}

export const MODEL = { DIMENSIONS, TARGETS, CLASSES, t: 2 };
export default MODEL;
