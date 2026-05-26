import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { AVATAR_BUCKET } from '../lib/api'
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens'
import { BuzzToast } from '../components/hive/BuzzToast'

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

const GENRES = [
  'House', 'Techno', 'Deep House', 'Tech House', 'Progressive House', 'Trance',
  'Drum & Bass', 'Dubstep', 'UK Garage', 'Breaks', 'Ambient', 'Downtempo',
  'Minimal', 'Electro', 'Disco', 'Funk / Soul', 'Hip Hop', 'Jazz', 'World', 'Open Format',
]

const EQUIPMENT_OPTIONS = [
  'Pioneer CDJ-3000', 'Pioneer CDJ-2000NXS2', 'Technics SL-1200', 'Pioneer XDJ-RX3',
  'Allen & Heath Xone:96', 'Pioneer DJM-900NXS2', 'Rane MP2015', 'Traktor Kontrol S4',
  'Serato DJ Pro Controller', 'Native Instruments Maschine', 'Roland TR-808',
  'Ableton Push 3', 'Akai MPC One', 'iPad Pro + Djay',
]

const DAW_OPTIONS = [
  'Ableton Live', 'FL Studio', 'Logic Pro', 'Bitwig Studio',
  'Reason Studios', 'Pro Tools', 'Reaper', 'GarageBand',
  'Traktor Pro', 'Serato DJ Pro', 'Rekordbox', 'Virtual DJ',
]

