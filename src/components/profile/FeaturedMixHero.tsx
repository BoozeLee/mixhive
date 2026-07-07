import { useTranslations } from 'next-intl';
import { MixCard } from '../MixCard';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';
import type { Mix, Profile } from '../../lib/types';

interface FeaturedMixHeroProps {
  mix: Mix;
  profile: Profile;
}

export function FeaturedMixHero({ mix, profile }: FeaturedMixHeroProps) {
  const t = useTranslations('profile');
  return (
    <section style={{ marginBottom: space[10] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[4],
          marginBottom: space[5],
        }}
      >
        <div
          style={{
            width: 4,
            height: 20,
            borderRadius: radius.sm,
            background: colors.accent,
          }}
        />
        <h2
          style={{
            fontSize: fontSize.md,
            fontWeight: fontWeight.bold,
            color: colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          {t('featuredMix')}
        </h2>
      </div>
      <MixCard
        mix={{
          ...mix,
          dj_username: profile.username,
          dj_display_name: profile.display_name || profile.username,
          dj_avatar_url: profile.avatar_url || '',
          genre_name: mix.genre_name || null,
          weekly_plays: mix.weekly_plays || 0,
        }}
      />
    </section>
  );
}
