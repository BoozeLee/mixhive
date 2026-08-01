'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(false);
  const [tierError, setTierError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSubscriptionTier(null);
      setTierError(null);
      return;
    }
    let cancelled = false;
    setTierLoading(true);
    setTierError(null);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        if (!cancelled) {
          setTierLoading(false);
          setSubscriptionTier('free');
        }
        return;
      }
      fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch status');
          return res.json();
        })
        .then(data => {
          if (!cancelled) {
            setSubscriptionTier(data.tier || 'free');
            setTierLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTierError('Could not load subscription status');
            setTierLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleManageBilling = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch('/api/subscription/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const { url } = await res.json();
      if (url) window.location.href = url;
    }
  };

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

  const hasSubscription = subscriptionTier && subscriptionTier !== 'free';

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

      {tierError && (
        <div
          style={{
            marginBottom: space[8],
            padding: space[4],
            background: colors.dangerBg,
            borderRadius: radius.md,
            border: `1px solid ${colors.danger}`,
            color: colors.danger,
            fontSize: fontSize.sm,
          }}
        >
          {tierError}
        </div>
      )}

      {tierLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: space[12] }}>
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: space[6],
            alignItems: 'start',
          }}
        >
          {TIERS.map(tier => {
            const isCurrentTier = subscriptionTier === tier.id;
            return (
              <div
                key={tier.id}
                style={{
                  background: tier.featured ? colors.surfaceElevated : colors.surface,
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
                  <span style={{ fontSize: fontSize.sm, color: colors.text.dim }}>
                    {tier.period}
                  </span>
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

                {isCurrentTier ? (
                  <Button variant="secondary" size="lg" disabled style={{ marginTop: 'auto' }}>
                    {t('current')}
                  </Button>
                ) : (
                  <Button
                    variant={tier.featured ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={() => handleSubscribe(`${tier.id.toUpperCase()}_PRICE_ID`)}
                    style={{ marginTop: 'auto' }}
                  >
                    {t('subscribe')}
                  </Button>
                )}

                {hasSubscription && isCurrentTier && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManageBilling}
                    style={{ marginTop: 0 }}
                  >
                    {t('manage')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
