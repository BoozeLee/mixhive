import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Button } from '../components/ui/Button';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AVATAR_BUCKET, hasUserAiKey } from '../lib/api';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import { BuzzToast } from '../components/hive/BuzzToast';
import { callProfileCoach } from '../components/ProfileCoachPanel';
import type { AISuggestion } from '../lib/types';
import { OnboardingProfileSchema } from '../lib/schemas';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const GENRES = [
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
  'Pioneer CDJ-3000',
  'Pioneer CDJ-2000NXS2',
  'Technics SL-1200',
  'Pioneer XDJ-RX3',
  'Allen & Heath Xone:96',
  'Pioneer DJM-900NXS2',
  'Rane MP2015',
  'Traktor Kontrol S4',
  'Serato DJ Pro Controller',
  'Native Instruments Maschine',
  'Roland TR-808',
  'Ableton Push 3',
  'Akai MPC One',
  'iPad Pro + Djay',
];

const DAW_OPTIONS = [
  'Ableton Live',
  'FL Studio',
  'Logic Pro',
  'Bitwig Studio',
  'Reason Studios',
  'Pro Tools',
  'Reaper',
  'GarageBand',
  'Traktor Pro',
  'Serato DJ Pro',
  'Rekordbox',
  'Virtual DJ',
];

