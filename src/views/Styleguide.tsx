'use client';

// MixHive Design System — living reference (P1). One page that renders the
// canonical tokens + components so the whole app has a single source of truth.
// Roles: `components/ui/*` = generic primitives (controls), `components/hive/*`
// = brand surfaces. Do not introduce ad-hoc hex; consume tokens from here.
import {
  colors,
  space,
  radius,
  fontSize,
  fontWeight,
  shadow,
  display,
  gradient,
} from '../styles/tokens';
import { Button, Input, Textarea, Select } from '../components/ui';
import { HiveButton, HiveCard, HiveBadge, HiveStat, type HiveTier } from '../components/hive';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: space[12] }}>
      <h2
        style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: space[4],
          marginBottom: space[8],
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[6], alignItems: 'center' }}>
      {children}
    </div>
  );
}

const colorGroups: Array<[string, Record<string, string>]> = [
  [
    'Surfaces',
    {
      bg: colors.bg,
      surface: colors.surface,
      surfaceHover: colors.surfaceHover,
      surfaceMuted: colors.surfaceMuted,
    },
  ],
  [
    'Borders',
    { border: colors.border, borderStrong: colors.borderStrong, borderSubtle: colors.borderSubtle },
  ],
  [
    'Accent (gold)',
    {
      accent: colors.accent,
      accentHover: colors.accentHover,
      accentMuted: colors.accentMuted,
      accentFaint: colors.accentFaint,
    },
  ],
  ['Text', colors.text as unknown as Record<string, string>],
  [
    'Semantic',
    { danger: colors.danger, success: colors.success, warning: colors.warning, info: colors.info },
  ],
];

