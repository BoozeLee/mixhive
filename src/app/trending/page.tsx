'use client';
import dynamic from 'next/dynamic';

const Feed = dynamic(() => import('@/views/Feed').then(m => ({ default: m.Feed })), { ssr: false });

export default function TrendingPage() {
  return <Feed />;
}
