import React from 'react';
import { HexCell } from '@/components/HexCell';
import { KeyChip } from '@/components/KeyChip';
import { colors, fontSize } from '@/styles/tokens';

export interface Suggestion {
  mix_id: string;
  title: string;
  artist: string;
  similarity: number;
  bpm: number | null;
  key_camelot: string | null;
  genre: string | null;
}

interface SuggestionCellProps {
  suggestion: Suggestion;
  lastBpm?: number | null;
  onAccept: (suggestion: Suggestion) => void;
  onDismiss: (mix_id: string) => void;
}

function bpmTransitionLabel(lastBpm: number, thisBpm: number): { label: string; color: string } {
  const diff = Math.abs(thisBpm - lastBpm);
  if (diff === 0) return { label: 'Same tempo', color: colors.success };
  if (diff <= 5) return { label: 'Easy transition', color: colors.accent };
  if (diff <= 15) return { label: 'Gradual build', color: colors.warning };
  return { label: `+${diff} BPM`, color: colors.text.dim };
}

function isCompatibleKey(a: string, b: string): boolean {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  const letA = a.slice(-1);
  const letB = b.slice(-1);
  if (isNaN(numA) || isNaN(numB)) return false;
  return letA === letB && Math.abs(numA - numB) <= 1;
}

export function SuggestionCell({ suggestion, lastBpm, onAccept, onDismiss }: SuggestionCellProps) {
  const bpmNote = lastBpm && suggestion.bpm ? bpmTransitionLabel(lastBpm, suggestion.bpm) : null;

  const keyCompatible = suggestion.key_camelot
    ? lastBpm
      ? isCompatibleKey(suggestion.key_camelot, String(lastBpm))
      : undefined
    : undefined;

  return (
    <div
      className="suggestion-enter"
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <HexCell
        variant="suggestion"
        size="md"
        title={suggestion.title}
        artist={suggestion.artist}
        genre={suggestion.genre ?? undefined}
        bpm={suggestion.bpm ?? undefined}
        similarity={suggestion.similarity}
        onClick={() => onAccept(suggestion)}
        onDismiss={() => onDismiss(suggestion.mix_id)}
      />
      <div
        style={{
          display: 'flex',
          gap: 4,
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {suggestion.key_camelot && (
          <KeyChip keyCamelot={suggestion.key_camelot} compatible={keyCompatible} />
        )}
        {bpmNote && (
          <span style={{ fontSize: fontSize.xs, color: bpmNote.color, whiteSpace: 'nowrap' }}>
            {bpmNote.label}
          </span>
        )}
      </div>
    </div>
  );
}
