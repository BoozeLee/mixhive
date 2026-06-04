import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createMix, updateMix } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Icon } from '../components/ui/Icon';
import { Select } from '../components/ui/Select';
import { FileInput } from '../components/ui/FileInput';
import { UploadSchema, formatZodError } from '../lib/schemas';
import { AUDIO_BUCKET, ARTWORK_BUCKET, WAVEFORM_BUCKET } from '../lib/api';
import { generateWaveform, waveformToJson } from '../lib/waveform';
import type { Mix, TrackItem } from '../lib/types';

export function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genreId: '' as number | '',
    tags: '',
  });

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [tracklist, setTracklist] = useState<TrackItem[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [isExplicit, setIsExplicit] = useState(false);
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({});
  const [platformErrors, setPlatformErrors] = useState<Record<string, string>>({});
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [detectingDuration, setDetectingDuration] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState('');
  const [publishedTitle, setPublishedTitle] = useState('');

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !audioFile) return;
    if (!isSupabaseConfigured) {
      setGeneralError(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local before uploading.'
      );
      return;
    }

    // Validate with Zod
    const validationData = {
      title: formData.title,
      description: formData.description || undefined,
      genre: formData.genreId ? String(formData.genreId) : undefined,
      tags: formData.tags
        ? formData.tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        : [],
    };

    const result = UploadSchema.safeParse({
      ...validationData,
      artworkFile: artworkFile,
      audioFile: audioFile,
    });

    if (!result.success) {
      setFormErrors(formatZodError(result.error));
      setGeneralError('');
      setUploading(false);
      return;
    }

    // Validate platform links before submitting
    const linkErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(platformLinks)) {
      if (value && !/^https?:\/\//i.test(value)) {
        linkErrors[key] = 'Must start with http:// or https://';
      }
    }
    if (Object.keys(linkErrors).length > 0) {
      setPlatformErrors(prev => ({ ...prev, ...linkErrors }));
      setGeneralError('Please fix invalid platform URLs before uploading');
      setUploading(false);
      return;
    }

    setFormErrors({});
    setGeneralError('');
    setUploading(true);
    setUploadProgress(10);

    try {
      // Generate waveform data (non-critical, can fail silently)
      let waveformUrl = '';
      try {
        const waveform = await generateWaveform(audioFile);
        const jsonStr = waveformToJson(waveform);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const waveformPath = `${crypto.randomUUID()}.json`;
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
        // Waveform generation is non-critical — upload proceeds without it
      }

      setUploadProgress(30);
      // Upload audio to public bucket for playback
      const audioUrl = await uploadFile(audioFile, AUDIO_BUCKET);
      if (!audioUrl) throw new Error('Failed to upload audio');
      setUploadProgress(70);

      let artworkUrl = '';
      if (artworkFile) {
        artworkUrl = (await uploadFile(artworkFile, ARTWORK_BUCKET)) || '';
      }
      setUploadProgress(85);

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
        published: true,
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
        // Transition to 'processing' — triggers DB trigger → enqueues waveform job
        void updateMix(mix.id, { upload_status: 'processing' });
        setPublishedTitle(mix.title);
        window.setTimeout(() => navigate(`/mix/${mix.id}`), 700);
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  }

  async function uploadFile(file: File, bucket: string): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    const ext = file.name.split('.').pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadErr) throw uploadErr;
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  }

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field-specific error when user types
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="container" style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#f0c040', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Nectar Upload
        </p>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#eee', lineHeight: 1.1 }}>
          Drop your mix
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: '#888' }}>
          Share your sound with the hive. MP3, WAV, AIFF, or FLAC.
        </p>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#f0c040', fontWeight: 600 }}>Uploading…</span>
            <span style={{ fontSize: 12, color: '#888' }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: '#1a1a2e', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'linear-gradient(90deg, #f0c040, #ffd84a)',
                borderRadius: 999,
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>
      )}

      {generalError && (
        <div
          style={{
            background: '#2a1010', color: '#f55', padding: '10px 14px',
            borderRadius: 8, fontSize: 13, marginBottom: 16,
            border: '1px solid #f5525244',
          }}
        >
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Drag-and-drop audio upload zone */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#999', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Audio file *
          </label>
          <div
            role="button"
            tabIndex={0}
            aria-label="Audio file drop zone — drag and drop or click to browse"
            onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) setAudioFile(file);
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'audio/*';
              input.onchange = () => { const f = input.files?.[0]; if (f) setAudioFile(f); };
              input.click();
            }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
            style={{
              minHeight: 120,
              borderRadius: 10,
              border: dragOver ? '2px solid #f0c040' : audioFile ? '2px solid #f0c04055' : '1.5px dashed #1a1a2e',
              background: dragOver ? '#f0c04014' : audioFile ? '#f0c04008' : '#111',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '24px 20px',
              transition: 'border-color 120ms ease, background 120ms ease',
              textAlign: 'center',
              outline: 'none',
            }}
          >
            {audioFile ? (
              <>
                <span aria-hidden="true" style={{ fontSize: 28, color: '#f0c040' }}>✓</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#eee' }}>{audioFile.name}</span>
                <span style={{ fontSize: 12, color: '#888' }}>
                  {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                  {duration && !detectingDuration && ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}
                  {detectingDuration && ' · detecting duration…'}
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setAudioFile(null); setDuration(null); }}
                  style={{ fontSize: 11, color: '#f55', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <span aria-hidden="true" style={{ display: 'flex', color: dragOver ? '#f0c040' : '#444' }}><Icon name="upload" size={30} color="currentColor" /></span>
                <span style={{ fontSize: 14, fontWeight: 600, color: dragOver ? '#f0c040' : '#777' }}>
                  {dragOver ? 'Drop it!' : 'Drop your mix here'}
                </span>
                <span style={{ fontSize: 12, color: '#555' }}>or click to browse — MP3, WAV, AIFF, FLAC</span>
              </>
            )}
          </div>
        </div>

        <Input
          label="Title *"
          value={formData.title}
          onChange={e => handleInputChange('title', e.target.value)}
          required
          error={formErrors.title}
          placeholder="Enter mix title"
        />

        <Textarea
          label="Description"
          value={formData.description}
          onChange={e => handleInputChange('description', e.target.value)}
          rows={3}
          placeholder="Describe your mix..."
        />

        <Select
          label="Genre"
          value={formData.genreId === '' ? '' : String(formData.genreId)}
          onChange={e =>
            handleInputChange('genreId', e.target.value === '' ? '' : Number(e.target.value))
          }
          placeholder="Select genre"
        >
          {genres.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>

        <Input
          label="Tags (comma separated)"
          value={formData.tags}
          onChange={e => handleInputChange('tags', e.target.value)}
          placeholder="house, deep, vinyl"
        />

        <FileInput
          label="Artwork (optional)"
          accept="image/*"
          help="Square artwork works best. JPG, PNG, or WebP."
          style={{ minHeight: 48 }}
          onChange={e => setArtworkFile(e.target.files?.[0] || null)}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            color: '#ccc',
            fontSize: 14,
            minHeight: 44,
            padding: '8px 0',
          }}
        >
          <input
            type="checkbox"
            checked={isExplicit}
            onChange={e => {
              if (!audioFile) {
                setGeneralError('Must select audio file to set explicit content');
                return;
              }
              setIsExplicit(e.target.checked);
            }}
            style={{ width: 22, height: 22 }}
          />
          <span>Mark as explicit content</span>
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>
            Platform Links (optional)
          </legend>
          <div style={{ marginTop: 8 }}>
            {[
              ['SoundCloud', 'soundcloud'],
              ['Mixcloud', 'mixcloud'],
              ['YouTube', 'youtube'],
              ['Spotify', 'spotify'],
              ['Apple Music', 'applemusic'],
            ].map(([label, key]) => (
              <div
                key={key}
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}
              >
                <Input
                  type="text"
                  value={platformLinks[key] || ''}
                  onChange={e => {
                    const value = e.target.value.trim();
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
                  }}
                  placeholder={`${label} URL`}
                  error={platformErrors[key]}
                />
                {platformErrors[key] && (
                  <small style={{ color: '#f55', fontSize: 11, display: 'block', marginTop: 2 }}>
                    {platformErrors[key]}
                  </small>
                )}
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Tracklist</legend>
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
                  onChange={e => {
                    const list = [...tracklist];
                    list[index] = { ...list[index], artist: e.target.value };
                    setTracklist(list);
                  }}
                  placeholder="Artist"
                  style={{ flex: 1 }}
                />
                <Input
                  type="text"
                  value={track.title}
                  onChange={e => {
                    const list = [...tracklist];
                    list[index] = { ...list[index], title: e.target.value };
                    setTracklist(list);
                  }}
                  placeholder="Track Title"
                  style={{ flex: 1 }}
                />
                <Input
                  type="number"
                  value={track.start_time ?? 0}
                  onChange={e => {
                    const list = [...tracklist];
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    list[index] = { ...list[index], start_time: val };
                    setTracklist(list);
                  }}
                  placeholder="Start (sec)"
                  style={{ width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const list = [...tracklist];
                    list.splice(index, 1);
                    setTracklist(list);
                  }}
                  style={{
                    background: '#2a1010',
                    color: '#f55',
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
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setTracklist([...tracklist, { artist: '', title: '' }])}
                style={{
                  background: '#1a1a2e',
                  color: '#f0c040',
                  border: '1px solid #f0c040',
                  borderRadius: 6,
                  minHeight: 40,
                  padding: '8px 14px',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                + Add Track
              </button>
            </div>
          </div>
        </fieldset>

        <Button
          type="submit"
          disabled={uploading || !audioFile}
          fullWidth
          size="lg"
          style={{ marginTop: 8 }}
        >
          {uploading ? 'Uploading...' : 'Publish mix'}
        </Button>
        {publishedTitle && (
          <div
            role="status"
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 8,
              border: '1px solid #f0c04044',
              background: 'linear-gradient(135deg, #f0c04022, rgba(59,130,246,0.14))',
              color: '#f0c040',
              fontSize: 13,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            Honey Drop live: {publishedTitle}
          </div>
        )}
      </form>
    </div>
  );
}
