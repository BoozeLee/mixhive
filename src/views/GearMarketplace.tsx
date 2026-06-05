import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProfileBadgesFor } from '../lib/api';
import type { VerificationBadge } from '../lib/types';
import { VerificationBadgeSystem } from '../components/VerificationBadgeSystem';

interface Listing {
  id: string;
  title: string;
  category: string;
  brand?: string;
  model?: string;
  condition: string;
  price: number;
  currency: string;
  location_city?: string;
  location_country?: string;
  photos: string[];
  status: string;
  created_at: string;
  seller_profile_id: string;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'mixer', label: 'Mixer' },
  { value: 'cdj', label: 'CDJ / Media Player' },
  { value: 'controller', label: 'Controller' },
  { value: 'turntable', label: 'Turntable' },
  { value: 'synthesizer', label: 'Synthesizer' },
  { value: 'sampler', label: 'Sampler' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'headphones', label: 'Headphones' },
  { value: 'interface', label: 'Audio Interface' },
  { value: 'cable_accessory', label: 'Cables & Accessories' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used_good: 'Used – Good',
  used_fair: 'Used – Fair',
  for_parts: 'For Parts',
};

const CONDITION_COLORS: Record<string, string> = {
  new: '#22c55e',
  like_new: '#86efac',
  used_good: '#f6c400',
  used_fair: '#fb923c',
  for_parts: '#ef4444',
};

export function GearMarketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sellerBadges, setSellerBadges] = useState<Record<string, VerificationBadge[]>>({});
  const limit = 24;

  const fetchListings = async (cat: string, cond: string, max: string, off: number) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(limit), offset: String(off) });
    if (cat) params.set('category', cat);
    if (cond) params.set('condition', cond);
    if (max) params.set('max_price', max);

    try {
      const res = await fetch(`/api/marketplace/gear?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setListings(data.listings);
      setTotal(data.total);
      // One batched badge query for all sellers on the page (avoids N+1 per card).
      const ids = (data.listings as Listing[]).map(l => l.seller_profile_id);
      setSellerBadges(await getProfileBadgesFor(ids));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings(category, condition, maxPrice, 0);
    setOffset(0);
  }, [category, condition, maxPrice]);

  const handleLoadMore = () => {
    const next = offset + limit;
    setOffset(next);
    fetchListings(category, condition, maxPrice, next);
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="p15-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--hive-gold)', margin: 0, letterSpacing: '0.05em' }}>
            GEAR MARKET
          </h1>
          <p style={{ color: '#888', margin: '4px 0 0', fontSize: 14 }}>
            Second-hand DJ &amp; studio equipment from the community
          </p>
        </div>
        <Link
          to="/marketplace/gear/new"
          style={{
            background: 'var(--hive-gold)',
            color: '#000',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          + List Gear
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={selectStyle}
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={condition}
          onChange={e => setCondition(e.target.value)}
          style={selectStyle}
        >
          <option value="">Any Condition</option>
          {Object.entries(CONDITIONS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Max price (€)"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
          style={{ ...selectStyle, width: 150 }}
        />
        {(category || condition || maxPrice) && (
          <button
            onClick={() => { setCategory(''); setCondition(''); setMaxPrice(''); }}
            style={{ background: 'transparent', border: '1px solid #444', color: '#aaa', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Count */}
      {!loading && (
        <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
          {total} listing{total !== 1 ? 's' : ''}
        </p>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: '#ef4444', padding: 16, background: '#1a0000', borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 280, background: '#111', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#555' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎛</div>
          <p style={{ fontSize: 18 }}>No listings found</p>
          <p style={{ fontSize: 14 }}>Try different filters or <Link to="/marketplace/gear/new" style={{ color: 'var(--hive-gold)' }}>list your gear</Link></p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {listings.map(listing => (
            <GearCard
              key={listing.id}
              listing={listing}
              badges={sellerBadges[listing.seller_profile_id] ?? []}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && listings.length > 0 && offset + limit < total && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button onClick={handleLoadMore} style={loadMoreBtnStyle}>
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function GearCard({ listing, badges }: { listing: Listing; badges: VerificationBadge[] }) {
  const condColor = CONDITION_COLORS[listing.condition] ?? '#888';
  const photo = listing.photos[0];

  return (
    <Link
      to={`/marketplace/gear/${listing.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        background: '#111',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid #1e1e1e',
        transition: 'border-color 0.2s, transform 0.2s',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#f6c40044';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = '#1e1e1e';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Photo */}
        <div style={{ aspectRatio: '4/3', background: '#0a0a0a', overflow: 'hidden', position: 'relative' }}>
          {photo ? (
            <img
              src={photo}
              alt={listing.title}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#333', fontSize: 40 }}>
              🎛
            </div>
          )}
          <span style={{
            position: 'absolute', top: 8, right: 8,
            background: '#000a',
            color: condColor,
            border: `1px solid ${condColor}44`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {CONDITIONS[listing.condition]}
          </span>
        </div>

        {/* Info */}
        <div style={{ padding: '12px 14px' }}>
          <p style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>
            {listing.category.replace('_', ' ')}
          </p>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 8px', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {listing.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--hive-gold)', fontSize: 18, fontWeight: 700 }}>
              €{listing.price.toLocaleString()}
            </span>
            <span style={{ color: '#555', fontSize: 12 }}>
              {listing.location_city}{listing.location_country ? `, ${listing.location_country}` : ''}
            </span>
          </div>
          {badges.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <VerificationBadgeSystem badges={badges} compact />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #2a2a2a',
  color: '#ccc',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};

const loadMoreBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #333',
  color: '#ccc',
  padding: '12px 32px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
};
