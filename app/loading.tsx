// Branded loading screen shown while the home page fetches its data, so a slow
// cold start shows the Wenxin gold splash instead of a blank/black screen.
export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: '#C9A84C',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        zIndex: 200,
      }}
    >
      <div
        style={{
          fontFamily: 'STSong, SimSun, serif',
          fontWeight: 700,
          fontSize: '4.5rem',
          lineHeight: 1.05,
          color: '#ffffff',
          textAlign: 'center',
          letterSpacing: '0.05em',
          animation: 'wenxinSplashPulse 1.4s ease-in-out infinite',
        }}
      >
        文<br />心
      </div>
      <style>{`
        @keyframes wenxinSplashPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}
