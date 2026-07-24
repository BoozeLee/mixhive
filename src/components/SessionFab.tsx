'use client';

import { useState } from 'react';
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
          // Lift above the consent banner AND the bottom MobileNav so the fixed
          // bottom elements don't collide. --consent-banner-space is 0 once
          // consent is decided; --mobile-nav-space is 0 at ≥768px where the
          // bottom nav is replaced by the left sidebar.
          bottom: 'calc(24px + var(--consent-banner-space, 0px) + var(--mobile-nav-space, 0px))',
          right: 24,
          zIndex: 1100,
          transition: 'bottom 220ms cubic-bezier(0.22, 1, 0.36, 1)',
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
