# MixHive Design System

Single source of truth for UI. Live reference: **`/styleguide`** (`src/views/Styleguide.tsx`).

## Tokens — `src/styles/tokens.ts` (only source of color/space/type)
`colors` (surfaces, borders, gold `accent`, `text.*` AA-tuned, semantic) · `space` (numeric scale 0–17) · `radius` (none–`3xl`/pill) · `fontSize` (UI) + `display` (cinematic/hero) · `fontWeight` · `shadow` · `gradient` · `blur` · `motion` · `z` · `layout`.

**Rule:** no ad-hoc hex in components/views — consume tokens. (Lint rule to enforce: P1 follow-up.)

## Current token gaps (being closed slice-by-slice)
- `radius.2xl` (12px) and `radius.3xl` (18px) added for card/panel usage that exceeds old `xl` (10px)
- `transition.smooth` / `transition.smoothSlow` added — use `cubic-bezier(0.22, 1, 0.36, 1)` for motion polish
- `space` scale extended through 17 (128px) for large-section padding
- `layout.navbarHeight`, `layout.sidebarWidth`, `layout.feedMaxWidth`, etc. — always read these instead of hardcoding
- `fontSize` still has gaps at 15, 17, 19 — add per-slice need

## Brand vocabulary (dark + gold + hive/cyberpunk)
```
Surfaces:   #0a0a0a (bg) → #111 (surface) → #1a1a2e (hover) → #030303 (hive-black)
Accent:     #f0c040 (gold) → #f6c400 (bright) → #ffd84a (hot) → #c79100 (deep)
Secondary:  #25d9ff (cyan) — mesh backdrops, cool accent
Text:       #eee (primary) → #ccc → #999 → #888 → #808080 (all AA on #111)
Danger:     #f55 / #ef4444
Success:    #6c6 / #22c55e / #7eed8b
Glass:      var(--hive-panel) = rgba(7,7,5,0.78) with blur(16px) + gold line border
```

## Glass panel (hive-panel) recipe
Applied via CSS class `.hive-panel` in `mixhive.css`. Properties:
```
background: linear-gradient(135deg, rgba(255,216,74,0.08), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,0.035), transparent),
            var(--hive-panel);
border: 1px solid var(--hive-line, rgba(246,196,0,0.28));
box-shadow: 0 0 0 1px rgba(255,216,74,0.04) inset,
            0 18px 60px rgba(0,0,0,0.5),
            0 0 32px rgba(246,196,0,0.08);
backdrop-filter: blur(16px) saturate(1.24);
```
Use `className="hive-panel"` for glass surfaces. For inline style, reference tokens `shadow.elevated` + `colors.border` manually.

