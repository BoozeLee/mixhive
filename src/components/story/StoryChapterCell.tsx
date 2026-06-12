import React from 'react';
import { Icon } from '../ui/Icon';
import type { IconKey } from '../../lib/icons';
import { HexCell } from '@/components/HexCell';
import { colors, fontSize } from '@/styles/tokens';

const CHAPTER_ICONS: Record<string, IconKey> = {
  collab: 'quests',
  gig: 'vocalist',
  gig_proof: 'verified',
  opportunity: 'events',
  quest: 'sparkles',
  set: 'headphones',
  quest_backing: 'mythic',
  other: 'sparkles',
};

export interface StoryChapter {
  chapter_type: string;
  label: string;
  date: string;
  is_chapter: boolean;
  props: Record<string, unknown> | null;
}

interface StoryChapterCellProps {
  chapter: StoryChapter;
  selected?: boolean;
  onClick?: () => void;
}

function formatDate(iso: string, size: 'lg' | 'sm'): string {
  const d = new Date(iso);
  if (size === 'sm') {
    return d.getFullYear().toString();
  }
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function StoryChapterCell({ chapter, selected, onClick }: StoryChapterCellProps) {
  const size = chapter.is_chapter ? 'lg' : 'sm';
  const icon = (
    <Icon name={CHAPTER_ICONS[chapter.chapter_type] ?? 'sparkles'} size={16} color="currentColor" />
  );
  const dateLabel = formatDate(chapter.date, size);

  return (
    <HexCell
      variant="chapter"
      size={size}
      icon={icon}
      label={chapter.is_chapter ? chapter.label : undefined}
      date={dateLabel}
      genre={undefined}
      selected={selected}
      onClick={onClick}
      aria-label={`${chapter.label} — ${dateLabel}`}
    />
  );
}
