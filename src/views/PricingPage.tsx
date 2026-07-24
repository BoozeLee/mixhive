'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { colors, space, fontSize, radius } from '../styles/tokens';
import { useNavigate } from 'react-router-dom';

const TIERS = [
  {
    id: 'supporter',
    price: '€5',
    period: '/month',
    features: [
      'aiStudio' as const,
      'analyticsExport' as const,
      'prioritySupport' as const,
      'noWatermark' as const,
      'badge' as const,
    ],
  },
  {
    id: 'insider',
    price: '€12',
    period: '/month',
    featured: true,
    features: [
      'aiStudio' as const,
      'analyticsExport' as const,
      'prioritySupport' as const,
      'noWatermark' as const,
      'badge' as const,
      'earlyAccess' as const,
      'customDomain' as const,
    ],
  },
  {
    id: 'patron',
    price: '€25',
    period: '/month',
    features: [
      'aiStudio' as const,
      'analyticsExport' as const,
      'prioritySupport' as const,
      'noWatermark' as const,
      'badge' as const,
      'earlyAccess' as const,
      'customDomain' as const,
      'directSupport' as const,
      'featureRequests' as const,
    ],
  },
];

export function PricingPage() {
  const t = useTranslations('pricing');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubscribe = async (priceEnvVar: string) => {
    if (!user) {
      navigate('/login');
      return;
    }
    const priceId = process.env[`NEXT_PUBLIC_${priceEnvVar}`] || '';

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    });

    if (!res.ok) return;
    const { url } = await res.json();
    if (url) window.location.assign(url);
  };

  return (
    <div
      style={{
        maxWidth: 1024,
        margin: '0 auto',
        padding: space[8],
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: fontSize['3xl'],
          fontWeight: 700,
          color: colors.text.primary,
          marginBottom: space[2],
        }}
      >
        {t('title')}
      </h1>
      <p
        style={{
          fontSize: fontSize.lg,
          color: colors.text.dim,
          marginBottom: space[10],
        }}
      >
        {t('subtitle')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: space[6],
          alignItems: 'stretch',
        }}
      >
        {TIERS.map(tier => (
          <div
            key={tier.id}
            style={{
              background: tier.featured ? colors.surfaceRaised : colors.surface,
              border: `1px solid ${tier.featured ? colors.accent : colors.border}`,
              borderRadius: radius.lg,
              padding: space[8],
              display: 'flex',
              flexDirection: 'column',
              gap: space[6],
              transform: tier.featured ? 'scale(1.05)' : undefined,
              position: 'relative',
            }}
          >
            {tier.featured && (
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: colors.accent,
                  color: colors.black,
                  padding: '4px 16px',
                  borderRadius: radius.full,
                  fontSize: fontSize.xs,
                  fontWeight: 600,
                }}
              >
                {t('popular')}
              </span>
            )}

            <h2
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: 700,
                color: colors.text.primary,
                textTransform: 'capitalize',
              }}
            >
              {t(tier.id as never)}
            </h2>

            <div>
              <span
                style={{
                  fontSize: fontSize['3xl'],
                  fontWeight: 700,
                  color: colors.text.primary,
                }}
              >
                {tier.price}
              </span>
              <span style={{ fontSize: fontSize.sm, color: colors.text.dim }}>{tier.period}</span>
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: space[3],
                textAlign: 'left',
              }}
            >
              {tier.features.map(f => (
                <li
                  key={f}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    fontSize: fontSize.sm,
                    color: colors.text.secondary,
                  }}
                >
                  <Icon name="check" size={16} color={colors.success} />
                  {t(f)}
                </li>
              ))}
            </ul>

            <Button
              variant={tier.featured ? 'primary' : 'secondary'}
              size="lg"
              onClick={() => handleSubscribe(`${tier.id.toUpperCase()}_PRICE_ID`)}
              style={{ marginTop: 'auto' }}
            >
              {t('subscribe')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
