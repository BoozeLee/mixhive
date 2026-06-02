# 47 — Beehive Design System

**Phase 12 · Design System Spec**

> Extends: doc 41 (Phase 10 Beehive design extensions), doc 29 (state-of-the-art web design)
> References: `src/styles/tokens.ts`, `src/app/mixhive.css`, `src/components/HexCell.tsx`

---

## 1. Design Philosophy

The Beehive design system fuses two cultural references:

1. **Beehive / hexagon metaphor:** Modular, cellular, interconnected. Every creator is a node; every collaboration is an edge; every scene is a cluster. The hexagon is the most space-efficient tesselating shape — reflects MIXHIVE's vision of zero-wasted talent.

2. **DJ culture aesthetics:** Bold, performance-first, high-contrast. Think club poster typography (uppercase 900-weight headers), equipment-inspired monospace for technical data (BPM, Camelot), and neon accent colors against a near-black canvas.

**Restraint rule:** One accent color per semantic meaning. Never rainbow. Genre colors are informational, not decorative — only appear when genre context is present.

---

## 2. Hex CSS Primitives

### 2.1 Cell Sizes

Defined in `HexCell.tsx` (already implemented):
| Size | Width | Height | Clip-path |
|---|---|---|---|
| `sm` | 64px | 74px | `polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)` |
| `md` | 120px | 138px | same |
| `lg` | 180px | 208px | same |

Orientation: flat-top (top and bottom edges are horizontal).

### 2.2 Hex Grid CSS Classes

Added to `mixhive.css` for future `HoneycombBrowser` view:

```css
.hex-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px;
  padding: 24px 16px;
}

/* Proper honeycomb offset: odd rows pushed right by half-cell + gap */
.hex-grid-row:nth-child(even) {
  margin-left: calc(60px + 2px); /* half of 120px cell + gap/2 */
}
```

### 2.3 Linear Set Rail

The Hive Composer uses a flex-row "set rail" — not a grid. This is intentional: a DJ set is sequential, not spatial. Rail layout:
```css
.set-rail {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 24px 16px 40px;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}
```

---

## 3. DJ Culture Color Palette

### 3.1 Existing: Genre Colors

16 genres → `genreColors` in `src/styles/tokens.ts` (Phase 10, fully implemented).

### 3.2 New: Mood Colors

4 DJ performance mood tokens — added to `src/styles/tokens.ts` in Phase 12:

```typescript
export const moodColors: Record<string, string> = {
  peak:       'hsl(82,80%,48%)',   // acid green — high energy, peak time
  groove:     'hsl(38,95%,52%)',   // gold — warm, building momentum
  ambient:    'hsl(210,70%,55%)',  // cool blue — atmospheric, low energy
  transition: 'hsl(270,70%,55%)', // purple — key change, genre bridge
};

export function getMoodColor(mood?: string | null): string {
  if (!mood) return moodColors.groove;
  return moodColors[mood.toLowerCase()] ?? moodColors.groove;
}
```

### 3.3 Application Rules

- `peak`: Use for "high similarity" indicators (≥80%), selected tracks in focus
- `groove`: Default accent — MixHive gold; filter chips, CTAs, notifications
- `ambient`: Informational states, agent panel header, story timeline
- `transition`: BPM mismatch warnings, key-change indicators, gap cells

---

## 4. Typography

### 4.1 Section Headers

```css
.section-header {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, #888);
}
```

Rationale: club-flyer aesthetic. Every section label reads like a poster category. **No title-case headers in the beehive system** — always uppercase or sentence-case, never mixed.

### 4.2 Technical Data

BPM, Camelot keys, timestamps, similarity percentages — always monospace:
```css
.mono {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  letter-spacing: -0.02em;
}
```

This is currently achieved via inline `fontFamily` in `BpmChip.tsx` and `KeyChip.tsx` — Phase 12 formalizes it with the `.mono` class.

### 4.3 Artist Names and Track Titles

```css
.track-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.artist-name {
  font-size: 11px;
  color: var(--text-muted, #888);
}
```

---

## 5. Motion Vocabulary

### 5.1 Existing Keyframes (Phase 10, in `mixhive.css`)

| Name | Purpose | Duration |
|---|---|---|
| `shimmer` | Skeleton loading | 1.5s infinite |
| `toastIn` / `toastOut` | Toast notifications | 280ms / 200ms |
| `panelSlide` | Right panel entrance | 200ms |
| `pageIn` | Route transition | 150ms |
| `eq-bar` | Equalizer bars when playing | 0.8s infinite |

### 5.2 New Phase 12 Keyframes

Added to `mixhive.css`:

```css
@keyframes suggestionIn {
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.suggestion-enter {
  animation: suggestionIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
```

The spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) gives a slight "pop" — appropriate for an AI suggestion appearing. Respects `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .suggestion-enter { animation-duration: 0.01ms; }
}
```

### 5.3 Filter Chip Transition

```css
.filter-chip {
  transition: background 120ms ease, border-color 120ms ease;
}
.filter-chip:hover {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}
```

---

## 6. Responsive Honeycomb

| Breakpoint | Layout | Cell size | Notes |
|---|---|---|---|
| ≥1024px | 5-column hex grid or flex rail | `md` (120px) | Full hex shape |
| 768–1023px | 3-column hex grid or flex rail | `md` (120px) | Full hex shape |
| ≤767px | Single-column vertical stack | `sm` (64px) or linear | Hex accent stripe as left bar only |

**Mobile fallback rule:** At ≤767px, the hex `clip-path` is removed; the cell becomes a standard rectangle (8px radius) with the genre accent stripe as a 3px left border. This maintains the visual language without requiring horizontal scroll.

---

## 7. Component Inventory

| Component | Status | Location |
|---|---|---|
| `HexCell` | ✅ Implemented | `src/components/HexCell.tsx` |
| `BpmChip` | ✅ Implemented | `src/components/BpmChip.tsx` |
| `WaveformAccent` | ✅ Implemented | `src/components/WaveformAccent.tsx` |
| `KeyChip` | ✅ Implemented | `src/components/KeyChip.tsx` |
| `HiveButton` | ✅ Implemented | `src/components/hive/HiveButton.tsx` |
| `HiveCard` | ✅ Implemented | `src/components/hive/HiveCard.tsx` |
| `HiveBadge` | ✅ Implemented | `src/components/hive/HiveBadge.tsx` |
| `HiveStat` | ✅ Implemented | `src/components/hive/HiveStat.tsx` |
| `HiveLogo` | ✅ Implemented | `src/components/hive/HiveLogo.tsx` |
| `moodColors` + `getMoodColor()` | ✅ Phase 12 | `src/styles/tokens.ts` |
| `.suggestion-enter` keyframe | ✅ Phase 12 | `src/app/mixhive.css` |
| `.filter-chip` class | ✅ Phase 12 | `src/app/mixhive.css` |
| `.hex-grid` / `.set-rail` | 📋 Spec only | Future pass |

---

## 8. Codex Handoff

None — this doc is a design system reference.

## 9. Claude Code Handoff

- `tokens.ts`: `moodColors` + `getMoodColor()` (Phase 12 Step 2)
- `mixhive.css`: `suggestionIn` keyframe + `.suggestion-enter` + `.filter-chip` (Phase 12 Step 2)
- `.hex-grid` / `.set-rail` CSS classes: future pass
