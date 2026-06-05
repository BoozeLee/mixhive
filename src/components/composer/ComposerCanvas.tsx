import React, { useEffect, useRef, useState } from 'react';
import { HexCell } from '@/components/HexCell';
import { SuggestionCell, type Suggestion } from '@/components/composer/SuggestionCell';
import { colors } from '@/styles/tokens';

export interface TrackCell {
  mix_id: string;
  title: string;
  artist: string;
  genre: string | null;
  bpm: number | null;
  duration?: string;
  key_camelot?: string | null;
}

interface ComposerCanvasProps {
  tracks: TrackCell[];
  suggestions: Suggestion[];
  loadingSuggestions: boolean;
  dismissedIds: Set<string>;
  currentlyPlaying?: string;
  selectedId?: string;
  onAddTrack: () => void;
  onSelectTrack: (mix_id: string) => void;
  onAcceptSuggestion: (suggestion: Suggestion) => void;
  onDismissSuggestion: (mix_id: string) => void;
  onReorder: (from: number, to: number) => void;
}

export function ComposerCanvas({
  tracks,
  suggestions,
  loadingSuggestions,
  dismissedIds,
  currentlyPlaying,
  selectedId,
  onAddTrack,
  onSelectTrack,
  onAcceptSuggestion,
  onDismissSuggestion,
  onReorder,
}: ComposerCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragSrcIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Auto-scroll right when new tracks are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [tracks.length]);

  const lastTrack = tracks[tracks.length - 1];
  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.mix_id));

  const handleDragStart = (idx: number) => {
    dragSrcIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    if (dragSrcIdx.current !== null && dragSrcIdx.current !== idx) {
      onReorder(dragSrcIdx.current, idx);
    }
    dragSrcIdx.current = null;
  };

  const handleDragEnd = () => {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  };

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-label="Set composer"
      style={{
        overflowX: 'auto',
        overflowY: 'visible',
        padding: '24px 16px 40px',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: `${colors.border} transparent`,
      }}
    >
      {/* Hex grid row layout */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          gap: 8,
          minHeight: 180,
          position: 'relative',
        }}
      >
        {tracks.length === 0 ? (
          <HexCell variant="add" size="md" onClick={onAddTrack} aria-label="Add first track" />
        ) : (
          <>
            {tracks.map((track, idx) => (
              <React.Fragment key={track.mix_id}>
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 1,
                      background: dragOverIdx === idx ? colors.accent : colors.border,
                      flexShrink: 0,
                      transition: 'background 120ms',
                    }}
                  />
                )}
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    opacity: dragSrcIdx.current === idx ? 0.45 : 1,
                    outline: dragOverIdx === idx ? `2px solid ${colors.accent}` : 'none',
                    borderRadius: 8,
                    transition: 'opacity 120ms',
                  }}
                >
                  <HexCell
                    variant="track"
                    size="md"
                    title={track.title}
                    artist={track.artist}
                    genre={track.genre ?? undefined}
                    bpm={track.bpm ?? undefined}
                    duration={track.duration}
                    playing={currentlyPlaying === track.mix_id}
                    selected={selectedId === track.mix_id}
                    onClick={() => onSelectTrack(track.mix_id)}
                    role="gridcell"
                    aria-selected={selectedId === track.mix_id}
                  />
                </div>
              </React.Fragment>
            ))}

            {/* Connector to suggestions */}
            {(visibleSuggestions.length > 0 || loadingSuggestions) && (
              <div
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 1,
                  background: colors.border,
                  flexShrink: 0,
                }}
              />
            )}

            {/* Suggestion cells */}
            {loadingSuggestions
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="skeleton"
                    style={{
                      width: 120,
                      height: 138,
                      borderRadius: 8,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                ))
              : visibleSuggestions.map(s => (
                  <SuggestionCell
                    key={s.mix_id}
                    suggestion={s}
                    lastBpm={lastTrack?.bpm}
                    onAccept={onAcceptSuggestion}
                    onDismiss={onDismissSuggestion}
                  />
                ))}

            {/* Add cell at the end */}
            <HexCell variant="add" size="md" onClick={onAddTrack} aria-label="Add another track" />
          </>
        )}
      </div>
    </div>
  );
}
