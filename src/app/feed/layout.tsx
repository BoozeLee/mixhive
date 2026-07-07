import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { SupabaseProvider } from '@/lib/supabase-provider';

export default function FeedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SupabaseProvider>
        <AuthProvider>
          {/* Navigation */}
          <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <div className="flex items-center">
                  <Link href="/" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                      <span className="text-black font-bold">MH</span>
                    </div>
                    <span className="text-white font-bold text-xl">MixHive</span>
                  </Link>
                </div>

                {/* Navigation Links */}
                <div className="hidden md:flex items-center space-x-8">
                  <Link
                    href="/feed"
                    className="text-gray-300 hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Feed
                  </Link>
                  <Link
                    href="/discover"
                    className="text-gray-300 hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Discover
                  </Link>
                  <Link
                    href="/trending"
                    className="text-gray-300 hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Trending
                  </Link>
                  <Link
                    href="/search"
                    className="text-gray-300 hover:text-yellow-400 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Search
                  </Link>
                </div>

                {/* Mobile menu button */}
                <div className="md:hidden">
                  <button aria-label="Toggle menu" className="text-gray-300 hover:text-yellow-400 p-2">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="min-h-screen bg-black">{children}</main>

          {/* Footer */}
          <footer className="bg-gray-900 border-t border-gray-800 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center text-gray-400 text-sm">
                <p>&copy; 2024 MixHive. The Hive Never Sleeps.</p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </SupabaseProvider>
    </>
  );
}
