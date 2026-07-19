'use client';

import { useRef } from 'react';
import { colors, fontSize, radius, space } from '../../styles/tokens';
import { IconButton } from '../ui/IconButton';

export interface ReferenceImage {
  id: string;
  file: File;
  url: string;
  weight: number;
}

export function ReferenceImageDropzone({
  images,
  onImagesChange,
}: {
  images: ReferenceImage[];
  onImagesChange: (imgs: ReferenceImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const maxImages = 4;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxImages - images.length;
    const next: ReferenceImage[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      next.push({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        weight: 1.0,
      });
    }
    if (next.length > 0) onImagesChange([...images, ...next]);
  }

  function remove(id: string) {
    const img = images.find(i => i.id === id);
    if (img) URL.revokeObjectURL(img.url);
    onImagesChange(images.filter(i => i.id !== id));
  }

  function setWeight(id: string, weight: number) {
    onImagesChange(images.map(i => (i.id === id ? { ...i, weight } : i)));
  }

  return (
    <div>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: space[4],
        }}
      >
        Reference images ({images.length}/{maxImages})
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
        {images.map(img => (
          <div
            key={img.id}
            style={{
              width: 120,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              overflow: 'hidden',
              background: colors.surface,
            }}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={img.url}
                alt="Reference"
                style={{
                  width: '100%',
                  height: 100,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <button
                type="button"
                onClick={() => remove(img.id)}
                aria-label="Remove reference"
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: 'rgba(0,0,0,0.7)',
                  color: colors.text.primary,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '6px 8px' }}>
              <label
                style={{
                  fontSize: 10,
                  color: colors.text.dim,
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                Weight: {img.weight.toFixed(1)}
              </label>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={img.weight}
                onChange={e => setWeight(img.id, Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.accent }}
                aria-label={`Weight for reference image`}
              />
            </div>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: 120,
              height: 134,
              border: `2px dashed ${colors.border}`,
              borderRadius: radius.lg,
              background: 'transparent',
              color: colors.text.dim,
              fontSize: fontSize.sm,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 24 }}>+</span>
            <span>Add</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    </div>
  );
}
