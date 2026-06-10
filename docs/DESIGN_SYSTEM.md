# MixHive Design System (P1)

Single source of truth for UI. Live reference: **`/styleguide`** (`src/views/Styleguide.tsx`).

## Tokens — `src/styles/tokens.ts` (only source of color/space/type)
`colors` (surfaces, borders, gold `accent`, `text.*` AA-tuned, semantic) · `space` (numeric scale 0–14) · `radius` · `fontSize` (UI) + `display` (cinematic/hero) · `fontWeight` · `shadow` · `gradient` · `blur` · `motion` · `z`.

**Rule:** no ad-hoc hex in components/views — consume tokens. (Lint rule to enforce: P1 follow-up.)

## Component roles — pick the right layer
- **`src/components/ui/*` — generic primitives (controls):** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `FileInput`, `Avatar`, `Modal`. Use these for all forms/controls.
  - `Button` variants: `primary | secondary | ghost | danger`; sizes `sm | md | lg`.
- **`src/components/hive/*` — brand surfaces:** `HiveButton`, `HiveCard`, `HiveBadge`, `HiveStat`, `HiveLogo`, `HoneycombGrid`, decorative. Use for branded/marketing/dashboard surfaces.
  - `HiveButton` variants: `primary | ghost | glass | danger`. `HiveCard` tones: `panel | glow | flat`. `HiveBadge` tiers: `queen | worker | scout | drone | verified`.

### Canonical choice when both exist
- **Primary CTA / branded contexts → `HiveButton`**; **forms & dense UI → `ui/Button`**. Don't mix within one surface.
- Cards: use `HiveCard` (there is no `ui/Card`).

## Migration (incremental — P1 follow-ups, not a big-bang)
1. ✅ Tokens consolidated + `/styleguide` reference shipped.
2. Replace one-off inline hex with tokens, view-by-view (start with high-traffic: Feed, Profile, Dashboard, auth).
3. Converge duplicate ad-hoc buttons/inputs onto the canonical components above.
4. Add an ESLint rule banning raw hex in `src/views|components`.
5. a11y + 320px mobile sweep per component.
