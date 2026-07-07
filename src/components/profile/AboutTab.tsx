import { useTranslations } from 'next-intl';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import type { Profile } from '../../lib/types';

interface AboutTabProps {
  profile: Profile;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

export function AboutTab({ profile }: AboutTabProps) {
  const t = useTranslations('profile');

  const fields: {
    label: string;
    value?: string | null;
    icon: 'profile' | 'discover' | 'gear' | 'music' | 'settings' | 'external';
  }[] = [
    { label: t('aboutLocation'), value: profile.location, icon: 'discover' },
    { label: t('aboutWebsite'), value: profile.website, icon: 'external' },
    { label: t('aboutEquipment'), value: profile.dj_equipment?.join(', '), icon: 'gear' },
    { label: t('aboutDaw'), value: profile.dj_daw?.join(', '), icon: 'music' },
    { label: t('aboutStyle'), value: profile.dj_style, icon: 'profile' },
    { label: t('aboutJoined'), value: formatDate(profile.created_at), icon: 'settings' },
  ];

  const socials = Object.entries(profile.social_links || {}).filter(([, url]) => url?.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
      {fields.map(
        ({ label, value, icon }) =>
          value && (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: space[4],
                padding: space[5],
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
              }}
            >
              <span style={{ color: colors.accentMuted, lineHeight: 0, marginTop: 2 }}>
                <Icon name={icon} size={16} color="currentColor" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: fontSize.sm, color: colors.text.dim, marginBottom: space[1] }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: fontSize.md,
                    color: colors.text.secondary,
                    wordBreak: 'break-word',
                  }}
                >
                  {value}
                </div>
              </div>
            </div>
          )
      )}

      {socials.length > 0 && (
        <div
          style={{
            padding: space[6],
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
          }}
        >
          <h3
            style={{
              fontSize: fontSize.md,
              fontWeight: fontWeight.semibold,
              color: colors.text.primary,
              margin: `0 0 ${space[5]}px`,
            }}
          >
            {t('aboutSocials')}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
            {socials.map(([name, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: space[3],
                  padding: `${space[4]}px ${space[5]}px`,
                  background: colors.surfaceHover,
                  border: `1px solid ${colors.borderStrong}`,
                  borderRadius: radius.md,
                  color: colors.text.secondary,
                  textDecoration: 'none',
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.semibold,
                  textTransform: 'capitalize',
                }}
              >
                <Icon name="external" size={14} color="currentColor" />
                {name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