const AVATAR_STYLES = [
  {
    key: 'cyber-hive',
    label: 'Cyber DJ',
    icon: 'mythic' as const,
    desc: 'Dark honeycomb, gold glow',
  },
  { key: 'abstract', label: 'Sound Waves', icon: 'wave' as const, desc: 'Abstract frequency art' },
  { key: 'neon', label: 'Neon Rave', icon: 'zap' as const, desc: 'Cyberpunk neon lights' },
  {
    key: 'minimal',
    label: 'Minimal Dark',
    icon: 'square' as const,
    desc: 'Clean geometric minimal',
  },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetupForm {
  username: string;
  displayName: string;
  location: string;
  avatarUrl: string;
  bio: string;
  genres: string[];
  equipment: string[];
  daw: string[];
  djStyle: string;
  influences: string;
  website: string;
  github: string;
  soundcloud: string;
  spotify: string;
  instagram: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileSetup() {
  const t = useTranslations('profileSetup');
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const finishingRef = useRef(false);
  const formInitializedRef = useRef(false);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: 'info' | 'success' | 'danger';
  }>({ open: false, message: '', tone: 'info' });

  // Avatar generation state
  const [avatarStyle, setAvatarStyle] =
    useState<(typeof AVATAR_STYLES)[number]['key']>('cyber-hive');
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [generatingAvatar, setGeneratingAvatar] = useState(false);
  const [generatedAvatars, setGeneratedAvatars] = useState<string[]>([]);
  const [selectedGenerated, setSelectedGenerated] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useState<'upload' | 'generate'>('generate');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI key / pro status
  const [aiKeyReady, setAiKeyReady] = useState<'loading' | 'none' | 'ready'>('loading');

  useEffect(() => {
    if (!user) return;
    const isAdmin = Boolean(profile?.is_admin);
    const isPro = Boolean(profile?.is_pro);
    if (isAdmin || isPro) {
      setAiKeyReady('ready');
      return;
    }
    hasUserAiKey(user.id).then(has => setAiKeyReady(has ? 'ready' : 'none'));
  }, [user, profile?.is_admin, profile?.is_pro]);

  // Bio generation state
  const [generatingBio, setGeneratingBio] = useState(false);

  // Profile coach nudge state (step 5)
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachResult, setCoachResult] = useState<AISuggestion | null>(null);
  const [coachNoKey, setCoachNoKey] = useState(false);

  const [form, setForm] = useState<SetupForm>({
    username: profile?.username || '',
    displayName: profile?.display_name || '',
    location: profile?.location || '',
    avatarUrl: profile?.avatar_url || '',
    bio: profile?.bio || '',
    genres: profile?.genres || [],
    equipment: profile?.dj_equipment || [],
    daw: profile?.dj_daw || [],
    djStyle: profile?.dj_style || '',
    influences: '',
    website: profile?.website || '',
    github: (profile?.social_links as Record<string, string>)?.github || '',
    soundcloud: (profile?.social_links as Record<string, string>)?.soundcloud || '',
    spotify: (profile?.social_links as Record<string, string>)?.spotify || '',
    instagram: (profile?.social_links as Record<string, string>)?.instagram || '',
  });

  useEffect(() => {
    if (!profile || finishingRef.current) return;
    if (profile.onboarding_complete) {
      navigate('/feed', { replace: true });
      return;
    }
    // Only sync form from profile once on first load — prevents auth refreshes
    // from wiping fields the user has already typed.
    if (formInitializedRef.current) return;
    formInitializedRef.current = true;
    setForm(current => ({
      ...current,
      username: profile.username || current.username,
      displayName: profile.display_name || current.displayName,
      location: profile.location || current.location,
      avatarUrl: profile.avatar_url || current.avatarUrl,
      bio: profile.bio || current.bio,
      genres: profile.genres?.length ? profile.genres : current.genres,
      equipment: profile.dj_equipment?.length ? profile.dj_equipment : current.equipment,
      daw: profile.dj_daw?.length ? profile.dj_daw : current.daw,
      djStyle: profile.dj_style || current.djStyle,
      website: profile.website || current.website,
      github: profile.social_links?.github || current.github,
      soundcloud: profile.social_links?.soundcloud || current.soundcloud,
      spotify: profile.social_links?.spotify || current.spotify,
      instagram: profile.social_links?.instagram || current.instagram,
    }));
  }, [profile, navigate]);

  function setField<K extends keyof SetupForm>(k: K, v: SetupForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function toggleArray(field: 'genres' | 'equipment' | 'daw', value: string) {
    setForm(prev => {
      const arr = prev[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value],
      };
    });
  }

  async function getAiRequestHeaders(): Promise<HeadersInit | null> {
    if (!isSupabaseConfigured) {
      setToast({
        open: true,
        message: 'Supabase is not configured for AI requests.',
        tone: 'danger',
      });
      return null;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setToast({ open: true, message: 'Sign in again to use AI generation.', tone: 'danger' });
      return null;
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  // ── Step 1: Identity ──

  async function checkUsername(value: string) {
    const clean = value.trim().toLowerCase();
    if (!clean || !/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameError(
        clean.length < 3
          ? 'At least 3 characters'
          : clean.length > 30
            ? 'Max 30 characters'
            : 'Letters, numbers, underscores only'
      );
      return;
    }
    if (clean === profile?.username) {
      setUsernameError('');
      return;
    }
    setUsernameChecking(true);
    setUsernameError('');
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', clean)
      .maybeSingle();
    setUsernameChecking(false);
    if (data) setUsernameError('Username taken');
  }

  // ── Step 2: Avatar generation ──

  async function generateAvatars() {
    if (genCount >= 3) {
      setToast({ open: true, message: 'Max 3 generation rounds reached', tone: 'info' });
      return;
    }
    setGeneratingAvatar(true);
    setGeneratedAvatars([]);
    setSelectedGenerated(null);
    const headers = await getAiRequestHeaders();
    if (!headers) {
      setGeneratingAvatar(false);
      return;
    }
    setGenCount(c => c + 1);
    const results: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch('/api/ai/generate-avatar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ style: avatarStyle, prompt: avatarPrompt }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        if (url) results.push(url);
      }
      setGeneratedAvatars([...results]); // progressive reveal
    }
    setGeneratingAvatar(false);
    if (results.length === 0) {
      setToast({
        open: true,
        message: 'Generation failed. Add your AI key in Settings or try again.',
        tone: 'danger',
      });
    }
  }

  async function uploadGeneratedAvatar(url: string) {
    if (!user || !isSupabaseConfigured) return;
    setAvatarUploading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const filename = `${user.id}/avatar_ai_${crypto.randomUUID()}.png`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filename, blob, { contentType: 'image/png', upsert: true });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename);
      setField('avatarUrl', publicUrl);
      setSelectedGenerated(url);
      setToast({ open: true, message: 'Avatar saved!', tone: 'success' });
    } catch {
      setToast({ open: true, message: 'Could not save avatar', tone: 'danger' });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !isSupabaseConfigured) return;
    if (!file.type.startsWith('image/')) {
      setToast({ open: true, message: 'Image files only', tone: 'danger' });
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `${user.id}/avatar_${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filename, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename);
      setField('avatarUrl', publicUrl);
      setToast({ open: true, message: 'Avatar uploaded!', tone: 'success' });
    } catch {
      setToast({ open: true, message: 'Upload failed', tone: 'danger' });
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Step 3: GPT Bio ──

  async function generateBio() {
    setGeneratingBio(true);
    try {
      const headers = await getAiRequestHeaders();
      if (!headers) return;
      const res = await fetch('/api/ai/generate-bio', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          displayName: form.displayName || form.username,
          genres: form.genres,
          equipment: form.equipment,
          daw: form.daw,
          style: form.djStyle,
          influences: form.influences,
        }),
      });
      if (!res.ok) throw new Error();
      const { bio } = (await res.json()) as { bio: string };
      setField('bio', bio);
    } catch {
      setToast({
        open: true,
        message: 'Bio generation failed. Add your AI key in Settings or try again.',
        tone: 'danger',
      });
    } finally {
      setGeneratingBio(false);
    }
  }

  // ── Final save ──

  async function handleFinish() {
    if (!user) return;
    const validation = OnboardingProfileSchema.safeParse(form);
    if (!validation.success) {
      setToast({
        open: true,
        message: validation.error.issues[0]?.message || 'Complete the required profile fields.',
        tone: 'danger',
      });
      return;
    }
    // Block the profile effect from racing this save — the effect would
    // navigate to /feed the moment onboarding_complete flips to true, which
    // would interrupt the invite redemption below.
    finishingRef.current = true;
    setSaving(true);
    try {
      const { error } = await updateProfile({
        username: form.username.trim(),
        display_name: form.displayName.trim() || null,
        location: form.location.trim() || null,
        avatar_url: form.avatarUrl || null,
        bio: form.bio.trim() || null,
        genres: form.genres,
        website: form.website.trim() || null,
        social_links: {
          github: form.github.trim(),
          soundcloud: form.soundcloud.trim(),
          spotify: form.spotify.trim(),
          instagram: form.instagram.trim(),
        },
        dj_equipment: form.equipment,
        dj_daw: form.daw,
        dj_style: form.djStyle.trim() || null,
        onboarding_complete: true,
      });
      if (error) throw error;

      // Auto-redeem a pending invite code stored before sign-in
      const pendingInvite = typeof window !== 'undefined'
        ? sessionStorage.getItem('pending_invite')
        : null;
      if (pendingInvite) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          await fetch('/api/invites/redeem', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${currentSession.access_token}`,
            },
            body: JSON.stringify({ code: pendingInvite }),
          }).catch(() => {});
          sessionStorage.removeItem('pending_invite');
        }
      }

      navigate('/feed');
    } catch (error) {
      finishingRef.current = false;
      setToast({
        open: true,
        message: error instanceof Error ? error.message : 'Could not save profile. Try again.',
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Layout helpers ──

  const canProceedStep1 =
    form.username.trim().length >= 3 &&
    form.displayName.trim().length > 0 &&
    !usernameError &&
    !usernameChecking;
  const canProceedStep2 = true; // avatar is optional — users without an AI key must not be blocked
  const canProceedStep3 = form.bio.trim().length > 0 && form.genres.length > 0;
  const canProceedStep4 = true;
  const canFinish =
    OnboardingProfileSchema.safeParse(form).success && !usernameError && !usernameChecking;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${space[14]}px ${space[8]}px`,
      }}
    >
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Progress stepper */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[3],
            marginBottom: space[11],
          }}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: done ? colors.accent : active ? colors.accentMuted : colors.surface,
                    border: `2px solid ${done || active ? colors.accent : colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.bold,
                    color: done ? colors.bg : active ? colors.accent : colors.text.faint,
                    transition: 'all 220ms',
                  }}
                >
                  {done ? '✓' : n}
                </div>
                {i < TOTAL_STEPS - 1 && (
                  <div
                    style={{
                      width: 32,
                      height: 2,
                      background: done ? colors.accent : colors.border,
                      margin: `0 ${space[2]}px`,
                      transition: 'background 220ms',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step card */}
        <div
          style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 16,
            padding: `${space[11]}px ${space[10]}px`,
          }}
        >
          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <StepShell title={t('setUpYourIdentity')} subtitle={t('usernameAndDisplayName')}>
              <div style={{ marginBottom: space[7] }}>
                <Input
                  label={t('username')}
                  help={usernameChecking ? 'Checking…' : '3–30 chars, letters/numbers/underscores'}
                  type="text"
                  value={form.username}
                  onChange={e => {
                    setField('username', e.target.value);
                    setUsernameError('');
                  }}
                  onBlur={() => checkUsername(form.username).catch(() => {})}
                  placeholder={t('djyourusername')}
                  error={usernameError || undefined}
                />
              </div>
              <div style={{ marginBottom: space[7] }}>
                <Input
                  label={t('displayName')}
                  type="text"
                  value={form.displayName}
                  onChange={e => setField('displayName', e.target.value)}
                  placeholder={t('djVenom')}
                />
              </div>
              <div style={{ marginBottom: space[7] }}>
                <Input
                  label={t('location')}
                  type="text"
                  value={form.location}
                  onChange={e => setField('location', e.target.value)}
                  placeholder={t('brusselsBelgium')}
                />
              </div>
              <StepNav onNext={() => setStep(2)} canNext={canProceedStep1} />
            </StepShell>
          )}

          {/* ── Step 2: Avatar ── */}
          {step === 2 && (
            <StepShell title={t('yourAvatar')} subtitle={t('uploadAPhotoOr')}>
              {/* Mode toggle */}
              <div
                style={{
                  display: 'flex',
                  gap: space[3],
                  marginBottom: space[8],
                  background: colors.bg,
                  borderRadius: radius.lg,
                  padding: space[1],
                }}
              >
                {(['generate', 'upload'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setAvatarMode(m)}
                    style={{
                      flex: 1,
                      padding: `${space[4]}px`,
                      borderRadius: radius.md,
                      border: 'none',
                      background: avatarMode === m ? colors.accent : 'transparent',
                      color: avatarMode === m ? colors.bg : colors.text.muted,
                      fontWeight: avatarMode === m ? fontWeight.bold : fontWeight.normal,
                      fontSize: fontSize.base,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'generate' ? 'Generate with AI' : 'Upload'}
                  </button>
                ))}
              </div>

              {avatarMode === 'upload' && (
                <div>
                  <div
                    style={{
                      border: `2px dashed ${colors.border}`,
                      borderRadius: radius.xl,
                      padding: `${space[12]}px`,
                      textAlign: 'center',
                      cursor: 'pointer',
                      color: colors.text.muted,
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label={t('uploadAvatarImage')}
                    onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    {form.avatarUrl ? (
                      <img
                        src={form.avatarUrl}
                        alt="Avatar preview"
                        style={{
                          width: 96,
                          height: 96,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          margin: '0 auto',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <>
                        <div
                          style={{
                            marginBottom: space[4],
                            display: 'flex',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="camera" size={38} />
                        </div>
                        <p style={{ margin: 0, fontSize: fontSize.base }}>
                          {avatarUploading ? 'Uploading…' : 'Click to upload (max 5 MB)'}
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileSelect}
                  />
                </div>
              )}

              {avatarMode === 'generate' && (
                <div>
                  <div
                    style={{
                      background: colors.accentFaint,
                      border: `1px solid ${colors.accentMuted}`,
                      borderRadius: radius.md,
                      padding: `${space[5]}px ${space[6]}px`,
                      marginBottom: space[7],
                      fontSize: fontSize.sm,
                      color: colors.text.secondary,
                      lineHeight: 1.5,
                    }}
                  >
                    Want a guided psychedelic profile picture?{' '}
                    <Link
                      to="/studio/avatar"
                      style={{ color: colors.accent, fontWeight: fontWeight.semibold }}
                    >
                      Open Cosmic-Funk Studio →
                    </Link>
                  </div>

                  {/* AI key status notice */}
                  {aiKeyReady === 'none' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: space[5],
                        background: colors.surfaceMuted,
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        padding: `${space[5]}px ${space[6]}px`,
                        marginBottom: space[7],
                      }}
                    >
                      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                        <Icon name="key" size={18} />
                      </span>
                      <div
                        style={{
                          flex: 1,
                          fontSize: fontSize.xs,
                          color: colors.text.muted,
                          lineHeight: 1.5,
                        }}
                      >
                        No OpenAI key configured.{' '}
                        <Link to="/settings#ai" style={{ color: colors.accent }}>
                          {t('addYourKeyIn')}
                        </Link>{' '}
                        or{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: colors.accent }}
                        >
                          create one
                        </a>
                        .
                      </div>
                    </div>
                  )}
                  {aiKeyReady === 'ready' && (
                    <div
                      style={{
                        fontSize: fontSize.xs,
                        color: colors.success,
                        marginBottom: space[5],
                      }}
                    >
                      {profile?.is_admin
                        ? 'Admin — using MixHive AI key'
                        : profile?.is_pro
                          ? 'MixHive Pro AI active'
                          : 'OpenAI key connected'}
                    </div>
                  )}

                  {/* Style selector */}
                  <p
                    style={{
                      margin: `0 0 ${space[5]}px`,
                      fontSize: fontSize.sm,
                      color: colors.text.muted,
                    }}
                  >
                    {t('chooseAStyle')}
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: space[4],
                      marginBottom: space[7],
                    }}
                  >
                    {AVATAR_STYLES.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setAvatarStyle(s.key)}
                        style={{
                          background: avatarStyle === s.key ? colors.accentFaint : colors.bg,
                          border: `2px solid ${avatarStyle === s.key ? colors.accent : colors.border}`,
                          borderRadius: radius.lg,
                          padding: `${space[6]}px`,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 150ms',
                        }}
                      >
                        <span style={{ display: 'inline-flex' }}>
                          <Icon name={s.icon} size={24} />
                        </span>
                        <p
                          style={{
                            margin: `${space[3]}px 0 ${space[1]}px`,
                            fontWeight: fontWeight.semibold,
                            fontSize: fontSize.base,
                            color: colors.text.primary,
                          }}
                        >
                          {s.label}
                        </p>
                        <p style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.muted }}>
                          {s.desc}
                        </p>
                      </button>
                    ))}
                  </div>

                  <Input
                    label={t('describeYourVibeOptional')}
                    value={avatarPrompt}
                    onChange={e => setAvatarPrompt(e.target.value)}
                    placeholder={t('eGUndergroundRave')}
                  />

                  <Button
                    fullWidth
                    onClick={generateAvatars}
                    disabled={generatingAvatar || genCount >= 3}
                    loading={generatingAvatar}
                    style={{ marginBottom: space[7] }}
                  >
                    {generatingAvatar
                      ? 'Generating…'
                      : genCount >= 3
                        ? 'Max regenerations reached'
                        : 'Generate 4 avatars'}
                  </Button>
                  {genCount > 0 && genCount < 3 && (
                    <p
                      style={{
                        textAlign: 'center',
                        fontSize: fontSize.xs,
                        color: colors.text.dim,
                        marginBottom: space[5],
                      }}
                    >
                      {3 - genCount} generation{3 - genCount !== 1 ? 's' : ''} remaining
                    </p>
                  )}

                  {/* Generated grid */}
                  {generatedAvatars.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[4] }}>
                      {generatedAvatars.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => uploadGeneratedAvatar(url)}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: radius.lg,
                            overflow: 'hidden',
                            border: `3px solid ${selectedGenerated === url ? colors.accent : 'transparent'}`,
                            transition: 'border 150ms',
                            padding: 0,
                            background: 'none',
                          }}
                          aria-label={`Select generated avatar ${i + 1}`}
                        >
                          <img
                            src={url}
                            alt={`Generated avatar ${i + 1}`}
                            style={{
                              width: '100%',
                              aspectRatio: '1',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          {avatarUploading && selectedGenerated !== url && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.5)',
                              }}
                            />
                          )}
                          {selectedGenerated === url && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: colors.accent,
                                borderRadius: '50%',
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                color: colors.bg,
                                fontWeight: fontWeight.bold,
                              }}
                            >
                              ✓
                            </div>
                          )}
                        </button>
                      ))}
                      {/* Skeleton placeholders while generating */}
                      {generatingAvatar &&
                        Array.from({ length: 4 - generatedAvatars.length }).map((_, i) => (
                          <div
                            key={`sk-${i}`}
                            style={{
                              aspectRatio: '1',
                              background: colors.surfaceMuted,
                              borderRadius: radius.lg,
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}

              <StepNav
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
                canNext={canProceedStep2}
                nextLabel="Next"
              />
            </StepShell>
          )}

          {/* ── Step 3: Bio + Genres ── */}
          {step === 3 && (
            <StepShell title={t('yourSound')} subtitle={t('chooseAtLeastOne')}>
              <FormField label={t('genres')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {GENRES.map(g => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={form.genres.includes(g)}
                      onClick={() => toggleArray('genres', g)}
                      style={{
                        padding: `${space[2]}px ${space[5]}px`,
                        borderRadius: radius.pill,
                        border: `1px solid ${form.genres.includes(g) ? colors.accent : colors.border}`,
                        background: form.genres.includes(g) ? colors.accentFaint : 'transparent',
                        color: form.genres.includes(g) ? colors.accent : colors.text.muted,
                        fontSize: fontSize.sm,
                        cursor: 'pointer',
                        transition: 'all 120ms',
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </FormField>

              <Input
                label={t('yourStyleVibe')}
                help={t('usedByAiFor')}
                value={form.djStyle}
                onChange={e => setField('djStyle', e.target.value)}
                placeholder={t('eGDarkHypnotic')}
              />

              <Input
                label={t('influences')}
                value={form.influences}
                onChange={e => setField('influences', e.target.value)}
                placeholder={t('eGBenKlock')}
              />

              <div
                style={{
                  display: 'flex',
                  gap: space[5],
                  alignItems: 'flex-start',
                  marginBottom: space[6],
                }}
              >
                <div style={{ flex: 1 }}>
                  <Textarea
                    label={t('bio')}
                    value={form.bio}
                    onChange={e => setField('bio', e.target.value)}
                    rows={4}
                    placeholder={t('writeYourBioOr')}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {aiKeyReady === 'none' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[5],
                    background: colors.surfaceMuted,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: `${space[5]}px ${space[6]}px`,
                    marginBottom: space[5],
                  }}
                >
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                    <Icon name="key" size={18} />
                  </span>
                  <div
                    style={{
                      flex: 1,
                      fontSize: fontSize.xs,
                      color: colors.text.muted,
                      lineHeight: 1.5,
                    }}
                  >
                    No AI key configured — bio generation is unavailable.{' '}
                    <Link to="/settings#ai" style={{ color: colors.accent }}>
                      {t('addYourKeyIn')}
                    </Link>{' '}
                    to enable this feature.
                  </div>
                </div>
              )}
              <Button
                variant="secondary"
                fullWidth
                onClick={generateBio}
                disabled={generatingBio || aiKeyReady === 'none'}
                loading={generatingBio}
                style={{ marginBottom: space[7] }}
              >
                {generatingBio ? 'Writing bio…' : 'Write my bio with AI'}
              </Button>

              <StepNav
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                canNext={canProceedStep3}
                nextLabel="Next"
              />
            </StepShell>
          )}

          {/* ── Step 4: DJ Tools & Links ── */}
          {step === 4 && (
            <StepShell title={t('yourToolchain')} subtitle={t('showYourGearDaws')}>
              <FormField label={t('djEquipment')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {EQUIPMENT_OPTIONS.map(e => (
                    <button
                      key={e}
                      onClick={() => toggleArray('equipment', e)}
                      style={{
                        padding: `${space[2]}px ${space[5]}px`,
                        borderRadius: radius.pill,
                        border: `1px solid ${form.equipment.includes(e) ? colors.accent : colors.border}`,
                        background: form.equipment.includes(e) ? colors.accentFaint : 'transparent',
                        color: form.equipment.includes(e) ? colors.accent : colors.text.muted,
                        fontSize: fontSize.sm,
                        cursor: 'pointer',
                        transition: 'all 120ms',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label={t('productionDjSoftware')}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {DAW_OPTIONS.map(d => (
                    <button
                      key={d}
                      onClick={() => toggleArray('daw', d)}
                      style={{
                        padding: `${space[2]}px ${space[5]}px`,
                        borderRadius: radius.pill,
                        border: `1px solid ${form.daw.includes(d) ? colors.accent : colors.border}`,
                        background: form.daw.includes(d) ? colors.accentFaint : 'transparent',
                        color: form.daw.includes(d) ? colors.accent : colors.text.muted,
                        fontSize: fontSize.sm,
                        cursor: 'pointer',
                        transition: 'all 120ms',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </FormField>

              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  margin: `${space[8]}px 0`,
                  paddingTop: space[8],
                }}
              >
                <p
                  style={{
                    margin: `0 0 ${space[6]}px`,
                    fontSize: fontSize.sm,
                    color: colors.text.muted,
                    fontWeight: fontWeight.semibold,
                  }}
                >
                  {t('socialLinks')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
                  <Input
                    label={t('website')}
                    type="url"
                    value={form.website}
                    onChange={e => setField('website', e.target.value)}
                    placeholder={t('httpsYoursiteCom')}
                  />
                  <Input
                    label={t('github')}
                    value={form.github}
                    onChange={e => setField('github', e.target.value)}
                    placeholder={t('githubComYourusername')}
                  />
                  <Input
                    label={t('soundcloud')}
                    value={form.soundcloud}
                    onChange={e => setField('soundcloud', e.target.value)}
                    placeholder={t('soundcloudComYourusername')}
                  />
                  <Input
                    label={t('spotify')}
                    value={form.spotify}
                    onChange={e => setField('spotify', e.target.value)}
                    placeholder={t('openSpotifyComArtist')}
                  />
                  <Input
                    label={t('instagram')}
                    value={form.instagram}
                    onChange={e => setField('instagram', e.target.value)}
                    placeholder={t('yourusername')}
                  />
                </div>
              </div>

              <StepNav
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                canNext={canProceedStep4}
              />
            </StepShell>
          )}

          {/* ── Step 5: Complete ── */}
          {step === 5 && (
            <StepShell title={t('youReReadyTo')} subtitle={t('hereSYourProfile')}>
              <div style={{ textAlign: 'center', marginBottom: space[9] }}>
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="Your avatar"
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      margin: `0 auto ${space[5]}px`,
                      display: 'block',
                      border: `3px solid ${colors.accent}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      background: colors.accentFaint,
                      border: `3px solid ${colors.accent}`,
                      margin: `0 auto ${space[5]}px`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36,
                      color: colors.accent,
                    }}
                  >
                    {(form.displayName || form.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <h3
                  style={{
                    margin: `0 0 ${space[2]}px`,
                    color: colors.text.primary,
                    fontSize: fontSize.xl,
                  }}
                >
                  {form.displayName || form.username}
                </h3>
                <p
                  style={{
                    margin: `0 0 ${space[4]}px`,
                    color: colors.text.muted,
                    fontSize: fontSize.base,
                  }}
                >
                  @{form.username}
                </p>
                {form.bio && (
                  <p
                    style={{
                      margin: `0 0 ${space[5]}px`,
                      color: colors.text.secondary,
                      fontSize: fontSize.base,
                      lineHeight: 1.5,
                    }}
                  >
                    {form.bio}
                  </p>
                )}
                {form.genres.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: space[2],
                      justifyContent: 'center',
                    }}
                  >
                    {form.genres.map(g => (
                      <span
                        key={g}
                        style={{
                          padding: `${space[1]}px ${space[4]}px`,
                          borderRadius: radius.pill,
                          background: colors.accentFaint,
                          color: colors.accent,
                          fontSize: fontSize.xs,
                        }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
                <Button
                  size="lg"
                  fullWidth
                  onClick={handleFinish}
                  disabled={!canFinish || saving}
                  loading={saving}
                >
                  {saving ? 'Saving…' : 'Enter the Hive'}
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setStep(4)}>
                  ← Go back
                </Button>
              </div>

              {/* Profile Coach nudge */}
              <div
                style={{
                  marginTop: space[9],
                  padding: `${space[7]}px`,
                  borderRadius: radius.lg,
                  background:
                    'linear-gradient(135deg, rgba(255,216,74,0.06), transparent 40%), rgba(7,7,5,0.78)',
                  border: `1px solid ${colors.accentMuted}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: space[5],
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
                      background: colors.accentFaint,
                      color: colors.accent,
                      border: `1px solid ${colors.accentMuted}`,
                      fontSize: 13,
                    }}
                  >
                    <Icon name="sparkles" size={24} color="currentColor" />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: fontSize.base,
                        fontWeight: fontWeight.bold,
                        color: colors.text.primary,
                      }}
                    >
                      {t('getYourFreeAi')}
                    </div>
                    <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                      {t('runAProfileCoaching')}
                    </div>
                  </div>
                </div>

                {coachNoKey && (
                  <div style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                    No AI key configured.{' '}
                    <Link to="/settings#ai" style={{ color: colors.accent }}>
                      Add one in Settings →
                    </Link>
                  </div>
                )}

                {coachResult &&
                  !coachLoading &&
                  (() => {
                    const score = coachResult.payload.score as number | undefined;
                    const headline = coachResult.payload.headline as string | undefined;
                    const scoreColor =
                      score === undefined
                        ? colors.text.muted
                        : score >= 70
                          ? colors.accent
                          : score >= 40
                            ? colors.warning
                            : colors.danger;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: space[3] }}>
                          {score !== undefined && (
                            <span
                              style={{
                                fontSize: fontSize['2xl'],
                                fontWeight: fontWeight.bold,
                                color: scoreColor,
                              }}
                            >
                              {score}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: fontSize.xs,
                              color: colors.text.dim,
                              textTransform: 'uppercase',
                              letterSpacing: 1,
                            }}
                          >
                            /100{headline ? ` · ${headline}` : ''}
                          </span>
                        </div>
                        <Link
                          to="/agents/inbox"
                          style={{
                            fontSize: fontSize.sm,
                            color: colors.accent,
                            textDecoration: 'none',
                            fontWeight: fontWeight.medium,
                          }}
                        >
                          See full report in Agent Inbox →
                        </Link>
                      </div>
                    );
                  })()}

                {!coachResult && !coachNoKey && (
                  <Button
                    variant="secondary"
                    disabled={coachLoading || aiKeyReady !== 'ready'}
                    onClick={async () => {
                      setCoachLoading(true);
                      setCoachNoKey(false);
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        if (!token) return;
                        const result = await callProfileCoach(token);
                        if (!result) {
                          setCoachNoKey(true);
                          return;
                        }
                        setCoachResult(result);
                      } finally {
                        setCoachLoading(false);
                      }
                    }}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {coachLoading
                      ? '⟳ Analysing…'
                      : aiKeyReady === 'none'
                        ? 'Add AI key to analyse'
                        : 'Analyse my profile'}
                  </Button>
                )}
              </div>
            </StepShell>
          )}
        </div>
      </div>

      <BuzzToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        style={{
          margin: `0 0 ${space[3]}px`,
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: colors.text.primary,
        }}
      >
        {title}
      </h2>
      <p style={{ margin: `0 0 ${space[9]}px`, fontSize: fontSize.md, color: colors.text.muted }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: space[7] }}>
      <label
        style={{
          display: 'block',
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: colors.text.muted,
          marginBottom: space[3],
        }}
      >
        {label}
        {hint && (
          <span style={{ fontWeight: fontWeight.normal, marginLeft: space[3] }}>{hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  canNext,
  nextLabel = 'Next',
}: {
  onBack?: () => void;
  onNext: () => void;
  canNext: boolean;
  nextLabel?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: space[9],
      }}
    >
      {onBack ? (
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
      ) : (
        <div />
      )}
      <Button onClick={onNext} disabled={!canNext} style={{ minWidth: 100 }}>
        {nextLabel} →
      </Button>
    </div>
  );
}
