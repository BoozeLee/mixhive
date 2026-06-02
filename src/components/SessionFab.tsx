'use client';

import React, { useState } from 'react';
import { HiveButton } from './hive/HiveButton';
import { StartMythicSessionModal } from './StartMythicSessionModal';

export function SessionFab() {
  const [isOpen, setIsOpen] = useState(false);

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
        <HiveButton
          variant="primary"
          onClick={() => setIsOpen(true)}
          style={{
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            padding: '12px 20px',
          }}
        >
          + Start Mythic Session
        </HiveButton>
      </div>

      <StartMythicSessionModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}