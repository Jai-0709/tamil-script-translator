export default function LoadingOverlay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(7, 7, 9, 0.85)',
      backdropFilter: 'blur(6px)',
    }}>
      {/* Animated ring */}
      <div style={{ position: 'relative', width: 56, height: 56, marginBottom: 22 }}>
        <svg
          className="spinner"
          width="56" height="56" viewBox="0 0 56 56" fill="none"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <circle cx="28" cy="28" r="24" stroke="var(--border-light)" strokeWidth="3"/>
          <path
            d="M28 4 a24 24 0 0 1 24 24"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>🪨</div>
      </div>

      {/* Tamil text */}
      <p className="tamil-text" style={{
        fontSize: 18, fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: 6,
      }}>
        பகுப்பாய்வு செய்கிறது...
      </p>

      {/* Sub text */}
      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        Detecting and classifying words…
      </p>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 5, marginTop: 20 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--accent)',
            animation: `pulse-ring 1.2s ${i * 0.2}s ease-in-out infinite`,
            opacity: 0.7,
          }}/>
        ))}
      </div>
    </div>
  )
}
