'use client';

import React from 'react';
import { colors, fontSize, space, transition } from '@/styles/tokens';

export interface FlowKeyGlyphProps {
  capped: number;
  skipped: number;
  isOpen: boolean;
  canTurn: boolean;
  busy?: boolean;
  onTurn: () => void;
}

const SIZE = 28;
// Flat-top hexagon, matching the hive language elsewhere in the app.
const POINTS = '25,2 75,2 98,50 75,98 25,98 2,50';

function Hexagon({ open }: { open: boolean }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className="flow-key-hex"
      style={{
        // The 90-degree turn. Under reduced motion the rotation is suppressed
        // and the split line alone carries the state change.
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: `transform ${transition.base}`,
        flexShrink: 0,
      }}
    >
      <polygon
        points={POINTS}
        fill={open ? colors.accent : 'transparent'}
        stroke={open ? colors.accent : colors.border}
        strokeWidth={6}
      />
      {open && <line x1="50" y1="8" x2="50" y2="92" stroke={colors.bg} strokeWidth={8} />}
      {/* Scoped here rather than in mixhive.css, which is Codex-owned infra. */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .flow-key-hex { transition: none !important; transform: none !important; }
        }
      `}</style>
    </svg>
  );
}

export function FlowKeyGlyph({
  capped,
  skipped,
  isOpen,
  canTurn,
  busy = false,
  onTurn,
}: FlowKeyGlyphProps) {
  const total = capped + skipped;
  const label = isOpen
    ? 'Flow Key turned — comb draining'
    : capped === 0
      ? "Flow Key — nothing's capped yet"
      : `Turn the Flow Key — ${capped} of ${total} cells capped`;

  const wrap: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space[2],
    fontSize: fontSize.xs,
    color: colors.text.muted,
    minWidth: 0,
  };

  const readout = isOpen ? 'draining' : capped === 0 ? 'nothing capped' : `${capped}/${total}`;

  if (!canTurn) {
    return (
      <span role="status" aria-live="polite" style={wrap}>
        <Hexagon open={isOpen} />
        <span>{label}</span>
      </span>
    );
  }

  const disabled = busy || isOpen || capped === 0;

  return (
    <button
      type="button"
      onClick={onTurn}
      disabled={disabled}
      aria-label={label}
      style={{
        ...wrap,
        background: 'transparent',
        border: 'none',
        padding: space[2],
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <Hexagon open={isOpen} />
      <span aria-hidden="true">{readout}</span>
    </button>
  );
}
