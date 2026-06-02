import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { clearSearchHistory, getSearchHistory } from '../lib/search';
import type { SearchHistoryItem } from '../lib/search';
import { colors, radius, shadow, space } from '../styles/tokens';

interface SearchHistoryProps {
  onSelect: (query: string) => void;
  maxItems?: number;
}

export function SearchHistory({ onSelect, maxItems = 8 }: SearchHistoryProps) {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHistory(getSearchHistory().slice(0, maxItems));
  }, [maxItems]);

  if (history.length === 0) return null;

  function clear() {
    clearSearchHistory();
    setHistory([]);
    setOpen(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(prev => !prev)}>
        Recent ({history.length})
      </Button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 280,
            zIndex: 1000,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.lg,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[8],
              padding: space[8],
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <strong style={{ color: colors.text.secondary, fontSize: 13 }}>Recent searches</strong>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </div>
          {history.map(item => (
            <button
              key={`${item.query}-${item.timestamp}`}
              type="button"
              onClick={() => {
                onSelect(item.query);
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'block',
                padding: '10px 12px',
                background: 'transparent',
                border: 0,
                borderBottom: `1px solid ${colors.border}`,
                color: colors.text.primary,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{item.query}</span>
              <span style={{ display: 'block', color: colors.text.dim, fontSize: 12 }}>
                {new Date(item.timestamp).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
