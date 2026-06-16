import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { getPopularSearches, getSearchSuggestions } from '../lib/search';
import type { SearchSuggestion } from '../lib/search';
import { colors, radius, shadow, space } from '../styles/tokens';

interface SearchAutocompleteProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchAutocomplete({
  onSearch,
  placeholder,
  className,
}: SearchAutocompleteProps) {
  const t = useTranslations('searchAutocomplete');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      if (!query.trim()) {
        setSuggestions([]);
        return;
      }
      const next = await getSearchSuggestions(query, 5);
      if (!cancelled) {
        setSuggestions(next);
        setOpen(true);
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function submit(searchQuery = query) {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    onSearch(trimmed);
    setOpen(false);
  }

  function choose(suggestion: SearchSuggestion) {
    if (suggestion.href) navigate(suggestion.href);
    else submit(suggestion.title);
    setOpen(false);
  }

  const visibleSuggestions = query.trim()
    ? suggestions
    : getPopularSearches()
        .slice(0, 6)
        .map(title => ({
          type: 'genre' as const,
          title,
          subtitle: t('popularSearch'),
        }));

  return (
    <div ref={wrapperRef} className={className} style={{ position: 'relative' }}>
      <form
        onSubmit={event => {
          event.preventDefault();
          submit();
        }}
        style={{ display: 'flex', gap: space[6] }}
      >
        <Input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || t('placeholder')}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button type="submit" size="sm" disabled={!query.trim()}>
          {t('search')}
        </Button>
      </form>

      {open && visibleSuggestions.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.lg,
            overflow: 'hidden',
          }}
        >
          {visibleSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.title}-${index}`}
              type="button"
              onClick={() => choose(suggestion)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: space[8],
                padding: '10px 12px',
                background: 'transparent',
                border: 0,
                borderBottom:
                  index === visibleSuggestions.length - 1 ? 0 : `1px solid ${colors.border}`,
                color: colors.text.primary,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span aria-hidden="true">
                {suggestion.type === 'profile'
                  ? '@'
                  : suggestion.type === 'mix'
                    ? '♪'
                    : suggestion.type === 'scene'
                      ? '⌖'
                      : '#'}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {suggestion.title}
                </span>
                {suggestion.subtitle && (
                  <span
                    style={{
                      display: 'block',
                      color: colors.text.dim,
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {suggestion.subtitle}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
