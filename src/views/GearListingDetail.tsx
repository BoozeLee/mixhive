import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ReportButton } from '../components/ReportButton';

interface Listing {
  id: string;
  seller_profile_id: string;
  title: string;
  description?: string;
  category: string;
  brand?: string;
  model?: string;
  condition: string;
  price: number;
  currency: string;
  location_city?: string;
  location_country?: string;
  photos: string[];
  shipping_options: {
    local_pickup: boolean;
    domestic_shipping: boolean;
    international_shipping: boolean;
    shipping_notes?: string;
  };
  status: string;
  views_count: number;
  created_at: string;
}

const CONDITIONS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used_good: 'Used – Good',
  used_fair: 'Used – Fair',
  for_parts: 'For Parts',
};

export function GearListingDetail() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/gear/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Not found');
        setListing(data.listing);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleBuy = async () => {
    if (!userId) {
      setBuyError('Sign in to purchase');
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
      if (!res.ok) throw new Error(data.error ?? 'Checkout failed');
      window.location.href = data.checkout_url;
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Purchase failed');
      setBuying(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#555', textAlign: 'center' }}>Loading...</div>;
  }
  if (error || !listing) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#ef4444', marginBottom: 16 }}>{error || 'Listing not found'}</p>
        <Link to="/marketplace/gear" style={{ color: 'var(--hive-gold)' }}>
          ← Back to Gear Market
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px' }}>
      <Link
        to="/marketplace/gear"
        style={{
          color: '#666',
          fontSize: 13,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 20,
        }}
      >
        ← Gear Market
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
              background: '#0a0a0a',
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
                  color: '#333',
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
                    background: '#111',
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
                  color: '#888',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                Description
              </h3>
              <p style={{ color: '#ccc', fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {listing.description}
              </p>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div
          style={{ background: '#111', borderRadius: 12, padding: 24, border: '1px solid #1e1e1e' }}
        >
          <p
            style={{
              color: '#666',
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
              color: '#fff',
              fontSize: 20,
              fontWeight: 700,
              margin: '0 0 4px',
              lineHeight: 1.3,
            }}
          >
            {listing.title}
          </h1>
          {(listing.brand || listing.model) && (
            <p style={{ color: '#888', fontSize: 14, margin: '0 0 16px' }}>
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
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                color: '#ccc',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {CONDITIONS[listing.condition]}
            </span>
            <span
              style={{
                background: '#0a0a0a',
                border: '1px solid #2a2a2a',
                color: '#666',
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
                color: '#666',
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}
            >
              Availability
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {listing.shipping_options.local_pickup && (
                <span style={{ color: '#aaa', fontSize: 13 }}>✓ Local pickup</span>
              )}
              {listing.shipping_options.domestic_shipping && (
                <span style={{ color: '#aaa', fontSize: 13 }}>✓ Domestic shipping</span>
              )}
              {listing.shipping_options.international_shipping && (
                <span style={{ color: '#aaa', fontSize: 13 }}>✓ International shipping</span>
              )}
            </div>
          </div>

          {listing.status === 'active' && userId !== listing.seller_profile_id ? (
            <>
              <button
                onClick={handleBuy}
                disabled={buying}
                style={{
                  width: '100%',
                  background: buying ? '#a08800' : 'var(--hive-gold)',
                  color: '#000',
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
                  ? 'Redirecting to checkout...'
                  : `Buy Now · ${listing.currency} ${listing.price.toLocaleString()}`}
              </button>
              {buyError && (
                <p
                  style={{ color: '#ef4444', fontSize: 12, margin: '0 0 8px', textAlign: 'center' }}
                >
                  {buyError}
                </p>
              )}
              <p style={{ color: '#444', fontSize: 11, textAlign: 'center', margin: 0 }}>
                Secured escrow — funds held until you confirm receipt
              </p>
            </>
          ) : listing.status !== 'active' ? (
            <div
              style={{
                background: '#1a1a1a',
                color: '#666',
                textAlign: 'center',
                padding: 12,
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              This listing is {listing.status}
            </div>
          ) : (
            <div
              style={{
                background: '#1a1a1a',
                color: '#555',
                textAlign: 'center',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              Your listing
            </div>
          )}

          <p style={{ color: '#444', fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>
            {listing.views_count} views · Listed {new Date(listing.created_at).toLocaleDateString()}
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
