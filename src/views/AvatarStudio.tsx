import { useTranslations } from 'next-intl';
import { Link } from 'react-router-dom';
import { ProfileArtStudio } from '../components/ProfileArtStudio';
import { colors, space, fontSize } from '../styles/tokens';

export function AvatarStudio() {
  const t = useTranslations('avatarStudio');
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: `${space[10]}px ${space[6]}px 120px` }}>
      <Link to="/settings" style={{ color: colors.accent, fontSize: fontSize.sm }}>
        ← {t('backToSettings')}
      </Link>
      <div style={{ marginTop: space[6] }}>
        <ProfileArtStudio />
      </div>
    </div>
  );
}
