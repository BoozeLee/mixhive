import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AgentPackage {
  id: string;
  name: string;
  tagline?: string;
  category: string;
  discipline_focus: string[];
  complexity: string;
  price: number;
  license: string;
  capabilities: string[];
  tools_used: string[];
  install_count: number;
  avg_rating: number;
  rating_count: number;
  official: boolean;
  verified: boolean;
  creator_profile_id: string;
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'booking', label: 'Booking' },
  { value: 'social_automation', label: 'Social Automation' },
  { value: 'collab_coordinator', label: 'Collab Coordinator' },
  { value: 'visual_brand', label: 'Visual & Brand' },
  { value: 'quest_automation', label: 'Quest Automations' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'gear_assistant', label: 'Gear Assistant' },
  { value: 'custom', label: 'Custom' },
];

const DISCIPLINES = ['dj', 'producer', 'visual_artist', 'business'];

export function AgentMarketplace() {
  const [packages, setPackages] = useState<AgentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const location = useLocation();

  const fetchPackages = async (cat: string, disc: string, free: boolean) => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: '20' });
    if (cat) params.set('category', cat);
    if (disc) params.set('discipline', disc);
    if (free) params.set('free', 'true');
    try {
      const res = await fetch(`/api/marketplace/agents?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setPackages(data.packages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages(category, discipline, freeOnly);
  }, [category, discipline, freeOnly]);

  // Mark as installed when returning from Stripe success
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      const pkgId = params.get('package_id');
      if (pkgId) setInstalled(prev => new Set([...prev, pkgId]));
    }
  }, [location.search]);

  const handleBuy = async (pkg: AgentPackage) => {
    if (buying) return;
    setBuying(pkg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Sign in to purchase agents'); return; }
      const res = await fetch(`/api/marketplace/agents/${pkg.id}/buy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Purchase failed');
      window.location.href = data.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
      setBuying(null);
    }
  };

  const handleInstall = async (pkg: AgentPackage) => {
    if (installing) return;
    setInstalling(pkg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Sign in to install agents'); return; }
      const res = await fetch(`/api/marketplace/agents/${pkg.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Install failed');
      setInstalled(prev => new Set([...prev, pkg.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Install failed');
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--hive-gold)', margin: 0, letterSpacing: '0.05em' }}>
          AGENT MARKETPLACE
        </h1>
        <p style={{ color: '#888', margin: '4px 0 0', fontSize: 14 }}>
          Discover Lua agents that automate your creative workflow
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <select value={category} onChange={e => setCategory(e.target.value)} style={selectStyle}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={discipline} onChange={e => setDiscipline(e.target.value)} style={selectStyle}>
          <option value="">All Disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={freeOnly} onChange={e => setFreeOnly(e.target.checked)} />
          Free only
        </label>
      </div>

      {error && (
        <div style={{ color: '#ef4444', padding: 12, background: '#1a0000', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 200, background: '#111', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#555' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <p style={{ fontSize: 18 }}>No agents found</p>
          <p style={{ fontSize: 14 }}>Try different filters</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {packages.map(pkg => (
            <AgentCard
              key={pkg.id}
              pkg={pkg}
              installed={installed.has(pkg.id)}
              installing={installing === pkg.id}
              buying={buying === pkg.id}
              onInstall={() => handleInstall(pkg)}
              onBuy={() => handleBuy(pkg)}
            />
          ))}
        </div>
      )}

      {/* Link to personal agents */}
      <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666', fontSize: 14 }}>Have your own agent idea?</span>
        <Link to="/agents" style={{ color: 'var(--hive-gold)', fontSize: 14, textDecoration: 'none' }}>
          Build with the Lua Builder →
        </Link>
      </div>
    </div>
  );
}

function AgentCard({
  pkg, installed, installing, buying, onInstall, onBuy,
}: {
  pkg: AgentPackage;
  installed: boolean;
  installing: boolean;
  buying: boolean;
  onInstall: () => void;
  onBuy: () => void;
}) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #1e1e1e',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#f6c40033')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666' }}>
          {pkg.category.replace('_', ' ')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {pkg.official && (
            <span style={{ background: '#f6c40022', color: 'var(--hive-gold)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
              OFFICIAL
            </span>
          )}
          {pkg.verified && !pkg.official && (
            <span style={{ background: '#22c55e22', color: '#22c55e', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
              VERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Name + tagline */}
      <div>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 4 }}>{pkg.name}</h3>
        {pkg.tagline && <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.4 }}>{pkg.tagline}</p>}
      </div>

      {/* Disciplines */}
      {pkg.discipline_focus.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {pkg.discipline_focus.slice(0, 3).map(d => (
            <span key={d} style={{ background: '#1a1a1a', color: '#888', fontSize: 11, padding: '2px 8px', borderRadius: 4 }}>
              {d.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Capabilities */}
      {pkg.capabilities.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {pkg.capabilities.slice(0, 3).map((cap, i) => (
            <li key={i} style={{ color: '#aaa', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span>
              {cap}
            </li>
          ))}
        </ul>
      )}

      {/* Footer: stats + action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
        <div style={{ fontSize: 12, color: '#555' }}>
          {pkg.avg_rating > 0 && <span>★ {pkg.avg_rating.toFixed(1)} · </span>}
          {pkg.install_count} installs
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: pkg.price === 0 ? '#22c55e' : 'var(--hive-gold)', fontSize: 14, fontWeight: 700 }}>
            {pkg.price === 0 ? 'FREE' : `€${pkg.price}`}
          </span>
          {pkg.price === 0 ? (
            <button
              onClick={onInstall}
              disabled={installing || installed}
              style={{
                background: installed ? '#1a3a1a' : 'var(--hive-gold)',
                color: installed ? '#22c55e' : '#000',
                border: 'none',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: installed || installing ? 'default' : 'pointer',
                opacity: installing ? 0.7 : 1,
              }}
            >
              {installing ? '...' : installed ? 'Installed' : 'Install'}
            </button>
          ) : (
            <button
              onClick={onBuy}
              disabled={buying || installed}
              style={{
                background: installed ? '#1a3a1a' : 'linear-gradient(135deg, #f6c400, #ffd84a)',
                color: installed ? '#22c55e' : '#000',
                border: 'none',
                borderRadius: 6,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: installed || buying ? 'default' : 'pointer',
                opacity: buying ? 0.7 : 1,
              }}
            >
              {buying ? '...' : installed ? 'Installed' : 'Buy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: '#111', border: '1px solid #2a2a2a', color: '#ccc', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
};
