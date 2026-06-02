import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMix, updateMix, deleteMix } from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AUDIO_BUCKET, ARTWORK_BUCKET } from '../lib/api';
import { Input, Textarea, Select, FileInput } from '../components/ui';
import type { Mix, TrackItem } from '../lib/types';

export function EditMix() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mix, setMix] = useState<Mix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genreId, setGenreId] = useState<number | ''>('');
  const [tags, setTags] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [isExplicit, setIsExplicit] = useState(false);
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({});
  const [tracklist, setTracklist] = useState<TrackItem[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getMix(id)
      .then(m => {
        if (!m) {
          setError('Mix not found');
          setLoading(false);
          return;
        }
        if (!user || m.dj_id !== user.id) {
          setError('Unauthorized');
          setLoading(false);
          return;
        }
        setMix(m);
        setTitle(m.title);
        setDescription(m.description || '');
        setGenreId(m.genre_id || '');
        setTags(m.tags.join(', '));
        setIsExplicit(m.is_explicit);
        setPlatformLinks(m.platform_links || {});
        setTracklist(m.tracklist || []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load mix');
        setLoading(false);
      });
  }, [id, user]);

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

  async function handleSave() {
    if (!mix || !id) return;
    setUploading(true);
    setUploadError(null);

    try {
      let audioUrl: string | null = mix.audio_url;
      let artworkUrl = mix.artwork_url;

      if (audioFile) {
        audioUrl = await uploadFile(audioFile, AUDIO_BUCKET);
        if (!audioUrl) throw new Error('Failed to upload audio');
      }

      if (artworkFile) {
        artworkUrl = await uploadFile(artworkFile, ARTWORK_BUCKET);
        if (!artworkUrl) throw new Error('Failed to upload artwork');
      }

      const updates: Partial<Mix> = {
        title,
        description: description || null,
        genre_id: genreId === '' ? null : Number(genreId),
        tags: tags
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0),
        is_explicit: isExplicit,
        artwork_url: artworkUrl,
        audio_url: audioUrl,
      };

      if (tracklist.length > 0) {
        updates.tracklist = tracklist;
      }

      if (Object.keys(platformLinks).length > 0) {
        updates.platform_links = platformLinks;
      }

      await updateMix(id, updates);
      navigate(`/mix/${id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save changes';
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this mix? This action cannot be undone.'))
      return;
    try {
      await deleteMix(id);
      navigate('/feed');
    } catch {
      setError('Failed to delete mix');
    }
  }

  if (loading || !mix) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>Loading...</div>
    );
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f55' }}>{error}</div>;
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 24 }}>Edit Mix</h1>

      {uploadError && (
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
          {uploadError}
        </div>
      )}

      <form
        onSubmit={e => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <Input
          label="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Mix title"
        />

        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe your mix..."
        />

        <Select
          label="Genre"
          value={genreId === '' ? '' : String(genreId)}
          onChange={e => setGenreId(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Select genre"
        />

        <Input
          label="Tags (comma separated)"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="house, deep, vinyl"
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            color: '#ccc',
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={isExplicit}
            onChange={e => setIsExplicit(e.target.checked)}
            style={{ width: 16, height: 16 }}
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
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
              >
                <Input
                  hideLabel
                  label={`${label} URL`}
                  value={platformLinks[key] || ''}
                  onChange={e => {
                    const links = { ...platformLinks };
                    if (e.target.value) {
                      links[key] = e.target.value;
                    } else {
                      delete links[key];
                    }
                    setPlatformLinks(links);
                  }}
                  placeholder={`${label} URL`}
                  style={{ flex: 1 }}
                />
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
                style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}
              >
                <Input
                  hideLabel
                  label={`Artist for track ${index + 1}`}
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
                  hideLabel
                  label={`Title for track ${index + 1}`}
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
                  hideLabel
                  label={`Start time for track ${index + 1}`}
                  type="number"
                  value={track.start_time ?? 0}
                  onChange={e => {
                    const list = [...tracklist];
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    list[index] = { ...list[index], start_time: val };
                    setTracklist(list);
                  }}
                  placeholder="Start (sec)"
                  style={{ width: 80 }}
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
                    borderRadius: 4,
                    padding: '4px 8px',
                    fontSize: 12,
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
                  borderRadius: 4,
                  padding: '6px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                + Add Track
              </button>
            </div>
          </div>
        </fieldset>

        <div>
          <FileInput
            label="Audio File (leave empty to keep current)"
            accept="audio/*"
            onChange={e => setAudioFile(e.target.files?.[0] || null)}
          />
          {audioFile && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div>
          <FileInput
            label="Artwork Image (leave empty to keep current)"
            accept="image/*"
            onChange={e => setArtworkFile(e.target.files?.[0] || null)}
          />
          {artworkFile && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              {artworkFile.name} ({Math.round(artworkFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={uploading}
            style={{
              flex: 1,
              background: '#2a1010',
              color: '#f55',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 14,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Deleting...' : 'Delete Mix'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={uploading}
            style={{
              flex: 1,
              background: '#f0c040',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: 8,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
