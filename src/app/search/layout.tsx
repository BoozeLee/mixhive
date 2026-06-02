import type { ReactNode } from 'react';
import FeedLayout from '@/app/feed/layout';

export default function SearchLayout({ children }: { children: ReactNode }) {
  return <FeedLayout>{children}</FeedLayout>;
}
