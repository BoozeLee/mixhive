// Lightweight placeholder shown while a route chunk is loading. Matches
// the page's typical layout (centered column under the navbar) so the
// page doesn't jump when the chunk arrives.

export function RoutePending() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '40px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            height: 84,
            borderRadius: 10,
            background: 'linear-gradient(90deg, #111 0%, #1a1a2e 50%, #111 100%)',
            backgroundSize: '200% 100%',
            animation: 'mixhive-shimmer 1.4s ease-in-out infinite',
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
      <style>{`
        @keyframes mixhive-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