const AVATAR_STYLES = [
  { key: 'cyber-hive', label: 'Cyber DJ', emoji: '🐝', desc: 'Dark honeycomb, gold glow' },
  { key: 'abstract',   label: 'Sound Waves', emoji: '〰', desc: 'Abstract frequency art' },
  { key: 'neon',       label: 'Neon Rave', emoji: '💥', desc: 'Cyberpunk neon lights' },
  { key: 'minimal',    label: 'Minimal Dark', emoji: '◼', desc: 'Clean geometric minimal' },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────

interface SetupForm {
  username: string
  displayName: string
  location: string
  avatarUrl: string
  bio: string
  genres: string[]
  equipment: string[]
  daw: string[]
  djStyle: string
  influences: string
  website: string
  github: string
  soundcloud: string
  spotify: string
  instagram: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileSetup() {
  const { user, profile, updateProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: 'info' | 'success' | 'danger' }>({ open: false, message: '', tone: 'info' })

  // Avatar generation state
  const [avatarStyle, setAvatarStyle] = useState<typeof AVATAR_STYLES[number]['key']>('cyber-hive')
  const [avatarPrompt, setAvatarPrompt] = useState('')
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [generatedAvatars, setGeneratedAvatars] = useState<string[]>([])
  const [selectedGenerated, setSelectedGenerated] = useState<string | null>(null)
  const [avatarMode, setAvatarMode] = useState<'upload' | 'generate'>('generate')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [genCount, setGenCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bio generation state
  const [generatingBio, setGeneratingBio] = useState(false)

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
  })

  function setField<K extends keyof SetupForm>(k: K, v: SetupForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function toggleArray(field: 'genres' | 'equipment' | 'daw', value: string) {
    setForm(prev => {
      const arr = prev[field] as string[]
      return { ...prev, [field]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] }
    })
  }

  // ── Step 1: Identity ──

  async function checkUsername(value: string) {
    const clean = value.trim().toLowerCase()
    if (!clean || !/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameError(clean.length < 3 ? 'At least 3 characters' : clean.length > 30 ? 'Max 30 characters' : 'Letters, numbers, underscores only')
      return
    }
    if (clean === profile?.username) { setUsernameError(''); return }
    setUsernameChecking(true)
    setUsernameError('')
    const { data } = await supabase.from('profiles').select('username').eq('username', clean).maybeSingle()
    setUsernameChecking(false)
    if (data) setUsernameError('Username taken')
  }

  // ── Step 2: Avatar generation ──

  async function generateAvatars() {
    if (genCount >= 3) {
      setToast({ open: true, message: 'Max 3 generation rounds reached', tone: 'info' }); return
    }
    setGeneratingAvatar(true)
    setGeneratedAvatars([])
    setSelectedGenerated(null)
    setGenCount(c => c + 1)
    const results: string[] = []
    for (let i = 0; i < 4; i++) {
      const res = await fetch('/api/ai/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style: avatarStyle, prompt: avatarPrompt }),
      })
      if (res.ok) {
        const { url } = await res.json() as { url: string }
        if (url) results.push(url)
      }
      setGeneratedAvatars([...results]) // progressive reveal
    }
    setGeneratingAvatar(false)
    if (results.length === 0) {
      setToast({ open: true, message: 'Generation failed. Check OPENAI_API_KEY.', tone: 'danger' })
    }
  }

  async function uploadGeneratedAvatar(url: string) {
    if (!user || !isSupabaseConfigured) return
    setAvatarUploading(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const filename = `${user.id}/avatar_ai_${crypto.randomUUID()}.png`
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(filename, blob, { contentType: 'image/png', upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename)
      setField('avatarUrl', publicUrl)
      setSelectedGenerated(url)
      setToast({ open: true, message: 'Avatar saved!', tone: 'success' })
    } catch {
      setToast({ open: true, message: 'Could not save avatar', tone: 'danger' })
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !isSupabaseConfigured) return
    if (!file.type.startsWith('image/')) { setToast({ open: true, message: 'Image files only', tone: 'danger' }); return }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const filename = `${user.id}/avatar_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(filename, file, { contentType: file.type, upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename)
      setField('avatarUrl', publicUrl)
      setToast({ open: true, message: 'Avatar uploaded!', tone: 'success' })
    } catch {
      setToast({ open: true, message: 'Upload failed', tone: 'danger' })
    } finally {
      setAvatarUploading(false)
    }
  }

  // ── Step 3: GPT Bio ──

  async function generateBio() {
    setGeneratingBio(true)
    try {
      const res = await fetch('/api/ai/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName || form.username,
          genres: form.genres,
          equipment: form.equipment,
          daw: form.daw,
          style: form.djStyle,
          influences: form.influences,
        }),
      })
      if (!res.ok) throw new Error()
      const { bio } = await res.json() as { bio: string }
      setField('bio', bio)
    } catch {
      setToast({ open: true, message: 'Bio generation failed. Check OPENAI_API_KEY.', tone: 'danger' })
    } finally {
      setGeneratingBio(false)
    }
  }

  // ── Final save ──

  async function handleFinish() {
    if (!user) return
    setSaving(true)
    try {
      await updateProfile({
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
      })
      navigate('/feed')
    } catch {
      setToast({ open: true, message: 'Could not save profile. Try again.', tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  // ── Layout helpers ──

  const canProceedStep1 = form.username.trim().length >= 3 && !usernameError && !usernameChecking
  const canProceedStep2 = true // avatar is optional
  const canProceedStep3 = true // bio is optional
  const canProceedStep4 = true
  const canFinish = canProceedStep1

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `${space[14]}px ${space[8]}px` }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Progress stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: space[3], marginBottom: space[11] }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1
            const active = n === step
            const done = n < step
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: done ? colors.accent : active ? colors.accentMuted : colors.surface,
                  border: `2px solid ${done || active ? colors.accent : colors.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: fontSize.sm, fontWeight: fontWeight.bold,
                  color: done ? '#0a0a0a' : active ? colors.accent : colors.text.faint,
                  transition: 'all 220ms',
                }}>
                  {done ? '✓' : n}
                </div>
                {i < TOTAL_STEPS - 1 && (
                  <div style={{ width: 32, height: 2, background: done ? colors.accent : colors.border, margin: `0 ${space[2]}px`, transition: 'background 220ms' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Step card */}
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 16, padding: `${space[11]}px ${space[10]}px` }}>

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <StepShell title="Set up your identity" subtitle="Pick your username and display name.">
              <FormField label="Username *" hint="3–30 chars, letters/numbers/underscores">
                <input
                  type="text"
                  value={form.username}
                  onChange={e => { setField('username', e.target.value); setUsernameError('') }}
                  onBlur={() => checkUsername(form.username)}
                  placeholder="djyourusername"
                  style={inputStyle}
                  aria-describedby="username-error"
                />
                {usernameChecking && <p style={{ margin: `${space[2]}px 0 0`, fontSize: fontSize.xs, color: colors.text.dim }}>Checking…</p>}
                {usernameError && <p id="username-error" role="alert" style={{ margin: `${space[2]}px 0 0`, fontSize: fontSize.xs, color: colors.danger }}>{usernameError}</p>}
              </FormField>
              <FormField label="Display name">
                <input type="text" value={form.displayName} onChange={e => setField('displayName', e.target.value)} placeholder="DJ Venom" style={inputStyle} />
              </FormField>
              <FormField label="Location">
                <input type="text" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Brussels, Belgium" style={inputStyle} />
              </FormField>
              <StepNav onNext={() => setStep(2)} canNext={canProceedStep1} />
            </StepShell>
          )}

          {/* ── Step 2: Avatar ── */}
          {step === 2 && (
            <StepShell title="Your avatar" subtitle="Upload a photo or let AI generate one for you.">
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: space[3], marginBottom: space[8], background: colors.bg, borderRadius: radius.lg, padding: space[1] }}>
                {(['generate', 'upload'] as const).map(m => (
                  <button key={m} onClick={() => setAvatarMode(m)} style={{ flex: 1, padding: `${space[4]}px`, borderRadius: radius.md, border: 'none', background: avatarMode === m ? colors.accent : 'transparent', color: avatarMode === m ? '#0a0a0a' : colors.text.muted, fontWeight: avatarMode === m ? fontWeight.bold : fontWeight.normal, fontSize: fontSize.base, cursor: 'pointer' }}>
                    {m === 'generate' ? '✨ Generate with AI' : '📷 Upload'}
                  </button>
                ))}
              </div>

              {avatarMode === 'upload' && (
                <div>
                  <div
                    style={{ border: `2px dashed ${colors.border}`, borderRadius: radius.xl, padding: `${space[12]}px`, textAlign: 'center', cursor: 'pointer', color: colors.text.muted }}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload avatar image"
                    onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    {form.avatarUrl ? (
                      <img src={form.avatarUrl} alt="Avatar preview" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto', display: 'block' }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 40, marginBottom: space[4] }}>📷</div>
                        <p style={{ margin: 0, fontSize: fontSize.base }}>{avatarUploading ? 'Uploading…' : 'Click to upload (max 5 MB)'}</p>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFileSelect} />
                </div>
              )}

              {avatarMode === 'generate' && (
                <div>
                  {/* Style selector */}
                  <p style={{ margin: `0 0 ${space[5]}px`, fontSize: fontSize.sm, color: colors.text.muted }}>Choose a style</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[4], marginBottom: space[7] }}>
                    {AVATAR_STYLES.map(s => (
                      <button key={s.key} onClick={() => setAvatarStyle(s.key)} style={{ background: avatarStyle === s.key ? colors.accentFaint : colors.bg, border: `2px solid ${avatarStyle === s.key ? colors.accent : colors.border}`, borderRadius: radius.lg, padding: `${space[6]}px`, cursor: 'pointer', textAlign: 'left', transition: 'all 150ms' }}>
                        <span style={{ fontSize: 24 }}>{s.emoji}</span>
                        <p style={{ margin: `${space[3]}px 0 ${space[1]}px`, fontWeight: fontWeight.semibold, fontSize: fontSize.base, color: colors.text.primary }}>{s.label}</p>
                        <p style={{ margin: 0, fontSize: fontSize.xs, color: colors.text.muted }}>{s.desc}</p>
                      </button>
                    ))}
                  </div>

                  <FormField label="Describe your vibe (optional)">
                    <input type="text" value={avatarPrompt} onChange={e => setAvatarPrompt(e.target.value)} placeholder="e.g. underground rave, dark industrial…" style={inputStyle} />
                  </FormField>

                  <button onClick={generateAvatars} disabled={generatingAvatar || genCount >= 3} style={{ ...primaryBtnStyle, width: '100%', marginBottom: space[7], opacity: (generatingAvatar || genCount >= 3) ? 0.5 : 1 }}>
                    {generatingAvatar ? '✨ Generating…' : genCount >= 3 ? 'Max regenerations reached' : '✨ Generate 4 avatars'}
                  </button>
                  {genCount > 0 && genCount < 3 && (
                    <p style={{ textAlign: 'center', fontSize: fontSize.xs, color: colors.text.dim, marginBottom: space[5] }}>
                      {3 - genCount} generation{3 - genCount !== 1 ? 's' : ''} remaining
                    </p>
                  )}

                  {/* Generated grid */}
                  {generatedAvatars.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[4] }}>
                      {generatedAvatars.map((url, i) => (
                        <button key={i} onClick={() => uploadGeneratedAvatar(url)} style={{ position: 'relative', cursor: 'pointer', borderRadius: radius.lg, overflow: 'hidden', border: `3px solid ${selectedGenerated === url ? colors.accent : 'transparent'}`, transition: 'border 150ms', padding: 0, background: 'none' }} aria-label={`Select generated avatar ${i + 1}`}>
                          <img src={url} alt={`Generated avatar ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                          {avatarUploading && selectedGenerated !== url && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />}
                          {selectedGenerated === url && (
                            <div style={{ position: 'absolute', top: 6, right: 6, background: colors.accent, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#0a0a0a', fontWeight: fontWeight.bold }}>✓</div>
                          )}
                        </button>
                      ))}
                      {/* Skeleton placeholders while generating */}
                      {generatingAvatar && Array.from({ length: 4 - generatedAvatars.length }).map((_, i) => (
                        <div key={`sk-${i}`} style={{ aspectRatio: '1', background: colors.surfaceMuted, borderRadius: radius.lg, animation: 'pulse 1.5s ease-in-out infinite' }} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} canNext={canProceedStep2} nextLabel={form.avatarUrl ? 'Next' : 'Skip'} />
            </StepShell>
          )}

          {/* ── Step 3: Bio + Genres ── */}
          {step === 3 && (
            <StepShell title="Your sound" subtitle="Tell the hive what you're about. AI can write your bio.">
              <FormField label="Genres">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {GENRES.map(g => (
                    <button key={g} onClick={() => toggleArray('genres', g)} style={{ padding: `${space[2]}px ${space[5]}px`, borderRadius: radius.pill, border: `1px solid ${form.genres.includes(g) ? colors.accent : colors.border}`, background: form.genres.includes(g) ? colors.accentFaint : 'transparent', color: form.genres.includes(g) ? colors.accent : colors.text.muted, fontSize: fontSize.sm, cursor: 'pointer', transition: 'all 120ms' }}>
                      {g}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Your style / vibe" hint="Used by AI for bio + avatar generation">
                <input type="text" value={form.djStyle} onChange={e => setField('djStyle', e.target.value)} placeholder="e.g. dark hypnotic techno, warehouse energy" style={inputStyle} />
              </FormField>

              <FormField label="Influences">
                <input type="text" value={form.influences} onChange={e => setField('influences', e.target.value)} placeholder="e.g. Ben Klock, Aphex Twin, Nina Kraviz" style={inputStyle} />
              </FormField>

              <div style={{ display: 'flex', gap: space[5], alignItems: 'flex-start', marginBottom: space[6] }}>
                <div style={{ flex: 1 }}>
                  <FormField label="Bio">
                    <textarea value={form.bio} onChange={e => setField('bio', e.target.value)} rows={4} placeholder="Write your bio or use AI to generate one…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                  </FormField>
                </div>
              </div>

              <button onClick={generateBio} disabled={generatingBio} style={{ ...secondaryBtnStyle, width: '100%', marginBottom: space[7], opacity: generatingBio ? 0.6 : 1 }}>
                {generatingBio ? '✨ Writing bio…' : '✨ Write my bio with AI'}
              </button>

              <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} canNext={canProceedStep3} nextLabel="Next" />
            </StepShell>
          )}

          {/* ── Step 4: DJ Tools & Links ── */}
          {step === 4 && (
            <StepShell title="Your toolchain" subtitle="Show your gear, DAWs, and social links.">
              <FormField label="DJ Equipment">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {EQUIPMENT_OPTIONS.map(e => (
                    <button key={e} onClick={() => toggleArray('equipment', e)} style={{ padding: `${space[2]}px ${space[5]}px`, borderRadius: radius.pill, border: `1px solid ${form.equipment.includes(e) ? colors.accent : colors.border}`, background: form.equipment.includes(e) ? colors.accentFaint : 'transparent', color: form.equipment.includes(e) ? colors.accent : colors.text.muted, fontSize: fontSize.sm, cursor: 'pointer', transition: 'all 120ms' }}>
                      {e}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormField label="Production & DJ Software">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
                  {DAW_OPTIONS.map(d => (
                    <button key={d} onClick={() => toggleArray('daw', d)} style={{ padding: `${space[2]}px ${space[5]}px`, borderRadius: radius.pill, border: `1px solid ${form.daw.includes(d) ? colors.accent : colors.border}`, background: form.daw.includes(d) ? colors.accentFaint : 'transparent', color: form.daw.includes(d) ? colors.accent : colors.text.muted, fontSize: fontSize.sm, cursor: 'pointer', transition: 'all 120ms' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </FormField>

              <div style={{ borderTop: `1px solid ${colors.border}`, margin: `${space[8]}px 0`, paddingTop: space[8] }}>
                <p style={{ margin: `0 0 ${space[6]}px`, fontSize: fontSize.sm, color: colors.text.muted, fontWeight: fontWeight.semibold }}>Social links</p>
                <FormField label="Website">
                  <input type="url" value={form.website} onChange={e => setField('website', e.target.value)} placeholder="https://yoursite.com" style={inputStyle} />
                </FormField>
                <FormField label="GitHub">
                  <input type="text" value={form.github} onChange={e => setField('github', e.target.value)} placeholder="github.com/yourusername" style={inputStyle} />
                </FormField>
                <FormField label="SoundCloud">
                  <input type="text" value={form.soundcloud} onChange={e => setField('soundcloud', e.target.value)} placeholder="soundcloud.com/yourusername" style={inputStyle} />
                </FormField>
                <FormField label="Spotify">
                  <input type="text" value={form.spotify} onChange={e => setField('spotify', e.target.value)} placeholder="open.spotify.com/artist/…" style={inputStyle} />
                </FormField>
                <FormField label="Instagram">
                  <input type="text" value={form.instagram} onChange={e => setField('instagram', e.target.value)} placeholder="@yourusername" style={inputStyle} />
                </FormField>
              </div>

              <StepNav onBack={() => setStep(3)} onNext={() => setStep(5)} canNext={canProceedStep4} />
            </StepShell>
          )}

          {/* ── Step 5: Complete ── */}
          {step === 5 && (
            <StepShell title="You're ready to buzz 🐝" subtitle="Here's your profile preview. You can always edit it later.">
              <div style={{ textAlign: 'center', marginBottom: space[9] }}>
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Your avatar" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: `0 auto ${space[5]}px`, display: 'block', border: `3px solid ${colors.accent}` }} />
                ) : (
                  <div style={{ width: 96, height: 96, borderRadius: '50%', background: colors.accentFaint, border: `3px solid ${colors.accent}`, margin: `0 auto ${space[5]}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: colors.accent }}>
                    {(form.displayName || form.username || '?')[0].toUpperCase()}
                  </div>
                )}
                <h3 style={{ margin: `0 0 ${space[2]}px`, color: colors.text.primary, fontSize: fontSize.xl }}>{form.displayName || form.username}</h3>
                <p style={{ margin: `0 0 ${space[4]}px`, color: colors.text.muted, fontSize: fontSize.base }}>@{form.username}</p>
                {form.bio && <p style={{ margin: `0 0 ${space[5]}px`, color: colors.text.secondary, fontSize: fontSize.base, lineHeight: 1.5 }}>{form.bio}</p>}
                {form.genres.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], justifyContent: 'center' }}>
                    {form.genres.map(g => (
                      <span key={g} style={{ padding: `${space[1]}px ${space[4]}px`, borderRadius: radius.pill, background: colors.accentFaint, color: colors.accent, fontSize: fontSize.xs }}>{g}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
                <button
                  onClick={handleFinish}
                  disabled={!canFinish || saving}
                  style={{ ...primaryBtnStyle, padding: `${space[7]}px`, fontSize: fontSize.lg, opacity: (!canFinish || saving) ? 0.5 : 1 }}
                >
                  {saving ? 'Saving…' : 'Enter the Hive 🐝'}
                </button>
                <button onClick={() => setStep(4)} style={{ ...secondaryBtnStyle }}>← Go back</button>
              </div>
            </StepShell>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: space[8], fontSize: fontSize.sm, color: colors.text.faint }}>
          <button onClick={() => { updateProfile({ onboarding_complete: true }); navigate('/feed') }} style={{ background: 'none', border: 'none', color: colors.text.faint, cursor: 'pointer', textDecoration: 'underline', fontSize: fontSize.sm }}>
            Skip setup for now
          </button>
        </p>
      </div>

      <BuzzToast open={toast.open} message={toast.message} tone={toast.tone} onClose={() => setToast(t => ({ ...t, open: false }))} />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ margin: `0 0 ${space[3]}px`, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: colors.text.primary }}>{title}</h2>
      <p style={{ margin: `0 0 ${space[9]}px`, fontSize: fontSize.md, color: colors.text.muted }}>{subtitle}</p>
      {children}
    </div>
  )
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: space[7] }}>
      <label style={{ display: 'block', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.muted, marginBottom: space[3] }}>
        {label}
        {hint && <span style={{ fontWeight: fontWeight.normal, marginLeft: space[3] }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function StepNav({ onBack, onNext, canNext, nextLabel = 'Next' }: { onBack?: () => void; onNext: () => void; canNext: boolean; nextLabel?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: space[9] }}>
      {onBack
        ? <button onClick={onBack} style={secondaryBtnStyle}>← Back</button>
        : <div />}
      <button onClick={onNext} disabled={!canNext} style={{ ...primaryBtnStyle, opacity: canNext ? 1 : 0.5, minWidth: 100 }}>{nextLabel} →</button>
    </div>
  )
}

// ── Shared button styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${space[5]}px ${space[6]}px`,
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
  color: colors.text.primary,
  fontSize: fontSize.base,
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: `${space[4]}px ${space[9]}px`,
  background: colors.accent,
  color: '#0a0a0a',
  border: 'none',
  borderRadius: radius.pill,
  fontWeight: fontWeight.bold,
  fontSize: fontSize.base,
  cursor: 'pointer',
  textAlign: 'center',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: `${space[4]}px ${space[9]}px`,
  background: 'transparent',
  color: colors.text.muted,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.pill,
  fontWeight: fontWeight.normal,
  fontSize: fontSize.base,
  cursor: 'pointer',
  textAlign: 'center',
}
