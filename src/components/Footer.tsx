import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function Footer() {
  const { user } = useAuth();

  return (
    <footer className="bg-black border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">MIXHIVE</h2>
            <p className="text-gray-400 mb-4">
              The internet's first music hive city for DJs, producers, rave organizers, visual
              artists, and underground culture creators.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">Twitter</span>
                🐦
              </a>
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">Instagram</span>
                📷
              </a>
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">YouTube</span>
                📺
              </a>
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">Discord</span>
                💬
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/discover"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  Discover
                </Link>
              </li>
              <li>
                <Link
                  href="/trending"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  Trending
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  Search
                </Link>
              </li>
              {user && (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/upload"
                      className="text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      Upload Mix
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  Guidelines
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  FAQ
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  Support
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">© 2026 MixHive. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              Privacy
            </a>
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              Terms
            </a>
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
