import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../ui/Icon';
import {
  colors,
  fontSize,
  fontWeight,
  radius,
  space,
  transition,
  withAlpha,
} from '../../styles/tokens';

interface AudioDropZoneProps {
  audioFile: File | null;
  duration: number | null;
  detectingDuration: boolean;
  onFileSelect: (file: File | null) => void;
}

export function AudioDropZone({
  audioFile,
  duration,
  detectingDuration,
  onFileSelect,
}: AudioDropZoneProps) {
  const t = useTranslations('upload');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onFileSelect(null);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={t('dropZoneAria')}
        onDragEnter={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={e => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
        }}
        style={{
          minHeight: 120,
          borderRadius: radius.lg,
          border: dragOver
            ? `2px solid ${colors.accent}`
            : audioFile
              ? `2px solid ${withAlpha(colors.accent, 0.33)}`
              : `1.5px dashed ${colors.surfaceHover}`,
          background: dragOver
            ? withAlpha(colors.accent, 0.08)
            : audioFile
              ? withAlpha(colors.accent, 0.03)
              : colors.surface,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space[3],
          cursor: 'pointer',
          padding: `${space[7]}px ${space[6]}px`,
          transition: `border-color ${transition.fast}, background ${transition.fast}`,
          textAlign: 'center',
          outline: 'none',
        }}
      >
        {audioFile ? (
          <>
            <span aria-hidden="true" style={{ lineHeight: 0, color: colors.accent }}>
              <Icon name="check" size={28} color="currentColor" />
            </span>
            <span
              style={{
                fontSize: fontSize.md,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: `0 ${space[4]}px`,
              }}
              title={audioFile.name}
            >
              {audioFile.name}
            </span>
            <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
              {(audioFile.size / 1024 / 1024).toFixed(1)} MB
              {duration &&
                !detectingDuration &&
                ` · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}
              {detectingDuration && ' · detecting duration…'}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                fontSize: fontSize.sm,
                color: colors.danger,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                marginTop: space[1],
              }}
            >
              {t('removeAudio')}
            </button>
          </>
        ) : (
          <>
            <span style={{ lineHeight: 0, color: dragOver ? colors.accent : colors.borderStrong }}>
              <Icon name="upload" size={30} color="currentColor" />
            </span>
            <span
              style={{
                fontSize: fontSize.md,
                fontWeight: fontWeight.semibold,
                color: dragOver ? colors.accent : colors.text.dim,
              }}
            >
              {dragOver ? t('dropIt') : t('dropHere')}
            </span>
            <span style={{ fontSize: fontSize.sm, color: colors.text.faintest }}>
              MP3, WAV, AIFF, FLAC
            </span>
          </>
        )}
      </div>
    </div>
  );
}
