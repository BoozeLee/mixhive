import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';
import { colors } from '../../styles/tokens';

interface ToasterProps {
  position?:
    | 'top-right'
    | 'top-center'
    | 'top-left'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left';
}

export function Toaster({ position = 'top-right' }: ToasterProps) {
  return (
    <HotToaster
      position={position}
      toastOptions={{
        className: 'toast-enter',
        style: {
          background: colors.surfaceMuted,
          border: `1px solid ${colors.accent}`,
          color: colors.white,
        },
      }}
    />
  );
}
