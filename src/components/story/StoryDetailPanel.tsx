import React from 'react';
import { Icon } from '../ui/Icon';
import { colors, fontSize, fontWeight, radius, space } from '@/styles/tokens';
import type { StoryChapter } from '@/components/story/StoryChapterCell';

interface StoryDetailPanelProps {
  chapter: StoryChapter | null;
  onClose: () => void;
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function StoryDetailPanel({ chapter, onClose }: StoryDetailPanelProps) {
  if (!chapter) return null;

  const props = chapter.props ?? {};

  return (
    <div
      className="panel-enter"
      style={{
        width: 340,
        background: colors.surface,
        borderLeft: `1px solid ${colors.border}`,
        padding: space[10],
        display: 'flex',
        flexDirection: 'column',
        gap: space[8],
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          style={{
            margin: 0,
            fontSize: fontSize.md,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          Chapter detail
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chapter detail"
          style={{
            background: 'none',
            border: 'none',
            color: colors.text.dim,
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.text.primary,
        }}
      >
        {chapter.label}
      </p>

      <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.text.muted }}>
        {formatFullDate(chapter.date)}
      </p>

      {props.follower_count !== undefined && (
        <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.text.secondary }}>
          At this point: {String(props.follower_count)} followers
          {props.collab_count !== undefined && `, ${String(props.collab_count)} collabs`}
          {props.scene !== undefined && `, active in ${String(props.scene)} scene`}.
        </p>
      )}

      {chapter.chapter_type === 'gig' && (props.venue_name || props.city) && (
        <div
          style={{ padding: space[8], background: colors.surfaceHover, borderRadius: radius.md }}
        >
          <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.text.secondary }}>
            📍 {[props.venue_name, props.city].filter(Boolean).map(String).join(', ')}
          </p>
        </div>
      )}

      {chapter.chapter_type === 'collab' && props.collaborator_name && (
        <div
          style={{ padding: space[8], background: colors.surfaceHover, borderRadius: radius.md }}
        >
          <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.text.secondary }}>
            <Icon name="network" size={14} /> Collab with{' '}
            <strong style={{ color: colors.text.primary }}>
              {String(props.collaborator_name)}
            </strong>
          </p>
        </div>
      )}

      {chapter.chapter_type === 'set' && props.playlist_title && (
        <div
          style={{ padding: space[8], background: colors.surfaceHover, borderRadius: radius.md }}
        >
          <p style={{ margin: 0, fontSize: fontSize.sm, color: colors.text.secondary }}>
            <Icon name="headphones" size={14} /> {String(props.playlist_title)}
            {props.track_count !== undefined && (
              <span style={{ color: colors.text.dim }}> · {String(props.track_count)} tracks</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
