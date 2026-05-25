const shimmer = `
  @keyframes shimmer {
    0% { background-position: -200px 0; }
    100% { background-position: calc(200px + 100%) 0; }
  }
`

export function SkeletonBar({ width = '100%', height = 14, style }: {
  width?: string | number
  height?: number
  style?: React.CSSProperties
}) {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        width,
        height,
        borderRadius: 4,
        background: 'linear-gradient(90deg, #111 25%, #1a1a2e 50%, #111 75%)',
        backgroundSize: '200px 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }} />
    </>
  )
}

export function SkeletonCircle({ size = 36 }: { size?: number }) {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(90deg, #111 25%, #1a1a2e 50%, #111 75%)',
        backgroundSize: '200px 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        flexShrink: 0,
      }} />
    </>
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      padding: 14,
      background: '#0d0d0d',
      borderRadius: 10,
      border: '1px solid #111',
    }}>
      <SkeletonBar width={70} height={70} style={{ borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonBar width="70%" height={15} />
        <SkeletonBar width="40%" height={13} />
        <SkeletonBar width="50%" height={12} />
      </div>
    </div>
  )
}

export function SkeletonProfile() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
        <SkeletonCircle size={80} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBar width="50%" height={22} />
          <SkeletonBar width="30%" height={13} />
          <SkeletonBar width="80%" height={14} />
          <SkeletonBar width="40%" height={12} />
        </div>
      </div>
      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </div>
  )
}

export function SkeletonFeed() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, padding: 4 }}>
        {[1, 2, 3].map(i => (
          <SkeletonBar key={i} height={34} style={{ flex: 1, borderRadius: 8 }} />
        ))}
      </div>
      {[1, 2, 3, 4].map(i => <div key={i} style={{ marginBottom: 8 }}><SkeletonCard /></div>)}
    </div>
  )
}

export function SkeletonMixDetail() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <SkeletonBar width="100%" height={320} style={{ borderRadius: 12, marginBottom: 20 }} />
      <SkeletonBar width="60%" height={22} style={{ marginBottom: 8 }} />
      <SkeletonBar width="30%" height={14} style={{ marginBottom: 12 }} />
      <SkeletonBar width="100%" height={40} style={{ borderRadius: 10, marginBottom: 16 }} />
      <SkeletonBar width="40%" height={14} style={{ marginBottom: 24 }} />
      <SkeletonBar width="100%" height={80} style={{ borderRadius: 8 }} />
    </div>
  )
}
