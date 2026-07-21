import { useTranslations } from 'next-intl';
import { colors, space } from '../styles/tokens';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'main' | 'business';
  showText?: boolean;
  className?: string;
}

export function Logo({
  size = 'medium',
  variant = 'main',
  showText = true,
  className = '',
}: LogoProps) {
  const t = useTranslations('logo');
  const sizeStyles = {
    small: { width: 24, height: 24, textSize: 16 },
    medium: { width: 32, height: 32, textSize: 20 },
    large: { width: 48, height: 48, textSize: 24 },
  };

  const currentSize = sizeStyles[size];
  const logoSrc = variant === 'business' ? '/mixhivebusinesslogo.png' : '/mixhive.png';

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
      <img
        src={logoSrc}
        alt={t('altLogo')}
        style={{
          width: currentSize.width,
          height: currentSize.height,
          borderRadius: size === 'small' ? 4 : 6,
          objectFit: 'cover',
          mixBlendMode: 'screen',
          filter: 'drop-shadow(0 0 10px rgba(246,196,0,0.32))',
          flexShrink: 0,
        }}
      />
      {showText && (
        <span
          style={{
            fontSize: currentSize.textSize,
            fontWeight: 700,
            color: colors.accent,
            letterSpacing: 0,
          }}
        >
          mixhive
        </span>
      )}
    </div>
  );
}

// Icon-only logo for small spaces
export function LogoIcon({
  variant = 'main',
  className = '',
}: {
  variant?: 'main' | 'business';
  className?: string;
}) {
  const t = useTranslations('logo');
  const logoSrc = variant === 'business' ? '/mixhivebusinesslogo.png' : '/mixhive.png';
  return (
    <img
      src={logoSrc}
      alt={t('altIcon')}
      className={className}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        objectFit: 'cover',
        mixBlendMode: 'screen',
        filter: 'drop-shadow(0 0 10px rgba(246,196,0,0.32))',
      }}
    />
  );
}

// Stacked logo for special branding
export function LogoStacked({ className = '' }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
    >
      <LogoIcon variant="business" />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: colors.accent,
          letterSpacing: 0,
        }}
      >
        mixhive
      </span>
    </div>
  );
}
