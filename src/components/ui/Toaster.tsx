import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

interface ToasterProps {
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

export function Toaster({ position = 'top-right' }: ToasterProps) {
  return (
    <HotToaster
      position={position}
      toastOptions={{
        className: 'toast-enter',
        style: { background: '#0d0d0d', border: '1px solid #f0c040', color: '#fff' },
      }}
    />
  );
}
