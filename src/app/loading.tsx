import React from 'react';

export default function Loading() {
  return (
    <main className="hive-boot">
      <img
        src="/mixhive.png"
        alt="MixHive"
        style={{
          width: '120px',
          height: '120px',
          objectFit: 'contain',
        }}
      />
      <div className="hive-boot__scan" />
    </main>
  );
}
