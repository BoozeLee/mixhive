'use client';
import dynamic from 'next/dynamic';

const SearchPage = dynamic(() => import('@/views/Search').then(m => ({ default: m.SearchPage })), { ssr: false });

export default function SearchPageRoute() {
  return <SearchPage />;
}
