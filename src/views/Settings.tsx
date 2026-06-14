import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Icon } from '../components/ui/Icon';
import { BeeMark } from '../components/brand/BeeMark';
import type { IconKey } from '../lib/icons';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { ProfilePictureUploadSmall } from '../components/ProfilePictureUploadSmall';
import { NotificationSettings } from '../components/NotificationSettings';
import { WalletConnectModal } from '../components/WalletConnectModal';
import { ProfileSchema, formatZodError } from '../lib/schemas';
import {
  hasUserAiKey,
  saveUserAiKey,
  removeUserAiKey,
  getArtistGoals,
  upsertArtistGoals,
} from '../lib/api';
import { supabase } from '../lib/supabase';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import type { ArtistGoals } from '../lib/types';

const GENRE_OPTIONS = [
  'House',
  'Techno',
  'Deep House',
  'Tech House',
  'Progressive House',
  'Trance',
  'Drum & Bass',
  'Dubstep',
  'UK Garage',
  'Breaks',
  'Ambient',
  'Downtempo',
  'Minimal',
  'Electro',
  'Disco',
  'Funk / Soul',
  'Hip Hop',
  'Jazz',
  'World',
  'Open Format',
];

const EQUIPMENT_OPTIONS = [
  'Pioneer CDJ-2000NXS2',
  'Pioneer CDJ-3000',
  'Pioneer DJM-900NXS2',
  'Pioneer DJM-V10',
  'Traktor Kontrol S4',
  'Traktor Kontrol S2',
  'Rane One',
  'Rane Seventy',
  'Technics SL-1200',
  'Allen & Heath Xone:96',
  'Allen & Heath Xone:43',
  'Denon DJ SC6000',
  'Roland DJ-808',
  'Native Instruments Maschine',
  'Ableton Push',
  'Akai MPC',
];

const DAW_OPTIONS = [
  'Ableton Live',
  'Logic Pro',
  'FL Studio',
  'Traktor Pro',
  'Rekordbox',
  'Serato DJ Pro',
  'VirtualDJ',
  'Bitwig Studio',
  'Pro Tools',
  'Reason',
  'Mixxx',
];

const GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'get_booked', label: 'Get booked' },
  { value: 'collaborate', label: 'Collaborate' },
  { value: 'press', label: 'Press coverage' },
  { value: 'grant', label: 'Apply for grants' },
  { value: 'release', label: 'Release music' },
];

