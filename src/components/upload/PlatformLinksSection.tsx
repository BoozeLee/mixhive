import { useTranslations } from 'next-intl';
import { Input } from '../ui/Input';
import { colors, space } from '../../styles/tokens';

const PLATFORMS = [
  { key: 'soundcloud', label: 'SoundCloud' },
  { key: 'mixcloud', label: 'Mixcloud' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'spotify', label: 'Spotify' },
  { key: 'applemusic', label: 'Apple Music' },
] as const;

interface PlatformLinksSectionProps {
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function PlatformLinksSection({ values, errors, onChange }: PlatformLinksSectionProps) {
  const t = useTranslations('upload');

  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
        {t('platformLinks')}
      </legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        {PLATFORMS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Input
              type="text"
              value={values[key] ?? ''}
              onChange={e => onChange(key, e.target.value)}
              placeholder={`${label} URL`}
              error={errors[key]}
            />
            {errors[key] && (
              <small
                style={{
                  color: colors.danger,
                  fontSize: 11,
                  display: 'block',
                  marginTop: 2,
                  paddingLeft: space[2],
                }}
              >
                {errors[key]}
              </small>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
