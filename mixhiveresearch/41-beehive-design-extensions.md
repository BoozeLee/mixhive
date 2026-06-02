# 41 — Beehive Design Extensions

**Phase 10 · Design System Extension**

> Extends: doc 29 (design philosophy, layout system, 5 hero flows, motion vocabulary)
> This doc does NOT repeat: design philosophy, 3-column layout spec, 5 hero flows, general motion
> principles. Read doc 29 first. This doc covers only what doc 29 deferred and what Phase 10 adds.

---

## 1. `HexCell.tsx` — Interactive Hex Component Spec

The existing `HoneycombGrid.tsx` is a **decorative backdrop** (non-interactive, purely visual).
`HexCell` is a new, fully interactive component for the Hive Composer and any future hex-grid UI.

### 1.1 Shape

```css
clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
```

This is a **flat-top hexagon** (wider than tall). The aspect ratio is 1:1.155 (hex math).

### 1.2 Sizes

| Variant | Width | Height | Use |
|---|---|---|---|
| `sm` | 64px | 74px | Timeline events (Hive Story) |
| `md` | 120px | 138px | Composer canvas (default) |
| `lg` | 180px | 208px | Story chapters (Hive Story) |

### 1.3 Visual States

| State | Background | Border | Additional |
|---|---|---|---|
| `default` | `colors.surface` (#111) | 1px `colors.border` | — |
| `hover` | `colors.surfaceHover` | 1px `colors.accent` | translateY(-2px), 120ms |
| `selected` | `colors.accentFaint` | 2px `colors.accent` | — |
| `suggestion` | transparent | 2px `colors.accent` dashed | Gold dashed |
| `gap` | transparent | 2px `colors.border` dashed | Grey dashed |
| `add` | transparent | 1px `colors.borderStrong` | Centered `+` icon (24px) |
| `disabled` | `colors.surface` | 1px `colors.border` | `opacity: 0.3`, no hover |
| `playing` | `colors.surface` | 2px `colors.accent` | `WaveformAccent` animates |

### 1.4 Inner Layout

Content is clipped to the hex shape. Use inner padding to avoid edge clipping:
`padding: 12px 16px` creates a safe rectangular content area within the hex.

```
┌──────────────────────────┐
│  [WaveformAccent]         │  ← only when playing
│  Title (14px semibold)   │
│  Artist (12px dim)       │
│                          │
│  [BpmChip]  [Duration]   │  ← bottom row
└──────────────────────────┘
```

Left edge: a 3px vertical strip using `getGenreColor(genre)` — rendered as a
`::before` pseudo-element (works inside clip-path if applied to inner div, not outer).

### 1.5 Component Interface

```typescript
interface HexCellProps {
  variant: 'track' | 'suggestion' | 'gap' | 'add' | 'chapter';
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  artist?: string;
  genre?: string;
  bpm?: number;
  duration?: string;
  similarity?: number;       // 0–1, shown as badge on suggestion cells
  keyCamelot?: string;       // e.g. "8A"
  playing?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onDismiss?: () => void;    // only on suggestion cells
  // for chapter cells (HiveStory)
  icon?: string;             // emoji or small SVG icon
  date?: string;
  label?: string;
}
```

`HexCell` is always a `<button>` element (unless `disabled`, in which case `<div>` with
`aria-disabled="true"`). Never a `<div>` that handles clicks.

---

## 2. Runtime Genre-Color Mapping (Doc 29 §2 Deferred Handoff)

Doc 29 specified that genre-coded accents should use runtime HSL-shifted hues but deferred the
implementation. Phase 10 completes this.

### 2.1 `getGenreColor(genre: string): string`

Add to `src/styles/tokens.ts`:

```typescript
export const genreColors: Record<string, string> = {
  // Electronic underground
  'techno':        'hsl(210, 90%, 55%)',
  'industrial':    'hsl(0, 0%, 65%)',
  'hardcore':      'hsl(0, 85%, 55%)',
  'trance':        'hsl(300, 70%, 55%)',
  'ambient':       'hsl(195, 60%, 50%)',
  // Bass
  'drum and bass': 'hsl(82, 80%, 48%)',
  'dnb':           'hsl(82, 80%, 48%)',
  'jungle':        'hsl(95, 75%, 45%)',
  'garage':        'hsl(170, 75%, 48%)',
  'grime':         'hsl(150, 70%, 45%)',
  // Dance
  'house':         'hsl(38, 80%, 52%)',
  'afro house':    'hsl(15, 85%, 55%)',
  'breaks':        'hsl(55, 80%, 50%)',
  'electro':       'hsl(230, 80%, 60%)',
  // Trap / Urban
  'trap':          'hsl(270, 70%, 55%)',
  'hip hop':       'hsl(260, 60%, 55%)',
  // Experimental
  'experimental':  'hsl(175, 55%, 48%)',
  'noise':         'hsl(0, 10%, 60%)',
  // Default (MythicNode gold)
  'default':       'hsl(38, 95%, 52%)',
};

export function getGenreColor(genre?: string | null): string {
  if (!genre) return genreColors.default;
  const key = genre.toLowerCase().trim();
  return genreColors[key] ?? genreColors.default;
}
```

### 2.2 Usage sites

| Component | How it's used |
|---|---|
| `HexCell` | 3px left-edge accent strip |
| `MixCard` | Genre tag pill background (10% opacity) + border |
| `HiveBadge` variant `genre` | Background tint + full-opacity text |
| `HiveStory` `SoundEvolutionBanner` | Gradient from early-genre-color → current-genre-color |
| Profile genre chips | Background tint |

### 2.3 Contrast guarantee

Genre colors are specified at 48–60% lightness on the dark `#0a0a0a` background. All pass
WCAG AA (4.5:1) for the text-on-tint use case when text is white `#eee`. For the accent strip
use case (decorative only), no contrast requirement applies.

---

## 3. Motion Token Completions (Doc 29 §3 Deferred Handoff)

Doc 29 §3 specified 5 micro-interactions but deferred keyframe CSS to Claude Code. Phase 10
defines the exact keyframes for the 4 that need them.

Add to `src/app/mixhive.css` under a `/* ── Motion ────────────────────────────────────── */`
section:

### 3.1 Skeleton shimmer

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface) 25%,
    var(--color-surface-hover) 50%,
    var(--color-surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; background: var(--color-surface); }
}
```

### 3.2 Toast slide-in

```css
@keyframes toastIn {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes toastOut {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(120%); opacity: 0; }
}

