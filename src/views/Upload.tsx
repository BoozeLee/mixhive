import { useState, useEffect, useRef, useCallback } from 'react';
import { colors, withAlpha } from '../styles/tokens';
import { useTranslations } from 'next-intl';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createMix, updateMix } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Select } from '../components/ui/Select';
import { FileInput } from '../components/ui/FileInput';
import { AUDIO_BUCKET, ARTWORK_BUCKET, WAVEFORM_BUCKET } from '../lib/api';
import { generateWaveform, waveformToJson } from '../lib/waveform';
import { UploadStepper, type UploadStep } from '../components/upload/UploadStepper';
import { UploadProgress } from '../components/upload/UploadProgress';
import { AudioDropZone } from '../components/upload/AudioDropZone';
import { AudioPreview } from '../components/upload/AudioPreview';
import { PostPublishPanel } from '../components/upload/PostPublishPanel';
import type { Mix, TrackItem } from '../lib/types';

const PLATFORMS = [
  ['SoundCloud', 'soundcloud'],
  ['Mixcloud', 'mixcloud'],
  ['YouTube', 'youtube'],
  ['Spotify', 'spotify'],
  ['Apple Music', 'applemusic'],
] as const;

export function Upload() {
  const t = useTranslations('upload');
  const { user } = useAuth();

  const [step, setStep] = useState<UploadStep>('audio');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genreId: '' as number | '',
    tags: '',
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string>('');
  const [tracklist, setTracklist] = useState<TrackItem[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [isExplicit, setIsExplicit] = useState(false);
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({});
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>({});
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [publishedMix, setPublishedMix] = useState<{ id: string; title: string } | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const steps = [
    { id: 'audio' as const, label: t('stepAudio') },
    { id: 'metadata' as const, label: t('stepMetadata') },
    { id: 'artwork' as const, label: t('stepArtwork') },
    { id: 'tracklist' as const, label: t('stepTracklist') },
    { id: 'publish' as const, label: t('stepPublish') },
  ];

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('genres')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        if (data) setGenres(data);
      });
  }, []);

  useEffect(() => {
    if (!audioFile) return;
    if (!audioFile.type.startsWith('audio/')) {
      setGeneralError('Please select an audio file');
      setAudioFile(null);
      return;
    }

    setDetectingDuration(true);
    setGeneralError('');
    const url = URL.createObjectURL(audioFile);
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function cleanup() {
      cancelled = true;
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      setDetectingDuration(false);
    }

    try {
      const audio = new Audio(url);
      audio.preload = 'metadata';

      timeoutId = setTimeout(() => {
        setGeneralError('Audio duration detection timed out');
        setAudioFile(null);
        cleanup();
      }, 15000);

      audio.addEventListener('canplaythrough', () => {
        if (cancelled) return;
        setDuration(Math.round(audio.duration));
        cleanup();
      });

      audio.addEventListener('error', () => {
        if (cancelled) return;
        setDuration(null);
        cleanup();
      });
    } catch {
      setGeneralError('Failed to process audio file');
      cleanup();
    }

    return cleanup;
  }, [audioFile]);

  useEffect(() => {
    if (!artworkFile) {
      setArtworkPreview('');
      return;
    }
    const url = URL.createObjectURL(artworkFile);
    setArtworkPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [artworkFile]);

  async function uploadFileWithProgress(
    file: File,
    bucket: string
  ): Promise<{ url: string; abort: () => void }> {
    if (!isSupabaseConfigured) throw new Error('Supabase not configured');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');

    const ext = file.name.split('.').pop();
    const path = `${user!.id}/${crypto.randomUUID()}.${ext}`;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const endpoint = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      abortRef.current = () => {
        xhr.abort();
        reject(new Error('Upload cancelled'));
      };

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) {
          setUploadLoaded(event.loaded);
          setUploadTotal(event.total);
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        abortRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
          resolve({ url: publicUrl, abort: () => {} });
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        abortRef.current = null;
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        abortRef.current = null;
        reject(new Error('Upload cancelled'));
      });

      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.send(file);
    });
  }

  function cancelUpload() {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadLoaded(0);
    setUploadTotal(0);
  }

  async function handlePublish(publish = true) {
    if (!user || !audioFile) return;
    if (!isSupabaseConfigured) {
      setGeneralError(
        'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local before uploading.'
      );
      return;
    }

    setFormErrors({});
    setGeneralError('');
    setUploading(true);
    setUploadProgress(0);
    setUploadLoaded(0);
    setUploadTotal(audioFile.size);
    setUploadLabel(t('uploading'));

    try {
      // Generate waveform data (non-critical, can fail silently)
      let waveformUrl = '';
      try {
        setUploadLabel(t('processing'));
        const waveform = await generateWaveform(audioFile);
        const jsonStr = waveformToJson(waveform);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const waveformPath = `${user.id}/${crypto.randomUUID()}.json`;
        const { error: wfErr } = await supabase.storage
          .from(WAVEFORM_BUCKET)
          .upload(waveformPath, blob, { contentType: 'application/json' });
        if (!wfErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from(WAVEFORM_BUCKET).getPublicUrl(waveformPath);
          waveformUrl = publicUrl;
        }
      } catch {
        // Waveform generation is non-critical
      }

      // Upload audio with real progress
      setUploadLabel(t('uploading'));
      const { url: audioUrl } = await uploadFileWithProgress(audioFile, AUDIO_BUCKET);

      // Upload artwork with real progress
      let artworkUrl = '';
      if (artworkFile) {
        setUploadLoaded(0);
        setUploadTotal(artworkFile.size);
        setUploadProgress(0);
        const { url } = await uploadFileWithProgress(artworkFile, ARTWORK_BUCKET);
        artworkUrl = url;
      }

      const mixData: Partial<Mix> = {
        dj_id: user.id,
        title: formData.title,
        description: formData.description || null,
        genre_id: formData.genreId || null,
        tags: formData.tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
        duration_seconds: duration,
        is_explicit: isExplicit,
        audio_url: audioUrl,
        artwork_url: artworkUrl || null,
        waveform_url: waveformUrl || null,
        status: 'ready',
        upload_status: 'uploaded',
        published: publish,
      };

      if (tracklist.length > 0) {
        mixData.tracklist = tracklist;
      }

      if (Object.keys(platformLinks).length > 0) {
        mixData.platform_links = platformLinks;
      }

      const mix = await createMix(mixData);

      if (mix) {
        setUploadProgress(100);
        void updateMix(mix.id, { upload_status: 'processing' });
        setPublishedMix({ id: mix.id, title: mix.title });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      if (message !== 'Upload cancelled') {
        setGeneralError(message);
      }
      setUploadProgress(0);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  function validateStep(targetStep: UploadStep): boolean {
    const errors: Record<string, string> = {};
    if (targetStep !== 'audio' && !audioFile) {
      errors.audio = t('audioRequired');
    }
    if (
      (targetStep === 'artwork' || targetStep === 'tracklist' || targetStep === 'publish') &&
      !formData.title.trim()
    ) {
      errors.title = t('titleRequired');
    }
    if ((targetStep === 'tracklist' || targetStep === 'publish') && !formData.genreId) {
      errors.genre = t('genreRequired');
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setGeneralError(t('stepError'));
      return false;
    }
    return true;
  }

  function goToStep(targetStep: UploadStep) {
    const stepOrder = steps.map(s => s.id);
    const currentIndex = stepOrder.indexOf(step);
    const targetIndex = stepOrder.indexOf(targetStep);
    if (targetIndex > currentIndex && !validateStep(targetStep)) return;
    setGeneralError('');
    setStep(targetStep);
  }

  function handleNext() {
    const stepOrder = steps.map(s => s.id);
    const nextIndex = stepOrder.indexOf(step) + 1;
    const nextStep = stepOrder[nextIndex];
    if (nextStep) {
      goToStep(nextStep);
    }
  }

  function handleBack() {
    const stepOrder = steps.map(s => s.id);
    const prevIndex = stepOrder.indexOf(step) - 1;
    const prevStep = stepOrder[prevIndex];
    if (prevStep) {
      setStep(prevStep);
      setGeneralError('');
    }
  }

  const handleInputChange = useCallback((field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  function validatePlatformLink(key: string, value: string) {
    const links = { ...platformLinks };
    const errors = { ...platformErrors };
    if (value === '') {
      delete links[key];
      delete errors[key];
    } else if (!/^https?:\/\//i.test(value)) {
      links[key] = value;
      errors[key] = 'Must start with http:// or https://';
    } else {
      links[key] = value;
      delete errors[key];
    }
    setPlatformLinks(links);
    setPlatformErrors(errors);
  }

  function updateTrack(index: number, updates: Partial<TrackItem>) {
    setTracklist(prev => {
      const list = [...prev];
      list[index] = { ...list[index], ...updates };
      return list;
    });
  }

  function removeTrack(index: number) {
    setTracklist(prev => {
      const list = [...prev];
      list.splice(index, 1);
      return list;
    });
  }

  function hasOverlappingTracks(): boolean {
    const sorted = tracklist
      .map(t => t.start_time ?? 0)
      .filter(t => Number.isFinite(t))
      .sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] < sorted[i - 1] + 1) return true;
    }
    return false;
  }

  if (publishedMix) {
    return (
      <div
        className="container"
        style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}
      >
        <PostPublishPanel mixId={publishedMix.id} mixTitle={publishedMix.title} />
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: 11,
            fontWeight: 700,
            color: colors.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {t('title')}
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            color: colors.text.primary,
            lineHeight: 1.1,
          }}
        >
          {t('dropTitle')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.text.muted }}>
          Share your sound with the hive. MP3, WAV, AIFF, or FLAC.
        </p>
      </div>

      <UploadStepper steps={steps} currentStep={step} />

      {uploading && (
        <UploadProgress
          progress={uploadProgress}
          loadedBytes={uploadLoaded}
          totalBytes={uploadTotal}
          label={uploadLabel}
        />
      )}

      {generalError && (
        <div
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            border: `1px solid ${withAlpha(colors.danger, 0.27)}`,
          }}
        >
          {generalError}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          void handlePublish(true);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        {step === 'audio' && (
          <>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                color: colors.text.dimmed,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Audio file *
            </label>
            <AudioDropZone
              audioFile={audioFile}
              duration={duration}
              detectingDuration={detectingDuration}
              onFileSelect={file => {
                setAudioFile(file);
                setFormErrors(prev => ({ ...prev, audio: '' }));
              }}
            />
            {formErrors.audio && (
              <span style={{ color: colors.danger, fontSize: 12 }}>{formErrors.audio}</span>
            )}
            {audioFile && (
              <div style={{ marginTop: 12 }}>
                <AudioPreview file={audioFile} />
              </div>
            )}
          </>
        )}

        {step === 'metadata' && (
          <>
            <Input
              label={t('labelTitle')}
              value={formData.title}
              onChange={e => handleInputChange('title', e.target.value)}
              required
              error={formErrors.title}
              placeholder={t('titlePlaceholder')}
            />
            <Textarea
              label={t('labelDescription')}
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              rows={3}
              placeholder={t('descriptionPlaceholder')}
            />
            <Select
              label={t('labelGenre')}
              value={formData.genreId === '' ? '' : String(formData.genreId)}
              onChange={e =>
                handleInputChange('genreId', e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder={t('genrePlaceholder')}
              error={formErrors.genre}
            >
              {genres.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <Input
              label={t('labelTags')}
              value={formData.tags}
              onChange={e => handleInputChange('tags', e.target.value)}
              placeholder={t('tagsPlaceholder')}
            />
          </>
        )}

        {step === 'artwork' && (
          <>
            <FileInput
              label={t('labelArtwork')}
              accept="image/*"
              help="Square artwork works best. JPG, PNG, or WebP."
              style={{ minHeight: 48 }}
              onChange={e => setArtworkFile(e.target.files?.[0] || null)}
            />
            {artworkPreview && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={artworkPreview}
                  alt="Artwork preview"
                  style={{
                    width: '100%',
                    maxWidth: 280,
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              </div>
            )}
          </>
        )}

        {step === 'tracklist' && (
          <>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                color: colors.text.secondary,
                fontSize: 14,
                minHeight: 44,
                padding: '8px 0',
              }}
            >
              <input
                type="checkbox"
                checked={isExplicit}
                onChange={e => setIsExplicit(e.target.checked)}
                style={{ width: 22, height: 22 }}
              />
              <span>{t('explicit')}</span>
            </label>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
                {t('platformLinks')}
              </legend>
              <div style={{ marginTop: 8 }}>
                {PLATFORMS.map(([label, key]) => (
                  <div
                    key={key}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}
                  >
                    <Input
                      type="text"
                      value={platformLinks[key] || ''}
                      onChange={e => validatePlatformLink(key, e.target.value)}
                      placeholder={`${label} URL`}
                      error={platformErrors[key]}
                    />
                    {platformErrors[key] && (
                      <small
                        style={{
                          color: colors.danger,
                          fontSize: 11,
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                        {platformErrors[key]}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
                Tracklist
              </legend>
              <div style={{ marginTop: 8 }}>
                {tracklist.map((track, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 96px 44px',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <Input
                      type="text"
                      value={track.artist}
                      onChange={e => updateTrack(index, { artist: e.target.value })}
                      placeholder="Artist"
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="text"
                      value={track.title}
                      onChange={e => updateTrack(index, { title: e.target.value })}
                      placeholder={t('trackTitle')}
                      style={{ flex: 1 }}
                    />
                    <Input
                      type="number"
                      value={track.start_time ?? 0}
                      onChange={e => {
                        const val = e.target.value === '' ? undefined : Number(e.target.value);
                        updateTrack(index, { start_time: val });
                      }}
                      placeholder={t('startSec')}
                      style={{ width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => removeTrack(index)}
                      style={{
                        background: colors.dangerBg,
                        color: colors.danger,
                        border: 'none',
                        borderRadius: 6,
                        minHeight: 40,
                        padding: '8px 10px',
                        fontSize: 16,
                        cursor: 'pointer',
                      }}
                    >
                      −
                    </button>
                  </div>
                ))}
                {hasOverlappingTracks() && (
                  <div style={{ color: colors.danger, fontSize: 12, marginBottom: 8 }}>
                    {t('tracklistOverlapWarning')}
                  </div>
                )}
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setTracklist([...tracklist, { artist: '', title: '' }])}
                    style={{
                      background: colors.surfaceHover,
                      color: colors.accent,
                      border: `1px solid ${colors.accent}`,
                      borderRadius: 6,
                      minHeight: 40,
                      padding: '8px 14px',
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {t('addTrack')}
                  </button>
                </div>
              </div>
            </fieldset>
          </>
        )}

        {step === 'publish' && (
          <>
            <div
              style={{
                padding: 16,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                color: colors.text.secondary,
                fontSize: 14,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <strong style={{ color: colors.text.primary }}>
                  {formData.title || 'Untitled mix'}
                </strong>
              </div>
              <div>
                {audioFile?.name} ·{' '}
                {(audioFile?.size ?? 0) / 1024 / 1024 > 0
                  ? `${((audioFile?.size ?? 0) / 1024 / 1024).toFixed(1)} MB`
                  : ''}
              </div>
              <div style={{ marginTop: 8, color: colors.text.muted }}>
                {genres.find(g => g.id === formData.genreId)?.name || 'No genre'}
                {formData.tags && ` · ${formData.tags}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button
                type="button"
                disabled={uploading}
                fullWidth
                size="lg"
                variant="secondary"
                onClick={() => handlePublish(false)}
              >
                {uploading ? t('savingDraft') : t('saveDraft')}
              </Button>
              <Button type="submit" disabled={uploading || !audioFile} fullWidth size="lg">
                {uploading ? t('publishing') : t('publishMix')}
              </Button>
            </div>
          </>
        )}

        {step !== 'publish' && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {step !== 'audio' && (
              <Button type="button" variant="secondary" onClick={handleBack} disabled={uploading}>
                {t('back')}
              </Button>
            )}
            <Button type="button" onClick={handleNext} disabled={uploading}>
              {t('next')}
            </Button>
          </div>
        )}

        {uploading && (
          <Button type="button" variant="danger" onClick={cancelUpload}>
            Cancel upload
          </Button>
        )}
      </form>
    </div>
  );
}
