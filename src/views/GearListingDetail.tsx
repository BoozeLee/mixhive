import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '../styles/tokens';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ReportButton } from '../components/ReportButton';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/Button';
import type { GearListing, GearTransaction } from '../lib/types';

const CONDITIONS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used_good: 'Used – Good',
  used_fair: 'Used – Fair',
  for_parts: 'For Parts',
};

export function GearListingDetail() {
  const t = useTranslations('gear');
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<GearListing | null>(null);
  const [transaction, setTransaction] = useState<GearTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (session) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch(`/api/marketplace/gear/${id}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Not found');
      setListing(data.listing);
      setTransaction(data.transaction);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });
    fetchData();
  }, [id]);

  const handleAction = async (
    action: 'ship' | 'deliver' | 'confirm' | 'dispute',
    body?: Record<string, unknown>
  ) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const res = await fetch(`/api/marketplace/gear/${id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Action failed');
      await fetchData();
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!userId) {
      setBuyError(t('signInToPurchase'));
      return;
    }
    setBuying(true);
    setBuyError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const res = await fetch(`/api/marketplace/gear/${id}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t('checkoutFailed'));
      window.location.href = data.checkout_url;
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : t('purchaseFailed'));
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (error || !listing) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: colors.dangerStrong, marginBottom: 16 }}>
          {error || t('listingNotFound')}
        </p>
        <Link to="/marketplace/gear" style={{ color: 'var(--hive-gold)' }}>
          {t('backToGearMarket')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
      <Link
        to="/marketplace/gear"
        style={{
          color: colors.text.faint,
          fontSize: 13,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
        }}
      >
        {t('gearMarket')}
      </Link>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(260px, 320px)',
          gap: 32,
          alignItems: 'start',
        }}
        className="gear-detail-grid"
      >
        {/* Left: Photos + Description */}
        <div>
          {/* Main photo */}
          <div
            style={{
              aspectRatio: '4/3',
              background: colors.bg,
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            {listing.photos[selectedPhoto] ? (
              <img
                src={listing.photos[selectedPhoto]}
                alt={listing.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: colors.borderStrong,
                  fontSize: 64,
                }}
              >
                🎛
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {listing.photos.length > 1 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {listing.photos.map((url, i) => (
                <button
                  key={i}
                  aria-label={`View photo ${i + 1}`}
                  onClick={() => setSelectedPhoto(i)}
                  style={{
                    width: 64,
                    height: 64,
                    border:
                      i === selectedPhoto ? '2px solid var(--hive-gold)' : '2px solid transparent',
                    borderRadius: 8,
                    overflow: 'hidden',
                    padding: 0,
                    cursor: 'pointer',
                    background: colors.surface,
                  }}
                >
                  <img
                    src={url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          {listing.description && (
            <div>
              <h3
                style={{
                  color: colors.text.muted,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                {t('description')}
              </h3>
              <p
                style={{
                  color: colors.text.secondary,
                  fontSize: 15,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {listing.description}
              </p>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div
          style={{
            background: colors.surface,
            borderRadius: 12,
            padding: 24,
            border: `1px solid ${colors.surfaceRaised}`,
          }}
        >
          <p
            style={{
              color: colors.text.faint,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 6px',
            }}
          >
            {listing.category.replace('_', ' ')}
          </p>
          <h1
            style={{
              color: colors.white,
              fontSize: 20,
              fontWeight: 700,
              margin: '0 0 4px',
              lineHeight: 1.3,
            }}
          >
            {listing.title}
          </h1>
          {(listing.brand || listing.model) && (
            <p style={{ color: colors.text.muted, fontSize: 14, margin: '0 0 16px' }}>
              {[listing.brand, listing.model].filter(Boolean).join(' ')}
            </p>
          )}

          <div
            style={{ fontSize: 28, fontWeight: 700, color: 'var(--hive-gold)', marginBottom: 8 }}
          >
            {listing.currency} {listing.price.toLocaleString()}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <span
              style={{
                background: colors.bg,
                border: `1px solid ${colors.borderStrong}`,
                color: colors.text.secondary,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {CONDITIONS[listing.condition]}
            </span>
            <span
              style={{
                background: colors.bg,
                border: `1px solid ${colors.borderStrong}`,
                color: colors.text.faint,
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {listing.location_city}
              {listing.location_country ? `, ${listing.location_country}` : ''}
            </span>
          </div>

          {/* Shipping */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                color: colors.text.faint,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              {t('availability')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {listing.shipping_options.local_pickup && (
                <span style={{ color: colors.text.dimmed, fontSize: 13 }}>✓ Local pickup</span>
              )}
              {listing.shipping_options.domestic_shipping && (
                <span style={{ color: colors.text.dimmed, fontSize: 13 }}>✓ Domestic shipping</span>
              )}
              {listing.shipping_options.international_shipping && (
                <span style={{ color: colors.text.dimmed, fontSize: 13 }}>
                  ✓ International shipping
                </span>
              )}
            </div>
          </div>

          {transaction && (
            <div
              style={{
                background: colors.surfaceRaised,
                padding: 16,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                marginBottom: 20,
              }}
            >
              <h3
                style={{
                  color: colors.accent,
                  fontSize: 14,
                  margin: '0 0 12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t('transactionStatus')}
              </h3>
              <p
                style={{
                  color: colors.text.primary,
                  fontSize: 15,
                  fontWeight: 600,
                  margin: '0 0 8px',
                }}
              >
                {t(`status_${transaction.transaction_state}`)}
              </p>

              {/* Seller Controls */}
              {userId === listing.seller_profile_id && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {transaction.transaction_state === 'paid_escrow' && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="primary"
                      loading={actionLoading}
                      onClick={() => {
                        const track = prompt('Enter tracking number (optional):');
                        handleAction('ship', { tracking_number: track });
                      }}
                    >
                      {t('markAsShipped')}
                    </Button>
                  )}
                  {transaction.transaction_state === 'shipped' && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="primary"
                      loading={actionLoading}
                      onClick={() => handleAction('deliver')}
                    >
                      {t('markAsDelivered')}
                    </Button>
                  )}
                </div>
              )}

              {/* Buyer Controls */}
              {userId === transaction.buyer_profile_id && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {['paid_escrow', 'shipped', 'delivered'].includes(
                    transaction.transaction_state
                  ) && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="success"
                      loading={actionLoading}
                      onClick={() => handleAction('confirm')}
                    >
                      {t('confirmReceipt')}
                    </Button>
                  )}
                  {transaction.transaction_state === 'shipped' && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="primary"
                      loading={actionLoading}
                      onClick={() => handleAction('deliver')}
                    >
                      {t('markAsDelivered')}
                    </Button>
                  )}
                  {['paid_escrow', 'shipped', 'delivered'].includes(
                    transaction.transaction_state
                  ) && (
                    <Button
                      fullWidth
                      size="lg"
                      variant="danger"
                      loading={actionLoading}
                      onClick={() => {
                        const notes = prompt('Please explain the reason for the dispute:');
                        if (notes) handleAction('dispute', { notes });
                      }}
                    >
                      {t('openDispute')}
                    </Button>
                  )}
                </div>
              )}

              {transaction.transaction_state === 'disputed' && (
                <p style={{ color: colors.dangerStrong, fontSize: 13, marginTop: 12 }}>
                  {t('disputeUnderReview')}
                </p>
              )}
            </div>
          )}

          {listing.status === 'active' && userId !== listing.seller_profile_id && !transaction ? (
            <>
              <button
                onClick={handleBuy}
                disabled={buying}
                style={{
                  width: '100%',
                  background: buying ? colors.accent : 'var(--hive-gold)',
                  color: colors.black,
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px 0',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: buying ? 'default' : 'pointer',
                  marginBottom: 10,
                  opacity: buying ? 0.8 : 1,
                }}
              >
                {buying
                  ? t('redirectingToCheckout')
                  : t('buyNow', {
                      currency: listing.currency,
                      price: listing.price.toLocaleString(),
                    })}
              </button>
              {buyError && (
                <p
                  style={{
                    color: colors.dangerStrong,
                    fontSize: 12,
                    margin: '0 0 8px',
                    textAlign: 'center',
                  }}
                >
                  {buyError}
                </p>
              )}
              <p
                style={{ color: colors.borderStrong, fontSize: 11, textAlign: 'center', margin: 0 }}
              >
                {t('escrowNotice')}
              </p>
            </>
          ) : listing.status !== 'active' ? (
            <div
              style={{
                background: colors.surfaceRaised,
                color: colors.text.faint,
                textAlign: 'center',
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {t('listingStatus', { status: listing.status })}
            </div>
          ) : (
            <div
              style={{
                background: colors.surfaceRaised,
                color: colors.text.faintest,
                textAlign: 'center',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {t('yourListing')}
            </div>
          )}

          <p
            style={{
              color: colors.borderStrong,
              fontSize: 12,
              textAlign: 'center',
              margin: '8px 0 0',
            }}
          >
            {t('metaInfo', {
              views: listing.views_count,
              date: new Date(listing.created_at).toLocaleDateString(),
            })}
          </p>
          {userId && userId !== listing.seller_profile_id && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
              <ReportButton sourceTable="equipment_listings" sourceId={listing.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
