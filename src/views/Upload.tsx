import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createMix, updateMix } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
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

      // Upload audio to public bucket for playback
      const audioUrl = await uploadFile(audioFile, AUDIO_BUCKET);
      if (!audioUrl) throw new Error('Failed to upload audio');

      let artworkUrl = '';
      if (artworkFile) {
        artworkUrl = (await uploadFile(artworkFile, ARTWORK_BUCKET)) || '';
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
        // Transition to 'processing' — triggers DB trigger → enqueues waveform job
        void updateMix(mix.id, { upload_status: 'processing' });
        setPublishedTitle(mix.title);
        window.setTimeout(() => navigate(`/mix/${mix.id}`), 700);
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Upload failed');
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
    <div className="container" style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 24 }}>
        Upload a mix
      </h1>

      {generalError && (
        <div
          style={{
            background: '#2a1010',
            color: '#f55',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FileInput
          label="Audio file *"
          accept="audio/*"
          required
          help="Large touch target. Select an MP3, WAV, AIFF, or FLAC mix."
          style={{ minHeight: 48 }}
          onChange={e => setAudioFile(e.target.files?.[0] || null)}
        />

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

        <div>
          <Input
            label="Duration (seconds)"
            type="number"
            value={duration ?? ''}
            onChange={e => setDuration(e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Auto-detected (will show when loaded)"
          />
          {detectingDuration && (
            <div
              style={{
                width: '100%',
                height: 4,
                background: '#f0c040',
                borderRadius: 2,
                marginTop: 8,
                animation: 'pulse 2s infinite',
              }}
            />
          )}
          {duration !== null && !detectingDuration && (
            <small style={{ color: '#6c6', fontSize: 12, display: 'block', marginTop: 4 }}>
              Auto-detected: {Math.floor(duration / 60)}:
              {String(Math.floor(duration % 60)).padStart(2, '0')}
            </small>
          )}
        </div>

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
