import { useTranslations } from 'next-intl';
import { EmptyState } from '../EmptyState';

export function EventsTab() {
  const t = useTranslations('profile');
  return <EmptyState iconKey="events" title={t('noEventsTitle')} body={t('noEventsBody')} />;
}
