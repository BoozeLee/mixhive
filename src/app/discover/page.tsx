'use client';
import dynamic from 'next/dynamic';

const Discover = dynamic(() => import('@/views/Discover').then(m => ({ default: m.Discover })), { ssr: false });

export default function DiscoverPage() {
  return <Discover />;
}