.toast-enter { animation: toastIn  200ms ease-out forwards; }
.toast-exit  { animation: toastOut 150ms ease-in  forwards; }

@media (prefers-reduced-motion: reduce) {
  .toast-enter { animation: none; }
  .toast-exit  { animation: none; }
}
```

### 3.3 Right panel slide

```css
@keyframes panelSlide {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.panel-enter { animation: panelSlide 150ms ease-out forwards; }

@media (prefers-reduced-motion: reduce) {
  .panel-enter { animation: none; }
}
```

### 3.4 Page transition

```css
@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.page-enter { animation: pageIn 150ms ease-out forwards; }

@media (prefers-reduced-motion: reduce) {
  .page-enter { animation: none; }
}
```

### 3.5 Application points

- `.skeleton`: applied by a shared `<Skeleton>` component (or directly as `className` on
  placeholder elements in loading states)
- `.toast-enter` / `.toast-exit`: applied by the `react-hot-toast` library via `toastOptions`
  config in `MixHiveClient.tsx` (or equivalent toast container)
- `.panel-enter`: applied by the right panel container in the 3-column layout when it slides in
- `.page-enter`: applied to the main content area on route change via React Router's
  location key (wrap `<Outlet>` or route-level `<div key={location.pathname}>`)

---

## 4. Three DJ-Culture Micro-Components

### 4.1 `BpmChip.tsx`

A small pill badge showing BPM with range-coded color.

```typescript
interface BpmChipProps {
  bpm: number;
  size?: 'sm' | 'md';
}
```

Color logic:
- `bpm ≤ 100`: `colors.info` (#3b82f6) — chill, ambient range
- `100 < bpm ≤ 130`: `colors.accent` (#f0c040) — house/techno sweet spot
- `bpm > 130`: `genreColors['drum and bass']` (#6c6 equivalent at hsl(82,80%,48%)) — high-energy

Display: `"{bpm} BPM"` at `fontSize.xs`, monospace or tabular-nums, `borderRadius: radius.pill`,
`padding: 2px 8px`, background at 15% opacity of the color, border at 40% opacity.

### 4.2 `WaveformAccent.tsx`

A 12-bar mini equalizer used as a visual indicator inside mix cards and `HexCell`.

```typescript
interface WaveformAccentProps {
  playing?: boolean;
  bars?: number;    // default 12
  color?: string;   // default colors.accent
  height?: number;  // default 16px
}
```

Rendering:
- 12 SVG `<rect>` bars at fixed x positions, each with a random initial height (seeded from mix_id)
- When `playing=true`: CSS animation on each bar staggered by index: `@keyframes eq-bar` pulses
  height between 30% and 100% at 800ms ease-in-out, 50ms stagger per bar
- When `playing=false`: bars at static heights, no animation

```css
@keyframes eq-bar {
  0%, 100% { transform: scaleY(0.3); }
  50%       { transform: scaleY(1.0); }
}

@media (prefers-reduced-motion: reduce) {
  .eq-bar { animation: none !important; }
}
```

Used in: `HexCell` (inside track cell when that mix is playing in the global player),
`MixCard` thumbnail overlay, `BuzzComposer` mix attachment preview.

### 4.3 `KeyChip.tsx`

A small badge for Camelot Wheel musical key notation.

```typescript
interface KeyChipProps {
  keyCamelot: string;  // e.g. "8A", "3B", "12A"
  compatible?: boolean; // if provided, shows green/amber tint
}
```

Display: `"{keyCamelot}"` in monospace, `fontSize.xs`, neutral background (`colors.surfaceHover`),
`borderRadius: radius.sm`.

If `compatible` prop is provided:
- `compatible=true`: green tint border (`colors.success`)
- `compatible=false`: amber tint border (`colors.warning`)

---

## 5. Honeycomb CSS Layout Pattern (For ComposerCanvas)

The hex grid layout for the Hive Composer uses CSS only — no WebGL, no canvas, no third-party
grid library.

### 5.1 Base pattern

```css
.hex-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: calc(5 * 120px + 4 * 8px); /* 5 columns at 120px with 8px gap */
}

