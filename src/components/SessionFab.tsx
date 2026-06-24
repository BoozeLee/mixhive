'use client';

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiveButton } from './hive/HiveButton';
import { StartMythicSessionModal } from './StartMythicSessionModal';
import { colors } from '../styles/tokens';

export function SessionFab() {
  const [isOpen, setIsOpen] = useState(false);
  if (process.env.NEXT_PUBLIC_MYTHIC_RITUALS_ENABLED === 'false') return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1100,
        }}
      >
        <Link
          to="/rituals"
          style={{
            display: 'block',
            textAlign: 'center',
            color: colors.accentBright,
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          Live rituals
        </Link>
        <HiveButton
          variant="primary"
          onClick={() => setIsOpen(true)}
          style={{
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            padding: '12px 20px',
          }}
        >
          + Start Mythic Ritual
        </HiveButton>
      </div>

      <StartMythicSessionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
