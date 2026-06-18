import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './ui/Icon';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createBuzz } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { BuzzToast } from './hive/BuzzToast';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import type { Buzz } from '../lib/types';

const MAX_CHARS = 280;

const LANGUAGES = [
  'lua',
  'javascript',
  'typescript',
  'python',
  'bash',
  'sql',
  'json',
  'rust',
  'go',
];

interface Props {
  onBuzzCreated?: (buzz: Buzz) => void;
  placeholder?: string;
}

type AttachType = 'image' | 'audio' | 'video' | 'code' | 'mix' | null;

export function BuzzComposer({ onBuzzCreated, placeholder = "What's buzzing?" }: Props) {
  const t = useTranslations('buzzComposer');
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeAttach, setActiveAttach] = useState<AttachType>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [codeSnippet, setCodeSnippet] = useState('');
  const [codeLang, setCodeLang] = useState('lua');
  const [attachedMixUrl, setAttachedMixUrl] = useState('');
  const [attachedMixId, setAttachedMixId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: 'info' | 'success' | 'danger';
  }>({ open: false, message: '', tone: 'info' });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchParams.get('compose') === '1' && user && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchParams, user]);

  const remaining = MAX_CHARS - body.length;
  const canSubmit = body.trim().length > 0 && remaining >= 0 && !submitting;

  // Extract mix ID from MixHive URL or bare UUID
  function parseMixId(val: string): string | null {
    const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const m = val.match(uuidRe);
    return m ? m[0] : null;
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setToast({ open: true, message: 'Please select an image file', tone: 'danger' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setToast({ open: true, message: 'Image must be under 50 MB', tone: 'danger' });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setActiveAttach(null);
  }

  function handleAudioSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setToast({ open: true, message: 'Please select an audio file', tone: 'danger' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setToast({ open: true, message: 'Audio must be under 50 MB', tone: 'danger' });
      return;
    }
    setAudioFile(file);
    setActiveAttach(null);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setToast({ open: true, message: 'Please select a video file', tone: 'danger' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setToast({ open: true, message: 'Video must be under 50 MB', tone: 'danger' });
      return;
    }
    setVideoFile(file);
    setActiveAttach(null);
  }

  function clearAttachment(type: 'image' | 'audio' | 'video' | 'code' | 'mix') {
    if (type === 'image') {
      setImageFile(null);
      setImagePreview(null);
    }
    if (type === 'audio') setAudioFile(null);
    if (type === 'video') setVideoFile(null);
    if (type === 'code') {
      setCodeSnippet('');
      setCodeLang('lua');
    }
    if (type === 'mix') {
      setAttachedMixUrl('');
      setAttachedMixId(null);
    }
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      const buzz = await createBuzz(user.id, body.trim(), {
        imageFile: imageFile ?? undefined,
        audioFile: audioFile ?? undefined,
        videoFile: videoFile ?? undefined,
        codeSnippet: codeSnippet.trim() || undefined,
        codeLanguage: codeSnippet.trim() ? codeLang : undefined,
        attachedMixId: attachedMixId ?? undefined,
      });
      if (buzz) {
        onBuzzCreated?.(buzz);
        setBody('');
        setImageFile(null);
        setImagePreview(null);
        setAudioFile(null);
        setVideoFile(null);
        setCodeSnippet('');
        setAttachedMixId(null);
        setAttachedMixUrl('');
        setToast({ open: true, message: 'Buzz posted!', tone: 'success' });
      }
    } catch {
      setToast({ open: true, message: 'Failed to post buzz', tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          padding: `${space[7]}px ${space[9]}px`,
          marginBottom: space[7],
          textAlign: 'center',
        }}
      >
        <span style={{ color: colors.text.dim, fontSize: fontSize.base }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.accent,
              cursor: 'pointer',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.base,
            }}
          >
            {t('signIn')}
          </button>{' '}
          to post a Buzz
        </span>
      </div>
    );
  }

  const avatarInitial = (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase();
  const countColor =
    remaining <= 0 ? colors.danger : remaining <= 20 ? colors.warning : colors.text.dim;

  return (
    <>
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          padding: `${space[7]}px ${space[9]}px`,
          marginBottom: space[7],
        }}
      >
        <div style={{ display: 'flex', gap: space[7] }}>
          {/* Avatar */}
          <div
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: colors.accentFaint,
              border: `2px solid ${colors.border}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: fontWeight.bold,
              color: colors.accent,
            }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="You"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              avatarInitial
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Text area */}
            <textarea
              ref={textareaRef}
              value={body}
              onChange={e => setBody(e.target.value.slice(0, MAX_CHARS + 10))}
              placeholder={placeholder}
              rows={3}
              aria-label={t('buzzText')}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: colors.text.primary,
                fontSize: fontSize.md,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />

            {/* Attachment previews */}
            {imagePreview && (
              <div
                style={{
                  position: 'relative',
                  marginBottom: space[4],
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  maxHeight: 200,
                }}
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => clearAttachment('image')}
                  aria-label={t('removeImage')}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: colors.white,
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {audioFile && (
              <AttachBadge
                label={
                  <>
                    <Icon name="music" size={13} /> {audioFile.name}
                  </>
                }
                onRemove={() => clearAttachment('audio')}
              />
            )}
            {videoFile && (
              <AttachBadge
                label={`🎬 ${videoFile.name}`}
                onRemove={() => clearAttachment('video')}
              />
            )}
            {codeSnippet.trim() && (
              <AttachBadge
                label={`</> Code (${codeLang})`}
                onRemove={() => clearAttachment('code')}
              />
            )}
            {attachedMixId && (
              <AttachBadge
                label={
                  <>
                    <Icon name="headphones" size={13} /> Mix attached
                  </>
                }
                onRemove={() => clearAttachment('mix')}
              />
            )}

            {/* Bottom toolbar */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: space[3], marginTop: space[5] }}
            >
              <AttachButton
                label={t('s')}
                title={t('attachImage')}
                onClick={() => imageInputRef.current?.click()}
              />
              <AttachButton
                label={<Icon name="music" size={16} />}
                title={t('attachAudio')}
                onClick={() => audioInputRef.current?.click()}
              />
              <AttachButton
                label={t('s2')}
                title={t('attachVideo')}
                onClick={() => videoInputRef.current?.click()}
              />
              <AttachButton
                label={t('s3')}
                title={t('addCodeSnippet')}
                onClick={() => setActiveAttach('code')}
              />
              <AttachButton
                label={<Icon name="headphones" size={16} />}
                title={t('attachMix')}
                onClick={() => setActiveAttach('mix')}
              />

              <div style={{ flex: 1 }} />

              {/* Char count */}
              <span
                style={{
                  fontSize: fontSize.sm,
                  color: countColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {remaining < 60 ? remaining : ''}
              </span>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                loading={submitting}
                leftIcon={<Icon name="buzz" size={14} />}
                style={{ borderRadius: radius.pill }}
              >
                {t('buzz')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleAudioSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleVideoSelect}
      />

      {/* Code snippet modal */}
      <Modal
        open={activeAttach === 'code'}
        onClose={() => setActiveAttach(null)}
        title={t('addCodeSnippet')}
        width={560}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          <Select
            label={t('language')}
            value={codeLang}
            onChange={e => setCodeLang(e.target.value)}
            options={LANGUAGES.map(l => ({ value: l, label: l }))}
          />
          <Textarea
            label={t('code')}
            value={codeSnippet}
            onChange={e => setCodeSnippet(e.target.value)}
            rows={10}
            placeholder={t('pasteYourCodeHere')}
            style={{ fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[6] }}>
            <Button variant="secondary" onClick={() => setActiveAttach(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => setActiveAttach(null)} disabled={!codeSnippet.trim()}>
              {t('attach')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mix attach modal */}
      <Modal
        open={activeAttach === 'mix'}
        onClose={() => setActiveAttach(null)}
        title={t('attachAMix')}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
          <p style={{ margin: 0, color: colors.text.muted, fontSize: fontSize.base }}>
            {t('pasteAMixhiveMix')}
          </p>
          <Input
            hideLabel
            label={t('mixUrlOrId')}
            type="url"
            value={attachedMixUrl}
            onChange={e => {
              setAttachedMixUrl(e.target.value);
              setAttachedMixId(parseMixId(e.target.value));
            }}
            placeholder={t('httpsMixhiveAppMix')}
          />
          {attachedMixId && (
            <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.success }}>
              ✓ Mix ID detected: {attachedMixId.slice(0, 8)}…
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[6] }}>
            <Button variant="secondary" onClick={() => setActiveAttach(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => setActiveAttach(null)} disabled={!attachedMixId}>
              {t('attach')}
            </Button>
          </div>
        </div>
      </Modal>

      <BuzzToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </>
  );
}

function AttachButton({
  label,
  title,
  onClick,
}: {
  label: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-label={title}
      style={{
        background: 'none',
        border: 'none',
        color: colors.accent,
        cursor: 'pointer',
        fontSize: 16,
        padding: `${space[2]}px ${space[3]}px`,
        borderRadius: radius.md,
        transition: 'background 120ms',
        lineHeight: 1,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = colors.accentFaint;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'none';
      }}
    >
      {label}
    </button>
  );
}

function AttachBadge({ label, onRemove }: { label: ReactNode; onRemove: () => void }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[3],
        background: colors.accentFaint,
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.pill,
        padding: `${space[2]}px ${space[5]}px`,
        marginBottom: space[4],
        fontSize: fontSize.sm,
        color: colors.accent,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        aria-label={t('remove')}
        style={{
          background: 'none',
          border: 'none',
          color: colors.accent,
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