export function Styleguide() {
  const buttonVariants = ['primary', 'secondary', 'ghost', 'danger'] as const;
  const hiveVariants = ['primary', 'ghost', 'glass', 'danger'] as const;
  const tiers: HiveTier[] = ['queen', 'worker', 'scout', 'drone', 'verified'];

  return (
    <div
      style={{
        maxWidth: 1040,
        margin: '0 auto',
        padding: `${space[11]}px ${space[8]}px 120px`,
        color: colors.text.secondary,
      }}
    >
      <header>
        <h1
          style={{
            fontSize: display.sm,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            margin: 0,
          }}
        >
          MixHive Design System
        </h1>
        <p style={{ fontSize: fontSize.sm, color: colors.text.dim, marginTop: space[3] }}>
          One reference for tokens + canonical components. `ui/*` = primitives, `hive/*` = brand
          surfaces. No ad-hoc hex.
        </p>
      </header>

      <Section title="Color">
        {colorGroups.map(([group, swatches]) => (
          <div key={group} style={{ marginBottom: space[8] }}>
            <div
              style={{
                fontSize: fontSize.xs,
                color: colors.text.dim,
                textTransform: 'uppercase',
                marginBottom: space[4],
              }}
            >
              {group}
            </div>
            <Row>
              {Object.entries(swatches).map(([name, hex]) => (
                <div key={name} style={{ width: 132 }}>
                  <div
                    style={{
                      height: 52,
                      background: hex,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                    }}
                  />
                  <div
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.text.secondary,
                      marginTop: space[2],
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontSize: fontSize.xs,
                      color: colors.text.dim,
                      fontFamily: 'monospace',
                    }}
                  >
                    {hex}
                  </div>
                </div>
              ))}
            </Row>
          </div>
        ))}
      </Section>

      <Section title="Typography">
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            textTransform: 'uppercase',
            marginBottom: space[4],
          }}
        >
          UI scale
        </div>
        {(Object.keys(fontSize) as Array<keyof typeof fontSize>).map(k => (
          <div
            key={k}
            style={{ color: colors.text.primary, fontSize: fontSize[k], lineHeight: 1.3 }}
          >
            <span
              style={{
                color: colors.text.dim,
                fontSize: fontSize.xs,
                fontFamily: 'monospace',
                marginRight: space[6],
              }}
            >
              {k}/{fontSize[k]}px
            </span>
            The quick brown fox
          </div>
        ))}
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            textTransform: 'uppercase',
            margin: `${space[8]}px 0 ${space[4]}px`,
          }}
        >
          Display scale
        </div>
        {(['sm', 'md', 'lg'] as const).map(k => (
          <div
            key={k}
            style={{
              color: colors.text.primary,
              fontSize: display[k],
              fontWeight: fontWeight.bold,
              lineHeight: 1.05,
            }}
          >
            Hive {k}
          </div>
        ))}
      </Section>

      <Section title="Spacing & Radius">
        <Row>
          {Object.entries(space)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center' }}>
                <div style={{ width: v, height: v, background: colors.accent, borderRadius: 2 }} />
                <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: space[2] }}>
                  {k}
                </div>
              </div>
            ))}
        </Row>
        <Row>
          {(Object.keys(radius) as Array<keyof typeof radius>).map(k => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 40,
                  background: colors.surfaceHover,
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: radius[k],
                }}
              />
              <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: space[2] }}>
                {k}
              </div>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Elevation & Gradient">
        <Row>
          {(['sm', 'md', 'lg', 'accent', 'elevated', 'honey'] as const).map(k => (
            <div
              key={k}
              style={{
                width: 120,
                height: 64,
                background: colors.surface,
                borderRadius: radius.lg,
                boxShadow: shadow[k],
                display: 'grid',
                placeItems: 'center',
                fontSize: fontSize.xs,
                color: colors.text.dim,
              }}
            >
              {k}
            </div>
          ))}
        </Row>
        <Row>
          {(['honey', 'ember', 'meshTop'] as const).map(k => (
            <div
              key={k}
              style={{
                width: 160,
                height: 64,
                background: gradient[k],
                borderRadius: radius.lg,
                display: 'grid',
                placeItems: 'center',
                fontSize: fontSize.xs,
                color: colors.black,
                fontWeight: fontWeight.semibold,
              }}
            >
              {k}
            </div>
          ))}
        </Row>
      </Section>

      <Section title="Buttons">
        <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginBottom: space[4] }}>
          ui/Button
        </div>
        <Row>
          {buttonVariants.map(v => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </Row>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            margin: `${space[6]}px 0 ${space[4]}px`,
          }}
        >
          hive/HiveButton
        </div>
        <Row>
          {hiveVariants.map(v => (
            <HiveButton key={v} variant={v}>
              {v}
            </HiveButton>
          ))}
        </Row>
      </Section>

      <Section title="Form controls (ui/*)">
        <div style={{ display: 'grid', gap: space[6], maxWidth: 420 }}>
          <Input label="Display name" placeholder="DJ Nefke" help="Shown on your profile" />
          <Textarea label="Bio" placeholder="Dark rolling techno from Brussels…" rows={3} />
          <Select
            label="Genre"
            options={[
              { value: 'techno', label: 'Techno' },
              { value: 'house', label: 'House' },
            ]}
            placeholder="Pick a genre"
          />
        </div>
      </Section>

      <Section title="Brand surfaces (hive/*)">
        <Row>
          {(['panel', 'glow', 'flat'] as const).map(tone => (
            <HiveCard key={tone} tone={tone} style={{ width: 200, padding: space[8] }}>
              <div style={{ color: colors.text.primary, fontWeight: fontWeight.semibold }}>
                HiveCard
              </div>
              <div style={{ color: colors.text.dim, fontSize: fontSize.sm }}>tone="{tone}"</div>
            </HiveCard>
          ))}
        </Row>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            margin: `${space[6]}px 0 ${space[4]}px`,
          }}
        >
          HiveBadge
        </div>
        <Row>
          {tiers.map(t => (
            <HiveBadge key={t} tier={t} label={t} />
          ))}
        </Row>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            margin: `${space[6]}px 0 ${space[4]}px`,
          }}
        >
          HiveStat
        </div>
        <Row>
          <HiveStat label="plays" value={1280} sparkline={[3, 6, 4, 9, 7, 12]} />
          <HiveStat label="likes" value={342} delta={12} />
        </Row>
      </Section>
    </div>
  );
}