## Component roles — pick the right layer
- **`src/components/ui/*` — generic primitives (controls):** `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `FileInput`, `Avatar`, `Modal`. Use for all forms/controls.
  - `Button` variants: `primary | secondary | ghost | danger | success`; sizes `sm | md | lg`.
- **`src/components/hive/*` — brand surfaces:** `HiveButton`, `HiveCard`, `HiveBadge`, `HiveStat`, `HiveLogo`, `HoneycombGrid`, decorative. Use for branded/marketing/dashboard surfaces.
  - `HiveButton` variants: `primary | ghost | glass | danger`. `HiveCard` tones: `panel | glow | flat`. `HiveBadge` tiers: `queen | worker | scout | drone | verified`.

### Canonical choice when both exist
- **Primary CTA / branded contexts → `HiveButton`**; **forms & dense UI → `ui/Button`**. Don't mix within one surface.
- Cards: use `HiveCard` (there is no `ui/Card`). For feed items, `MixCard` and `BuzzCard` are purpose-built.

## Typography
```
Display:   Impact / 'Arial Black' — all-caps, dramatic (hero headlines)
UI:        'Segoe UI' / Inter / system-ui — body text, labels, controls
Mono:      'SFMono-Regular' / Consolas — technical labels, timestamps, code
```
- Display scale (clamp-based): `sm: clamp(24px,3vw,32px)` through `2xl: clamp(48px,10vw,112px)`
- UI scale (fixed): `xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 18, 2xl: 20, 3xl: 24, 4xl: 28`
- Font weights: `normal: 400, medium: 500, semibold: 600, bold: 700`

## Responsive patterns (320px mobile, Phase 2)
- **Content width at 320px:** 288px after `padding: 0 16px`. All flex rows with multiple items MUST include `flexWrap: 'wrap'`.
- **Text overflow protection:** Any text element in a flex row that can be long MUST have `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'`, and `minWidth: 0` on its parent.
- **Message bubbles:** Use `maxWidth: '78%'` and `wordBreak: 'break-word'` to prevent unbroken strings (URLs) from overflowing.
- **Badges with dynamic content:** Use `maxWidth: '100%'` + `overflow: 'hidden'` on the container, and `textOverflow: 'ellipsis'` on the text child (`AttachBadge` pattern).
- **Horizontal scroll lanes:** Use `overflowX: 'auto'` with `scrollSnapType: 'x mandatory'` and `flexShrink: 0` on children. Acceptable for sparse horizontal sections (discover lanes, profile mixes) but avoid for primary content.
- **Steppers:** Use `overflowX: 'auto'` with pills when steps exceed viewport width; consider collapsed dots + current label on mobile as UX improvement.
- **Mobile bottom clearance:** `main { padding-bottom: 136px }` at ≤767px to clear MobileNav (60px) + GlobalPlayer (64px) + safe-area.

## Layout dimensions
```
Navbar height:            64px (shrinks to 58px on scroll)
Desktop sidebar:          220px fixed, shown ≥1024px
Mobile nav:               60px bottom bar, shown <768px
Feed layout (≥1024px):    grid 1fr 288px (right rail)
Content max-width:        640px (768px on desktop)
Profile max-width:        900px
Feed max-width:           980px
Global player:            64px bottom strip
```

## Error/loading/empty state patterns (Phase 2a)
- **Error:** `[error, setError] = useState<string | null>(null)` + `.catch(() => setError('message'))` + Retry button in `colors.danger`/`colors.dangerBg` banner. Use `colors.danger`, `colors.dangerBg`, `radius.md` from tokens.
- **Loading:** `<LoadingSpinner size="lg" />` centered, or `<SkeletonFeed />` / `<SkeletonBar />` for data-heavy sections.
- **Empty state:** `<EmptyState iconKey="..." title="..." body="..." />` with optional `actionLabel`/`actionTo`.

## Motion language
```
Ease:        cubic-bezier(0.22, 1, 0.36, 1) — custom ease-out
Durations:   xs: 120ms, sm: 180ms, md: 280ms, lg: 450ms
Page enter:  opacity 0→1 + translateY(8px→0), 150ms ease-out
Hover:       scale(1.02) spring — HiveButton; border-color + box-shadow — cards
Focus:       2px solid #f0c040 outline, 2px offset
Reduced:     all animations/transitions → 0.01ms via `prefers-reduced-motion`
```

## Migration (incremental — follow-ups, not a big-bang)
1. ✅ Tokens consolidated + `/styleguide` reference shipped.
2. ✅ Error/loading/empty states added to all secondary route views (Phase 2a).
3. ✅ 320px mobile overflow audit completed for core views (Phase 2b).
4. ✅ Tokens tightened: `space` extended, `radius.2xl/3xl` added, `transition.smooth/smoothSlow`, `layout` token group.
5. ✅ One-off inline hex replaced with tokens across all views and components (P1 sweep).
6. ⬜ Converge duplicate ad-hoc buttons/inputs onto the canonical components above.
7. ✅ ESLint rule banning raw hex in `src/views|components` — promoted to `error`.
8. ⬜ a11y + 320px mobile sweep per component.
