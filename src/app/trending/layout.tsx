import type { ReactNode } from 'react';
import FeedLayout from '@/app/feed/layout';

export default function TrendingLayout({ children }: { children: ReactNode }) {
  return <FeedLayout>{children}</FeedLayout>;
}
