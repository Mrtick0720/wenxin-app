'use client'

export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 72 : 56
  const bw  = size === 'sm' ? 1.5 : 2

  const ring = (inset: number, opacity: number, duration: string, reverse?: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset,
    borderRadius: '50%',
    border: `${bw}px solid transparent`,
    borderTopColor: '#FF7A1A',
    opacity,
    animation: `wenxin-spin ${duration} linear infinite ${reverse ? 'reverse' : ''}`,
  })

  return (
    <>
      <style>{`@keyframes wenxin-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ position: 'relative', width: dim, height: dim, flexShrink: 0 }}>
        <div style={ring(0,      1,    '1.1s')} />
        <div style={ring(dim * 8/56,  0.6,  '0.85s', true)} />
        <div style={ring(dim * 16/56, 0.35, '1.4s')} />
      </div>
    </>
  )
}

export function FullPageSpinner() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <Spinner size="lg" />
    </div>
  )
}

export function CenteredSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <Spinner />
    </div>
  )
}
