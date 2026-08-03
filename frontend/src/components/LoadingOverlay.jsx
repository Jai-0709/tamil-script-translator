export default function LoadingOverlay({ message }) {
  return (
    <>
      {/* Top progress line */}
      <div className="loading-line-track">
        <div className="loading-line-fill" />
      </div>

      {/* Centered status text */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 10, 10, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        gap: 12,
      }}>
        {/* Thin animated ring */}
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
          style={{ flexShrink: 0 }}>
          <circle cx="20" cy="20" r="16"
            stroke="var(--surface-4)" strokeWidth="2" />
          <path d="M20 4 a16 16 0 0 1 16 16"
            stroke="var(--copper)" strokeWidth="2" strokeLinecap="round"
            style={{ animation: 'spin 0.9s linear infinite', transformOrigin: '20px 20px' }}
          />
        </svg>

        <p className="label" style={{ color: 'var(--fg-3)', letterSpacing: '0.12em' }}>
          {message || 'Analysing inscription'}
        </p>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  )
}
