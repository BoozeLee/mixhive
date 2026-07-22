import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { colors, withAlpha } from '../styles/tokens';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';

const CATEGORIES = [
  'mixer',
  'controller',
  'turntable',
  'cdj',
  'monitor',
  'headphones',
  'synthesizer',
  'sampler',
  'interface',
  'cable_accessory',
  'other',
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
  const t = useTranslations('gear');
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError(t('signInRequired'));
      setUploading(false);
      return;
    }

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const path = `gear-photos/${session.user.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('user-uploads').upload(path, file);
      if (uploadErr) {
        setError(uploadErr.message);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('user-uploads').getPublicUrl(path);
      setPhotos(prev => [...prev, publicUrl]);
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
      setError(e instanceof Error ? e.message : t('failedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontSize: 24,
          fontFamily: 'var(--font-display)',
          color: 'var(--hive-gold)',
          marginBottom: 4,
        }}
      >
        {t('listYourGear')}
      </h1>
      <p style={{ color: colors.text.faint, fontSize: 14, marginBottom: 28 }}>
        {t('sellToCommunity')}
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {([1, 2, 3] as Step[]).map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              background: step >= s ? 'var(--hive-gold)' : colors.borderSubtle,
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      {payoutsEnabled === false && (
        <div
          style={{
            background: colors.surfaceMuted,
            border: `1px solid ${colors.accentMuted}`,
            color: colors.text.secondary,
            padding: 14,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          Connect a payout account to sell gear —{' '}
          <Link to="/earnings" style={{ color: 'var(--hive-gold)', fontWeight: 700 }}>
            {t('setupPayouts')}
          </Link>
        </div>
      )}

      {error && (
        <div
          style={{
            background: colors.dangerBgDeep,
            border: `1px solid ${withAlpha(colors.dangerStrong, 0.4)}`,
            color: colors.dangerStrong,
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Category & Item */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label={t('categoryLabel')}
            placeholder={t('selectCategory')}
            value={form.category}
            onChange={e => update('category', e.target.value)}
            options={CATEGORIES.map(c => ({ value: c, label: c.replace('_', ' ') }))}
          />
          <div
            className="p15-form-2col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Input
              label={t('brand')}
              value={form.brand}
              onChange={e => update('brand', e.target.value)}
              placeholder={t('brandPlaceholder')}
            />
            <Input
              label={t('model')}
              value={form.model}
              onChange={e => update('model', e.target.value)}
              placeholder={t('modelPlaceholder')}
            />
          </div>
          <Select
            label={t('conditionLabel')}
            placeholder={t('selectCondition')}
            value={form.condition}
            onChange={e => update('condition', e.target.value)}
            options={CONDITIONS}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button
              onClick={() => {
                if (!form.category || !form.condition) {
                  setError(t('categoryAndConditionRequired'));
                  return;
                }
                setError('');
                setStep(2);
              }}
            >
              {t('continue')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Description & Photos */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label={t('listingTitle')}
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder={
              `${form.brand || form.category} ${form.model || ''}`.trim() || 'Short, clear title'
            }
          />
          <Textarea
            label={t('description')}
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={5}
            style={{ resize: 'vertical' }}
          />

          {/* Photo upload */}
          <div>
            <p style={{ color: colors.text.dimmed, fontSize: 13, marginBottom: 8 }}>
              {t('photosMin1')}
            </p>
            <div
              role="button"
              tabIndex={0}
              style={{
                border: `2px dashed ${colors.borderStrong}`,
                borderRadius: 10,
                padding: 24,
                textAlign: 'center',
                cursor: 'pointer',
                color: colors.text.faintest,
              }}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
            >
              {uploading ? t('uploading') : t('clickToUploadPhotos')}
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
                    <img
                      src={url}
                      alt=""
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                    />
                    <button
                      type="button"
                      aria-label={t('removePhoto')}
                      onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: colors.dangerStrong,
                        border: 'none',
                        color: colors.white,
                        fontSize: 12,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setStep(1)}>
              {t('back')}
            </Button>
            <Button
              onClick={() => {
                if (photos.length === 0) {
                  setError(t('atLeastOnePhotoRequired'));
                  return;
                }
                setError('');
                setStep(3);
              }}
            >
              {t('continue')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Price & Location */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            className="p15-form-2col"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}
          >
            <Input
              label={t('priceLabel')}
              type="number"
              value={form.price}
              onChange={e => update('price', e.target.value)}
              placeholder="0"
              min="0"
            />
            <Select
              label={t('currency')}
              value={form.currency}
              onChange={e => update('currency', e.target.value)}
            >
              <option>EUR</option>
              <option>GBP</option>
              <option>USD</option>
            </Select>
          </div>
          <div
            className="p15-form-2col"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <Input
              label={t('city')}
              value={form.location_city}
              onChange={e => update('location_city', e.target.value)}
              placeholder={t('cityPlaceholder')}
            />
            <Input
              label={t('countryIso')}
              value={form.location_country}
              onChange={e => update('location_country', e.target.value)}
              placeholder={t('countryPlaceholder')}
              maxLength={2}
            />
          </div>

          <div>
            <p style={{ color: colors.text.dimmed, fontSize: 13, marginBottom: 8 }}>
              {t('shippingOptions')}
            </p>
            {[
              { key: 'local_pickup', label: 'Local pickup' },
              { key: 'domestic_shipping', label: 'Domestic shipping' },
              { key: 'international_shipping', label: 'International shipping' },
            ].map(({ key, label }) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: colors.text.secondary,
                  fontSize: 14,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
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
            <Button variant="secondary" onClick={() => setStep(2)}>
              {t('back')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.price}
              loading={submitting}
            >
              {submitting ? t('publishing') : t('publishListing')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
