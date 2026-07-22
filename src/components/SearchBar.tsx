import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { SearchAutocomplete } from './SearchAutocomplete';
import { colors } from '../styles/tokens';

export function SearchBar() {
  const t = useTranslations('searchBar');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // The handler below accepts Cmd *or* Ctrl, but the hint always read "⌘K" —
  // so every Windows and Linux user was shown a key they do not have. Resolved
  // after mount to keep server and client markup identical.
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');
  useEffect(() => {
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    setShortcutLabel(isApple ? '⌘K' : 'Ctrl K');
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        wrapperRef.current?.querySelector('input')?.focus();
      }
      if (e.key === 'Escape') {
        wrapperRef.current?.querySelector('input')?.blur();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
      {/* No submit button here: it rendered directly underneath the shortcut
          hint below, so the two overlapped in the navbar. Enter still submits. */}
      <SearchAutocomplete
        onSearch={handleSearch}
        placeholder={t('placeholder')}
        showSubmitButton={false}
      />
      <kbd
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: colors.surface,
          color: colors.text.muted,
          fontSize: 11,
          padding: '2px 5px',
          borderRadius: 4,
          border: `1px solid ${colors.border}`,
          pointerEvents: 'none',
        }}
      >
        {shortcutLabel}
      </kbd>
    </div>
  );
}
