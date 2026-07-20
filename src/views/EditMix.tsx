import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors } from '../styles/tokens';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getMix, updateMix, deleteMix } from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AUDIO_BUCKET, ARTWORK_BUCKET } from '../lib/api';
import { Input, Textarea, Select, FileInput, Button, IconButton } from '../components/ui';
import type { Mix, TrackItem } from '../lib/types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function EditMix() {
  const t = useTranslations('editMix');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mix, setMix] = useState<Mix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genreId, setGenreId] = useState<number | ''>('');
  const [tags, setTags] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [isExplicit, setIsExplicit] = useState(false);
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({});
  const [tracklist, setTracklist] = useState<TrackItem[]>([]);
  const [requiredTier, setRequiredTier] = useState<'free' | 'supporter' | 'insider' | 'patron'>(
    'free'
  );

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
        setRequiredTier(m.required_tier || 'free');
        setScheduleDate(m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : '');
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
        required_tier: requiredTier,
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

  async function handleArchive() {
    if (!id) return;
    setArchiving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      await fetch(`/api/mixes/${id}/archive`, {
        method: mix?.archived ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setMix(prev => (prev ? { ...prev, archived: !prev.archived } : prev));
    } catch {
      setError('Failed to update archive status');
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnpublish() {
    if (!id) return;
    if (!window.confirm('Unpublish this mix? It will no longer be visible to the public.')) return;
    setUnpublishing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      await fetch(`/api/mixes/${id}/unpublish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setMix(prev => (prev ? { ...prev, published: false, published_at: null } : prev));
    } catch {
      setError('Failed to unpublish mix');
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleSchedule() {
    if (!id || !scheduleDate) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      await fetch(`/api/mixes/${id}/schedule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduled_at: new Date(scheduleDate).toISOString() }),
      });
      setMix(prev =>
        prev ? { ...prev, scheduled_at: new Date(scheduleDate).toISOString() } : prev
      );
    } catch {
      setError('Failed to schedule mix');
    }
  }

  async function handleUnschedule() {
    if (!id) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      await fetch(`/api/mixes/${id}/schedule`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setMix(prev => (prev ? { ...prev, scheduled_at: null } : prev));
      setScheduleDate('');
    } catch {
      setError('Failed to cancel schedule');
    }
  }

  if (loading || !mix) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.danger }}>{error}</div>
    );
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: colors.text.primary, marginBottom: 24 }}>
        {t('title')}
      </h1>

      {uploadError && (
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
          {uploadError}
        </div>
      )}

      <form
        onSubmit={e => e.preventDefault()}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <Input
          label={t('fieldTitle')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('titlePlaceholder')}
        />

        <Textarea
          label={t('description')}
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder={t('descriptionPlaceholder')}
        />

        <Select
          label={t('genre')}
          value={genreId === '' ? '' : String(genreId)}
          onChange={e => setGenreId(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={t('selectGenre')}
        />

        <Input
          label={t('tags')}
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder={t('tagsPlaceholder')}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            color: colors.text.secondary,
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={isExplicit}
            onChange={e => setIsExplicit(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>{t('explicit')}</span>
        </label>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            {t('platformLinks')}
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
          <legend style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8 }}>
            {t('tracklist')}
          </legend>
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
                  placeholder={t('artist')}
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
                  placeholder={t('trackTitle')}
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
                  placeholder={t('startSec')}
                  style={{ width: 80 }}
                />
                <IconButton
                  label={t('removeTrack')}
                  size={28}
                  onClick={() => {
                    const list = [...tracklist];
                    list.splice(index, 1);
                    setTracklist(list);
                  }}
                  style={{ background: colors.dangerBg, color: colors.danger }}
                >
                  −
                </IconButton>
              </div>
            ))}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setTracklist([...tracklist, { artist: '', title: '' }])}
              >
                + Add Track
              </Button>
            </div>
          </div>
        </fieldset>

        <div>
          <FileInput
            label={t('audioFile')}
            accept="audio/*"
            onChange={e => setAudioFile(e.target.files?.[0] || null)}
          />
          {audioFile && (
            <div style={{ marginTop: 8, fontSize: 12, color: colors.text.muted }}>
              {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div>
          <FileInput
            label={t('artworkImage')}
            accept="image/*"
            onChange={e => setArtworkFile(e.target.files?.[0] || null)}
          />
          {artworkFile && (
            <div style={{ marginTop: 8, fontSize: 12, color: colors.text.muted }}>
              {artworkFile.name} ({Math.round(artworkFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div>
          <label
            style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8, display: 'block' }}
          >
            {t('requiredTier')}
          </label>
          <Select
            hideLabel
            label={t('requiredTier')}
            value={requiredTier}
            onChange={e => setRequiredTier(e.target.value as typeof requiredTier)}
          >
            <option value="free">Free</option>
            <option value="supporter">Supporter</option>
            <option value="insider">Insider</option>
            <option value="patron">Patron</option>
          </Select>
        </div>

        <div>
          <label
            style={{ color: colors.text.muted, fontSize: 13, marginBottom: 8, display: 'block' }}
          >
            {t('scheduleFor')}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              hideLabel
              label={t('scheduleFor')}
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              style={{ flex: 1 }}
            />
            {mix?.scheduled_at ? (
              <Button type="button" variant="secondary" size="sm" onClick={handleUnschedule}>
                {t('unschedule')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSchedule}
                disabled={!scheduleDate}
              >
                {t('schedule')}
              </Button>
            )}
          </div>
          {mix?.scheduled_at && (
            <div style={{ fontSize: 12, color: colors.text.muted, marginTop: 4 }}>
              Scheduled for {new Date(mix.scheduled_at).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={handleArchive}
            disabled={archiving}
            loading={archiving}
            style={{ flex: 1 }}
          >
            {mix?.archived ? t('unarchive') : t('archive')}
          </Button>
          {mix?.published && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleUnpublish}
              disabled={unpublishing}
              loading={unpublishing}
              style={{ flex: 1 }}
            >
              {t('unpublish')}
            </Button>
          )}
          {mix?.archived && (
            <Button
              type="button"
              variant="danger"
              fullWidth
              onClick={handleDelete}
              disabled={uploading}
              loading={uploading}
              style={{ flex: 1 }}
            >
              {uploading ? 'Deleting...' : 'Delete Mix'}
            </Button>
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <Button
            type="button"
            fullWidth
            onClick={handleSave}
            disabled={uploading}
            loading={uploading}
            style={{ flex: 1 }}
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
