import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  'mixer','controller','turntable','cdj','monitor','headphones',
  'synthesizer','sampler','interface','cable_accessory','other',
];
const CONDITIONS = [
  { value: 'new', label: 'New — never used, in original packaging' },
  { value: 'like_new', label: 'Like New — used briefly, no visible wear' },
  { value: 'used_good', label: 'Used – Good — normal wear, fully functional' },
  { value: 'used_fair', label: 'Used – Fair — visible wear, still works' },
  { value: 'for_parts', label: 'For Parts — not fully functional' },
];

type Step = 1 | 2 | 3;

export function NewGearListing() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    category: '',
    brand: '',
    model: '',
    condition: '',
    title: '',
    description: '',
    price: '',
    currency: 'EUR',
    location_city: '',
    location_country: '',
    local_pickup: true,
    domestic_shipping: false,
    international_shipping: false,
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [payoutsEnabled, setPayoutsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch('/api/stripe/connect/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPayoutsEnabled(Boolean(data.payouts_enabled));
        }
      } catch {
        // status check is best-effort; publish gate still enforces server-side
      }
    })();
  }, []);

  const update = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Sign in required'); setUploading(false); return; }

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const path = `gear-photos/${session.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('user-uploads').upload(path, file);
      if (uploadErr) { setError(uploadErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from('user-uploads').getPublicUrl(path);
      setPhotos(prev => [...prev, publicUrl]);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');

      const res = await fetch('/api/marketplace/gear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: form.title || `${form.brand} ${form.model}`.trim() || `${form.category} for sale`,
          description: form.description,
          category: form.category,
          brand: form.brand || undefined,
          model: form.model || undefined,
          condition: form.condition,
          price: parseFloat(form.price),
          currency: form.currency,
          location_city: form.location_city || undefined,
          location_country: form.location_country || undefined,
          photos,
          shipping_options: {
            local_pickup: form.local_pickup,
            domestic_shipping: form.domestic_shipping,
            international_shipping: form.international_shipping,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create listing');
      navigate(`/marketplace/gear/${data.listing.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontSize: 24, fontFamily: 'var(--font-display)', color: 'var(--hive-gold)', marginBottom: 4 }}>
        List Your Gear
      </h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>
        Sell to the community — DJ gear, studio equipment, and more
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {([1, 2, 3] as Step[]).map(s => (
          <div key={s} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: step >= s ? 'var(--hive-gold)' : '#222',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {payoutsEnabled === false && (
        <div style={{ background: '#1a1400', border: '1px solid #f0c04044', color: '#e8d5a0', padding: 14, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          Connect a payout account to sell gear —{' '}
          <Link to="/earnings" style={{ color: 'var(--hive-gold)', fontWeight: 700 }}>
            Set up payouts
          </Link>
        </div>
      )}

      {error && (
        <div style={{ background: '#1a0000', border: '1px solid #ef444466', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Step 1: Category & Item */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={labelStyle}>
            Category *
            <select value={form.category} onChange={e => update('category', e.target.value)} style={inputStyle}>
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </label>
          <div className="p15-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Brand
              <input value={form.brand} onChange={e => update('brand', e.target.value)} placeholder="Pioneer DJ" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Model
              <input value={form.model} onChange={e => update('model', e.target.value)} placeholder="CDJ-2000NXS2" style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Condition *
            <select value={form.condition} onChange={e => update('condition', e.target.value)} style={inputStyle}>
              <option value="">Select condition</option>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              onClick={() => { if (!form.category || !form.condition) { setError('Category and condition are required'); return; } setError(''); setStep(2); }}
              style={primaryBtnStyle}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Description & Photos */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={labelStyle}>
            Listing title
            <input
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder={`${form.brand || form.category} ${form.model || ''}`.trim() || 'Short, clear title'}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Description
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Describe the item condition, included accessories, reason for selling..."
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>

          {/* Photo upload */}
          <div>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Photos * (min 1)</p>
            <div
              style={{ border: '2px dashed #333', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', color: '#555' }}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Uploading...' : 'Click to upload photos'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => e.target.files && handleFileUpload(e.target.files)}
              />
            </div>
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {photos.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setStep(1)} style={secondaryBtnStyle}>← Back</button>
            <button
              onClick={() => { if (photos.length === 0) { setError('At least one photo required'); return; } setError(''); setStep(3); }}
              style={primaryBtnStyle}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Price & Location */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="p15-form-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Price *
              <input
                type="number"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="0"
                min="0"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Currency
              <select value={form.currency} onChange={e => update('currency', e.target.value)} style={inputStyle}>
                <option>EUR</option>
                <option>GBP</option>
                <option>USD</option>
              </select>
            </label>
          </div>
          <div className="p15-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              City
              <input value={form.location_city} onChange={e => update('location_city', e.target.value)} placeholder="Brussels" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Country (ISO)
              <input value={form.location_country} onChange={e => update('location_country', e.target.value)} placeholder="BE" maxLength={2} style={inputStyle} />
            </label>
          </div>

          <div>
            <p style={{ color: '#aaa', fontSize: 13, marginBottom: 8 }}>Shipping options</p>
            {[
              { key: 'local_pickup', label: 'Local pickup' },
              { key: 'domestic_shipping', label: 'Domestic shipping' },
              { key: 'international_shipping', label: 'International shipping' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', fontSize: 14, marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form[key as keyof typeof form] as boolean}
                  onChange={e => update(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setStep(2)} style={secondaryBtnStyle}>← Back</button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.price}
              style={{ ...primaryBtnStyle, opacity: submitting || !form.price ? 0.5 : 1 }}
            >
              {submitting ? 'Publishing...' : 'Publish Listing'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, color: '#aaa', fontSize: 13,
};
const inputStyle: React.CSSProperties = {
  background: '#111', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, outline: 'none',
};
const primaryBtnStyle: React.CSSProperties = {
  background: 'var(--hive-gold)', color: '#000', border: 'none', borderRadius: 8,
  padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const secondaryBtnStyle: React.CSSProperties = {
  background: 'transparent', color: '#aaa', border: '1px solid #333', borderRadius: 8,
  padding: '10px 20px', fontSize: 14, cursor: 'pointer',
};
