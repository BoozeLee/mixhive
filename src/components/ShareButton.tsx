import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import type { Mix } from '../lib/types';
import { colors, radius, shadow, space } from '../styles/tokens';

interface ShareButtonProps {
  mix?: Mix;
  title?: string;
  url?: string;
  variant?: 'icon' | 'button';
  showCount?: boolean;
  onShare?: () => void;
  className?: string;
}

export function ShareButton({
  mix,
  title,
  url,
  variant = 'icon',
  showCount = false,
  onShare,
  className,
}: ShareButtonProps) {
  const t = useTranslations('shareButton');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const shareUrl = url || window.location.href;
  const shareTitle = title || mix?.title || t('checkOutThisMix');

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    setShareCount(prev => prev + 1);
    onShare?.();
    setOpen(false);
  }

  async function nativeShare() {
    if (!navigator.share) return copy();
    await navigator.share({ title: shareTitle, url: shareUrl });
    setShareCount(prev => prev + 1);
    onShare?.();
    setOpen(false);
  }

  const trigger =
    variant === 'icon' ? (
      <IconButton label={t('share')} onClick={() => setOpen(prev => !prev)} className={className}>
        ↗
      </IconButton>
    ) : (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(prev => !prev)}
        className={className}
      >
        {t('share')}{showCount ? ` ${shareCount}` : ''}
      </Button>
    );

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger}
      {open && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            zIndex: 1000,
            minWidth: 160,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.lg,
            boxShadow: shadow.lg,
            overflow: 'hidden',
          }}
        >
          <button type="button" onClick={nativeShare} style={menuItemStyle}>
            {t('share')}
          </button>
          <button type="button" onClick={copy} style={menuItemStyle}>
            {copied ? t('copied') : t('copyLink')}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ ...menuItemStyle, color: colors.text.dim }}
          >
            {t('cancel')}
          </button>
        </span>
      )}
    </span>
  );
}

const menuItemStyle = {
  display: 'block',
  width: '100%',
  padding: `${space[7]}px ${space[8]}px`,
  background: 'transparent',
  border: 0,
  borderBottom: `1px solid ${colors.border}`,
  color: colors.text.primary,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  textAlign: 'left' as const,
};

export function useShare(mix?: Mix, title?: string, url?: string) {
  const [shareCount, setShareCount] = useState(0);

  async function handleShare() {
    await navigator.clipboard.writeText(url || window.location.href);
    setShareCount(prev => prev + 1);
    void mix;
    void title;
  }

  return { shareCount, handleShare };
}