export function Settings() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    location: profile?.location || '',
    genres: profile?.genres || ([] as string[]),
    social_links: {
      ...(profile?.social_links || {}),
      ...(profile?.website && !(profile?.social_links || {})['website']
        ? { website: profile.website }
        : {}),
    } as Record<string, string>,
    dj_style: profile?.dj_style ?? '',
    dj_equipment: profile?.dj_equipment ?? ([] as string[]),
    dj_daw: profile?.dj_daw ?? ([] as string[]),
  });

  const [goals, setGoals] = useState<Partial<Omit<ArtistGoals, 'user_id' | 'updated_at'>>>({
    goals: [],
    skills: [],
    base_city: null,
    travel_radius_km: 50,
    booking_open: false,
  });
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsMsg, setGoalsMsg] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AI key state
  const [aiKeyInput, setAiKeyInput] = useState('');
  const [aiKeyStatus, setAiKeyStatus] = useState<'loading' | 'none' | 'saved'>('loading');
  const [aiKeySaving, setAiKeySaving] = useState(false);
  const [aiKeyMsg, setAiKeyMsg] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);

  // Web3 / wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(
    ((profile as unknown as Record<string, unknown>)?.wallet_address as string | null) ?? null
  );
  const [showNftInFeed, setShowNftInFeed] = useState<boolean>(
    ((profile as unknown as Record<string, unknown>)?.show_nft_in_feed as boolean) ?? false
  );
  const [showJourney, setShowJourney] = useState<boolean>(
    ((profile as unknown as Record<string, unknown>)?.show_journey as boolean) ?? false
  );
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletDisconnecting, setWalletDisconnecting] = useState(false);

  useEffect(() => {
    if (!user) return;
    hasUserAiKey(user.id).then(has => setAiKeyStatus(has ? 'saved' : 'none'));
    getArtistGoals(user.id)
      .then(data => {
        if (data)
          setGoals({
            goals: data.goals,
            skills: data.skills,
            base_city: data.base_city,
            travel_radius_km: data.travel_radius_km,
            booking_open: data.booking_open,
          });
      })
      .catch(() => undefined);
  }, [user]);

  const handleAvatarUploadComplete = () => {
    window.location.reload();
  };

  function toggleGenre(g: string) {
    setFormData(prev => ({
      ...prev,
      genres: prev.genres.includes(g) ? prev.genres.filter(x => x !== g) : [...prev.genres, g],
    }));
  }

  function toggleMulti(field: 'dj_equipment' | 'dj_daw', value: string) {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((x: string) => x !== value)
        : [...prev[field], value],
    }));
  }

  async function handleSaveGoals() {
    if (!user) return;
    setGoalsSaving(true);
    setGoalsMsg('');
    try {
      await upsertArtistGoals(user.id, goals);
      setGoalsMsg('Goals saved.');
    } catch {
      setGoalsMsg('Could not save goals.');
    } finally {
      setGoalsSaving(false);
      setTimeout(() => setGoalsMsg(''), 3000);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = ProfileSchema.safeParse(formData);
    if (!result.success) {
      setFormErrors(formatZodError(result.error));
      setError('');
      return;
    }
    setFormErrors({});
    setError('');
    setSaving(true);
    try {
      const socialLinks = { ...formData.social_links };
      const website = socialLinks.website || null;
      delete socialLinks.website;
      await updateProfile({
        display_name: result.data.display_name || null,
        bio: result.data.bio || null,
        location: result.data.location || null,
        genres: result.data.genres,
        social_links: socialLinks,
        website,
        dj_style: formData.dj_style || null,
        dj_equipment: formData.dj_equipment,
        dj_daw: formData.dj_daw,
      });
      if (profile) navigate(`/u/${profile.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAiKey() {
    if (!user || !aiKeyInput.trim()) return;
    if (!aiKeyInput.startsWith('sk-') || aiKeyInput.length < 30) {
      setAiKeyMsg('Key should start with sk- and be at least 30 characters.');
      return;
    }
    setAiKeySaving(true);
    setAiKeyMsg('');
    try {
      await saveUserAiKey(user.id, aiKeyInput.trim());
      setAiKeyStatus('saved');
      setAiKeyInput('');
      setAiKeyMsg('Key saved. AI features are now unlocked.');
    } catch {
      setAiKeyMsg('Could not save key. Try again.');
    } finally {
      setAiKeySaving(false);
    }
  }

  async function handleRemoveAiKey() {
    if (!user) return;
    setAiKeySaving(true);
    setAiKeyMsg('');
    try {
      await removeUserAiKey(user.id);
      setAiKeyStatus('none');
      setAiKeyMsg('Key removed.');
    } catch {
      setAiKeyMsg('Could not remove key.');
    } finally {
      setAiKeySaving(false);
    }
  }

  async function handleDisconnectWallet() {
    setWalletDisconnecting(true);
    try {
      const res = await fetch('/api/wallet/connect', { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect failed');
      setWalletAddress(null);
    } catch {
      // ignore
    } finally {
      setWalletDisconnecting(false);
    }
  }

  async function handleNftFeedToggle(enabled: boolean) {
    if (!user) return;
    setShowNftInFeed(enabled);
    await supabase.from('profiles').update({ show_nft_in_feed: enabled }).eq('id', user.id);
  }

  async function handleShowJourneyToggle(enabled: boolean) {
    if (!user) return;
    setShowJourney(enabled);
    await supabase.from('profiles').update({ show_journey: enabled }).eq('id', user.id);
  }

  return (
    <div
      className="container"
      style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px 96px' }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text.primary, marginBottom: 24 }}>
        Edit profile
      </h1>

      {/* Profile Picture */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h2
          style={{ fontSize: 16, fontWeight: 600, color: colors.text.secondary, marginBottom: 16 }}
        >
          Profile Picture
        </h2>
        <ProfilePictureUploadSmall
          profile={profile}
          currentUserId={profile?.id || ''}
          onUploadComplete={handleAvatarUploadComplete}
        />
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => navigate('/studio/avatar')}
          style={{ marginTop: space[5] }}
        >
          Design with Cosmic-Funk Studio
        </Button>
      </div>

      <div
        id="notifications"
        style={{
          marginBottom: space[10],
          borderTop: `1px solid ${colors.border}`,
          paddingTop: space[8],
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: colors.text.secondary,
            marginBottom: space[3],
          }}
        >
          Notifications
        </h2>
        <p style={{ color: colors.text.dim, fontSize: fontSize.sm, marginBottom: space[6] }}>
          Choose what reaches this browser. System pushes stay quiet while MixHive is focused.
        </p>
        <NotificationSettings />
      </div>

      {error && (
        <div
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Display name"
          value={formData.display_name}
          onChange={e => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
          error={formErrors.display_name}
          placeholder="Enter display name"
        />
        <Textarea
          label="Bio"
          value={formData.bio}
          onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          rows={3}
          placeholder="Tell us about yourself..."
        />
        <Input
          label="Location"
          value={formData.location}
          onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="City, Country"
        />

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            Genres
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                type="button"
                aria-pressed={formData.genres.includes(g)}
                onClick={() => toggleGenre(g)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: formData.genres.includes(g) ? colors.accent : colors.surfaceHover,
                  color: formData.genres.includes(g) ? colors.bg : colors.text.dim,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: formData.genres.includes(g) ? 600 : 400,
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <Input
          label="Performance style"
          value={formData.dj_style}
          onChange={e => setFormData(prev => ({ ...prev, dj_style: e.target.value }))}
          placeholder="e.g. open format b2b, peak-time techno, vinyl-only..."
        />

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            Equipment
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EQUIPMENT_OPTIONS.map(item => (
              <button
                key={item}
                type="button"
                aria-pressed={formData.dj_equipment.includes(item)}
                onClick={() => toggleMulti('dj_equipment', item)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: formData.dj_equipment.includes(item)
                    ? colors.accent
                    : colors.surfaceHover,
                  color: formData.dj_equipment.includes(item) ? colors.bg : colors.text.dim,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: formData.dj_equipment.includes(item) ? 600 : 400,
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            DAW / Software
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DAW_OPTIONS.map(item => (
              <button
                key={item}
                type="button"
                aria-pressed={formData.dj_daw.includes(item)}
                onClick={() => toggleMulti('dj_daw', item)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: formData.dj_daw.includes(item) ? colors.accent : colors.surfaceHover,
                  color: formData.dj_daw.includes(item) ? colors.bg : colors.text.dim,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: formData.dj_daw.includes(item) ? 600 : 400,
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            Social Links
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            {['twitter', 'instagram', 'soundcloud', 'youtube', 'spotify', 'website'].map(
              platform => (
                <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>
                    <Icon name={getPlatformIcon(platform)} size={16} color="currentColor" />
                  </span>
                  <Input
                    type="text"
                    value={formData.social_links[platform] || ''}
                    onChange={e => {
                      const value = e.target.value.trim();
                      const links = { ...formData.social_links };
                      if (value) links[platform] = value;
                      else delete links[platform];
                      setFormData(prev => ({ ...prev, social_links: links }));
                    }}
                    placeholder={`${platform.charAt(0).toUpperCase() + platform.slice(1)} URL`}
                    style={{ flex: 1 }}
                  />
                </div>
              )
            )}
          </div>
          <p style={{ color: colors.text.faint, fontSize: 11, marginTop: 4 }}>
            Add links to your social profiles or website
          </p>
        </fieldset>

        <Button type="submit" disabled={saving} className="w-full" style={{ marginTop: 8 }}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
      </form>

      {/* ── Artist Goals ─────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: space[11],
          borderTop: `1px solid ${colors.border}`,
          paddingTop: space[10],
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            marginBottom: space[3],
          }}
        >
          Artist Goals
        </h2>
        <p
          style={{
            color: colors.text.dim,
            fontSize: fontSize.sm,
            marginBottom: space[7],
            lineHeight: 1.5,
          }}
        >
          Tell MIXHIVE what you're aiming for — the opportunity graph uses this to score matches.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
              Goals
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {GOAL_OPTIONS.map(opt => {
                const active = (goals.goals || []).includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setGoals(prev => ({
                        ...prev,
                        goals: active
                          ? (prev.goals || []).filter(g => g !== opt.value)
                          : [...(prev.goals || []), opt.value],
                      }))
                    }
                    style={{
                      padding: '6px 12px',
                      borderRadius: 16,
                      border: 'none',
                      background: active ? colors.accent : colors.surfaceHover,
                      color: active ? colors.bg : colors.text.dim,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Input
            label="Base city"
            value={goals.base_city || ''}
            onChange={e => setGoals(prev => ({ ...prev, base_city: e.target.value || null }))}
            placeholder="e.g. Brussels"
          />

          <div>
            <label
              style={{ color: colors.text.muted, fontSize: 13, display: 'block', marginBottom: 8 }}
            >
              Travel radius: {goals.travel_radius_km ?? 50} km
            </label>
            <input
              type="range"
              min={0}
              max={500}
              step={25}
              value={goals.travel_radius_km ?? 50}
              onChange={e =>
                setGoals(prev => ({ ...prev, travel_radius_km: Number(e.target.value) }))
              }
              style={{ width: '100%', accentColor: colors.accent }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={goals.booking_open ?? false}
              onChange={e => setGoals(prev => ({ ...prev, booking_open: e.target.checked }))}
              style={{ accentColor: colors.accent, width: 16, height: 16 }}
            />
            <span style={{ color: colors.text.primary, fontSize: fontSize.sm }}>
              Open for bookings
            </span>
          </label>

          <Button
            type="button"
            onClick={handleSaveGoals}
            disabled={goalsSaving}
            loading={goalsSaving}
            style={{ alignSelf: 'flex-start' }}
          >
            {goalsSaving ? 'Saving…' : 'Save goals'}
          </Button>
          {goalsMsg && (
            <p
              style={{
                margin: 0,
                fontSize: fontSize.xs,
                color: goalsMsg.includes('saved') ? colors.success : colors.danger,
              }}
            >
              {goalsMsg}
            </p>
          )}
        </div>
      </div>

      {/* ── AI & Creativity ─────────────────────────────────────────────────── */}
      <div
        id="ai"
        style={{
          marginTop: space[11],
          borderTop: `1px solid ${colors.border}`,
          paddingTop: space[10],
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            marginBottom: space[3],
          }}
        >
          AI &amp; Creativity
        </h2>
        <p
          style={{
            color: colors.text.dim,
            fontSize: fontSize.sm,
            marginBottom: space[5],
            lineHeight: 1.5,
          }}
        >
          MixHive AI features (avatar generation, bio writing) use your own OpenAI key — it's never
          shared and runs entirely server-side.
          {profile?.is_admin && (
            <span style={{ color: colors.accent }}>
              {' '}
              You have admin access — you can use AI without a personal key.
            </span>
          )}
          {profile?.is_pro && !profile.is_admin && (
            <span style={{ color: colors.success }}>
              {' '}
              ✓ MixHive Pro — built-in AI art generation is active.
            </span>
          )}
        </p>

        {aiKeyStatus === 'none' && !profile?.is_admin && !profile?.is_pro && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: space[5],
              padding: `${space[5]}px ${space[6]}px`,
              marginBottom: space[7],
              borderRadius: radius.md,
              background: 'rgba(255,216,74,0.04)',
              border: `1px solid ${colors.accentMuted}`,
            }}
          >
            <span style={{ flexShrink: 0, display: 'inline-flex', color: colors.accent }}>
              <Icon name="settings" size={15} />
            </span>
            <p
              style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.dim, lineHeight: 1.5 }}
            >
              Without a key, AI-powered features (avatar generation, bio writing, profile coach) are
              unavailable. All AI suggestions on MixHive are{' '}
              <strong style={{ color: colors.text.muted }}>assistive only</strong> — nothing changes
              on your profile until you review and apply each suggestion.
            </p>
          </div>
        )}

        {/* Pro badge */}
        {profile?.is_pro && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[4],
              background: `linear-gradient(135deg, ${colors.surface}, ${colors.accentFaint})`,
              border: `1px solid ${colors.accentMuted}`,
              borderRadius: radius.lg,
              padding: `${space[5]}px ${space[7]}px`,
              marginBottom: space[7],
            }}
          >
            <span style={{ display: 'inline-flex' }}>
              <BeeMark size={22} color="var(--hive-gold, #f6c400)" />
            </span>
            <div>
              <div
                style={{
                  fontWeight: fontWeight.bold,
                  fontSize: fontSize.base,
                  color: colors.accent,
                }}
              >
                MixHive Pro — AI Art Active
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                Stable Diffusion XL — no key needed
              </div>
            </div>
          </div>
        )}

        {/* OpenAI key management */}
        {!profile?.is_admin && (
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: `${space[7]}px`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: space[5],
              }}
            >
              <span
                style={{
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.base,
                  color: colors.text.primary,
                }}
              >
                OpenAI API key
              </span>
              {aiKeyStatus === 'loading' && (
                <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>checking…</span>
              )}
              {aiKeyStatus === 'saved' && (
                <span
                  style={{
                    fontSize: fontSize.xs,
                    color: colors.success,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  ● Connected
                </span>
              )}
              {aiKeyStatus === 'none' && (
                <span style={{ fontSize: fontSize.xs, color: colors.text.faint }}>
                  Not connected
                </span>
              )}
            </div>

            {aiKeyStatus === 'saved' ? (
              <div style={{ display: 'flex', gap: space[4] }}>
                <div
                  style={{
                    flex: 1,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: `${space[4]}px ${space[5]}px`,
                    fontSize: fontSize.sm,
                    color: colors.text.muted,
                    fontFamily: 'monospace',
                  }}
                >
                  sk-••••••••••••••••••••••
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleRemoveAiKey}
                  disabled={aiKeySaving}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
                <div style={{ position: 'relative' }}>
                  <input
                    id="ai-key-input"
                    type={showAiKey ? 'text' : 'password'}
                    value={aiKeyInput}
                    onChange={e => setAiKeyInput(e.target.value)}
                    placeholder="sk-proj-..."
                    autoComplete="off"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: `${space[4]}px ${space[12]}px ${space[4]}px ${space[5]}px`,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      color: colors.text.primary,
                      fontSize: fontSize.sm,
                      fontFamily: 'monospace',
                    }}
                  />
                  <IconButton
                    label={showAiKey ? 'Hide key' : 'Show key'}
                    size={28}
                    onClick={() => setShowAiKey(v => !v)}
                    style={{
                      position: 'absolute',
                      right: space[4],
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {showAiKey ? '🙈' : '👁'}
                  </IconButton>
                </div>
                <Button
                  fullWidth
                  onClick={handleSaveAiKey}
                  disabled={aiKeySaving || !aiKeyInput.trim()}
                  loading={aiKeySaving}
                >
                  {aiKeySaving ? 'Saving…' : 'Save key'}
                </Button>
                <p
                  style={{
                    margin: 0,
                    fontSize: fontSize.xs,
                    color: colors.text.dim,
                    lineHeight: 1.5,
                  }}
                >
                  Get your key at{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: colors.accent }}
                  >
                    platform.openai.com/api-keys
                  </a>{' '}
                  → Create new secret key. Usage is billed by OpenAI.
                </p>
              </div>
            )}

            {aiKeyMsg && (
              <p
                style={{
                  margin: `${space[4]}px 0 0`,
                  fontSize: fontSize.xs,
                  color:
                    aiKeyMsg.includes('saved') || aiKeyMsg.includes('unlocked')
                      ? colors.success
                      : colors.danger,
                }}
              >
                {aiKeyMsg}
              </p>
            )}
          </div>
        )}

        {/* Upgrade CTA for non-pro users */}
        {!profile?.is_pro && !profile?.is_admin && (
          <div
            style={{
              marginTop: space[7],
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: `${space[7]}px`,
              display: 'flex',
              alignItems: 'center',
              gap: space[7],
            }}
          >
            <span style={{ display: 'inline-flex', flexShrink: 0 }}>
              <BeeMark size={28} color="var(--hive-gold, #f6c400)" />
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.base,
                  color: colors.text.primary,
                  marginBottom: space[2],
                }}
              >
                MixHive Pro — Built-in AI art
              </div>
              <div style={{ fontSize: fontSize.xs, color: colors.text.muted, lineHeight: 1.5 }}>
                No key needed. Generate Stable Diffusion XL avatars directly on MixHive, plus
                priority support and more storage.
              </div>
            </div>
            <a
              href="mailto:admin@mixhive.app?subject=MixHive Pro"
              style={{
                flexShrink: 0,
                padding: `${space[4]}px ${space[7]}px`,
                background: colors.accent,
                color: colors.bg,
                borderRadius: radius.pill,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.sm,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Get Pro
            </a>
          </div>
        )}
      </div>

      {/* ── Hive Story ───────────────────────────────────────────────────────── */}
      <div
        id="hive-story"
        style={{
          marginTop: space[11],
          borderTop: `1px solid ${colors.border}`,
          paddingTop: space[10],
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: colors.text.primary, marginBottom: 16 }}>
          Hive Story
        </h2>
        <p style={{ fontSize: 13, color: colors.text.muted, marginBottom: 16 }}>
          Share your journey — your milestones, collabs, and sound evolution — on your profile.
        </p>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[4],
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={showJourney}
            onChange={e => handleShowJourneyToggle(e.target.checked)}
            style={{ accentColor: colors.accent, width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, color: colors.text.primary }}>Share my journey</span>
        </label>
      </div>

      {/* ── Web3 & NFTs ──────────────────────────────────────────────────────── */}
      <div
        id="web3"
        style={{
          marginTop: space[11],
          borderTop: `1px solid ${colors.border}`,
          paddingTop: space[10],
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            marginBottom: space[3],
          }}
        >
          Web3 &amp; NFTs
        </h2>
        <p
          style={{
            color: colors.text.dim,
            fontSize: fontSize.sm,
            marginBottom: space[7],
            lineHeight: 1.5,
          }}
        >
          Completely optional. Connect a wallet to verify NFT passes you've received and display
          your on-chain music activity. Core features always work without a wallet.
        </p>

        {walletAddress ? (
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              padding: `${space[6]}px ${space[7]}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[4],
              flexWrap: 'wrap',
              marginBottom: space[6],
            }}
          >
            <div>
              <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginBottom: 4 }}>
                Connected wallet
              </div>
              <code
                style={{
                  fontSize: fontSize.sm,
                  color: colors.text.primary,
                  fontFamily: 'monospace',
                }}
              >
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </code>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDisconnectWallet}
              disabled={walletDisconnecting}
              loading={walletDisconnecting}
            >
              {walletDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => setWalletModalOpen(true)}
            style={{ marginBottom: space[6] }}
          >
            Connect Wallet
          </Button>
        )}

        {walletAddress && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[4],
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showNftInFeed}
              onChange={e => handleNftFeedToggle(e.target.checked)}
              style={{ accentColor: colors.accent, width: 16, height: 16 }}
            />
            <span style={{ fontSize: fontSize.sm, color: colors.text.primary }}>
              Show NFT activity from artists I follow in my feed
            </span>
          </label>
        )}
      </div>

      <div style={{ marginTop: space[8] }}>
        <h2
          style={{
            fontSize: fontSize.lg,
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: space[4],
          }}
        >
          Privacy &amp; Data
        </h2>
        <p style={{ fontSize: fontSize.sm, color: colors.text.dim, marginBottom: space[4] }}>
          Export a copy of your data, or request account deletion (processed within 30 days). See
          our{' '}
          <a href="/privacy" style={{ color: colors.accent }}>
            Privacy Policy
          </a>
          .
        </p>
        <div style={{ display: 'flex', gap: space[4], flexWrap: 'wrap' }}>
          <Button
            onClick={async () => {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session) return;
              const res = await fetch('/api/account/export', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!res.ok) return;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'mixhive-data.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            variant="secondary"
            size="sm"
          >
            Download my data
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              if (
                !window.confirm(
                  'Request account deletion? Your account and data will be removed within 30 days, and you will be signed out.'
                )
              )
                return;
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session) return;
              await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({}),
              });
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
          >
            Delete my account
          </Button>
        </div>
      </div>

      <WalletConnectModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        onConnected={addr => {
          setWalletAddress(addr);
          setWalletModalOpen(false);
        }}
      />
    </div>
  );
}

function getPlatformIcon(platform: string): IconKey {
  const icons: Record<string, IconKey> = {
    soundcloud: 'music',
    spotify: 'headphones',
    youtube: 'video',
    instagram: 'camera',
    website: 'link',
    twitter: 'external',
  };
  return icons[platform] || 'link';
}