.hex-grid-row {
  display: flex;
  gap: 8px;
}

.hex-grid-row:nth-child(even) {
  margin-left: calc((120px + 8px) / 2); /* offset even rows by half a cell + gap */
}
```

This creates the staggered honeycomb offset. Each cell is positioned in a row; even rows shift
right by half a cell width to create the hex-packing pattern.

### 5.2 Responsive breakpoints

| Viewport | Columns | Cell size | Row offset |
|---|---|---|---|
| ≥1024px | 5 | 120×138px | `calc(64px)` |
| 768–1023px | 3 | 120×138px | `calc(64px)` |
| ≤767px | Linear (no hex) | Full-width row | N/A |

Mobile: `clip-path` is removed on `HexCell` at ≤767px. The component renders as a full-width
horizontal card with a 4px left border using `getGenreColor(genre)` as the sole hex reference.

### 5.3 Overflow handling

The canvas container uses `overflow-x: auto` on tablet and `overflow-y: auto` on desktop.
Cells never overflow the viewport — the canvas is always within the central column (max 900px
from doc 29 §2).

---

## 6. Component Inventory

### 6.1 Existing hive components (do not re-implement)

Located in `src/components/hive/`:

- `HoneycombGrid.tsx` — decorative backdrop, density-controlled, non-interactive
- `HiveButton.tsx` — standard action button with hive brand style
- `HiveCard.tsx` — card surface with optional gold accent
- `HiveStat.tsx` — metric display (label + value)
- `HiveLogo.tsx` — wordmark + hex icon
- `HiveBadge.tsx` — status/category badge pill

### 6.2 Phase 10 additions

| Component | Location | Description |
|---|---|---|
| `HexCell.tsx` | `src/components/HexCell.tsx` | Interactive hex, all variants |
| `BpmChip.tsx` | `src/components/BpmChip.tsx` | BPM pill with range color |
| `WaveformAccent.tsx` | `src/components/WaveformAccent.tsx` | Animated EQ bars |
| `KeyChip.tsx` | `src/components/KeyChip.tsx` | Camelot key badge |
| `ComposerCanvas.tsx` | `src/components/composer/ComposerCanvas.tsx` | Hex grid layout |
| `ComposerAgentPanel.tsx` | `src/components/composer/ComposerAgentPanel.tsx` | Right agent panel |
| `HiveComposer.tsx` | `src/views/HiveComposer.tsx` | Route view `/composer` |
| `HiveStory.tsx` | `src/views/HiveStory.tsx` | Story tab in profile |
| `StoryChapterCell.tsx` | `src/components/story/StoryChapterCell.tsx` | Story milestone cell |
| `SoundEvolutionBanner.tsx` | `src/components/story/SoundEvolutionBanner.tsx` | Evolution waveform |

### 6.3 Token updates

| File | Change |
|---|---|
| `src/styles/tokens.ts` | Add `genreColors` record + `getGenreColor()` function |
| `src/app/mixhive.css` | Add `/* Motion */` section with 4 keyframe blocks + utility classes |

---

## Codex Handoff

None — this is a pure frontend spec.

## Claude Code Handoff

**New files:**
- `src/components/HexCell.tsx` — interactive hex cell (§1)
- `src/components/BpmChip.tsx` — BPM pill (§4.1)
- `src/components/WaveformAccent.tsx` — EQ animation (§4.2)
- `src/components/KeyChip.tsx` — key notation (§4.3)

**Updated files:**
- `src/styles/tokens.ts` — `genreColors` + `getGenreColor()` (§2)
- `src/app/mixhive.css` — motion keyframes + utility classes (§3)

**Views (from doc 40):**
- `src/views/HiveComposer.tsx`
- `src/components/composer/ComposerCanvas.tsx`
- `src/components/composer/ComposerAgentPanel.tsx`

**Views (from doc 42):**
- `src/views/HiveStory.tsx`
- `src/components/story/StoryChapterCell.tsx`
- `src/components/story/SoundEvolutionBanner.tsx`
