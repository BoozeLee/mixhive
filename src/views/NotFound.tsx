import { useLocation } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { EmptyState } from '../components/EmptyState';

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
            <span style={{ color: '#888' }}>{t('noRouteMatches')}</span>{' '}
            <code style={{ color: '#f0c040', fontFamily: 'monospace', fontSize: 13 }}>
              {location.pathname}
            </code>
            . It might have moved or never existed.
          </>
        }
        actionLabel="Back to feed"
        actionTo="/feed"
      />
    </div>
  );
}
