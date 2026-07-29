import { useLocation } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { EmptyState } from '../components/EmptyState';
import { colors } from '../styles/tokens';

export function NotFound() {
  const t = useTranslations('notFound');
  const location = useLocation();
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 16px' }}>
      <EmptyState
        icon="404"
        title={t('pageNotFound')}
        body={
          <>
            <span style={{ color: colors.text.muted }}>{t('noRouteMatches')}</span>{' '}
            <code style={{ color: colors.accent, fontFamily: 'monospace', fontSize: 13 }}>
              {location.pathname}
            </code>
            {t('mightHaveMoved')}
          </>
        }
        actionLabel={t('backToFeed')}
        actionTo="/feed"
      />
    </div>
  );
}
