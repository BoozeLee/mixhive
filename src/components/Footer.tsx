import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { Icon } from './ui/Icon';

export function Footer() {
  const t = useTranslations('footer');
  const { user } = useAuth();

  return (
    <footer className="bg-black border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and Description */}
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">{t('mixhive')}</h2>
            <p className="text-gray-400 mb-4">
              The internet's first music hive city for DJs, producers, rave organizers, visual
              artists, and underground culture creators.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">{t('twitter')}</span>
                <Icon name="external" size={18} />
              </a>
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">{t('instagram')}</span>
                <Icon name="camera" size={18} />
              </a>
              <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                <span className="sr-only">{t('youtube')}</span>
                <Icon name="video" size={18} />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-yellow-400 transition-colors inline-flex"
              >
                <span className="sr-only">{t('discord')}</span>
                <Icon name="comment" size={18} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('platform')}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/discover"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  {t('discover')}
                </Link>
              </li>
              <li>
                <Link
                  href="/trending"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  {t('trending')}
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  {t('search')}
                </Link>
              </li>
              {user && (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      {t('dashboard')}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/upload"
                      className="text-gray-400 hover:text-yellow-400 transition-colors"
                    >
                      {t('uploadMix')}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">{t('community')}</h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  {t('guidelines')}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  {t('faq')}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  {t('support')}
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors">
                  {t('blog')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">© 2026 MixHive. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              {t('privacy')}
            </a>
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              {t('terms')}
            </a>
            <a href="#" className="text-gray-400 hover:text-yellow-400 transition-colors text-sm">
              {t('cookies')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
