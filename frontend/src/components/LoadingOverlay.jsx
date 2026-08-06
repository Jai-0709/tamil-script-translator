import { useState, useEffect } from 'react'

export default function LoadingOverlay({ message, tamilMessage }) {
  const [activeGlyphIdx, setActiveGlyphIdx] = useState(0)
  const tamilGlyphs = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஃ']

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveGlyphIdx(prev => (prev + 1) % tamilGlyphs.length)
    }, 180)
    return () => clearInterval(timer)
  }, [tamilGlyphs.length])

  let taText = tamilMessage
  if (!taText) {
    if (message?.toLowerCase().includes('re-analys')) {
      taText = 'மீண்டும் பகுப்பாய்வு செய்யப்படுகிறது…'
    } else if (message?.toLowerCase().includes('segment')) {
      taText = 'கல்வெட்டு எழுத்துப் பகுப்பாய்வு…'
    } else {
      taText = 'கல்வெட்டு ஆய்வு செய்யப்படுகிறது…'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(8, 9, 13, 0.86)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      gap: 20,
      userSelect: 'none',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {/* Top ambient progress shimmer bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden'
      }}>
        <div style={{
          width: '45%', height: '100%',
          background: 'linear-gradient(90deg, transparent 0%, var(--copper) 50%, transparent 100%)',
          animation: 'shimmer 1.5s infinite linear'
        }} />
      </div>

      {/* Central Creative Epigraphic Emblem Spinner */}
      <div style={{
        position: 'relative',
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Outer Counter-Rotating Ring */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: '2px dashed rgba(249, 115, 22, 0.4)',
          animation: 'spinReverse 4s linear infinite',
        }} />

        {/* Inner Glowing Copper Spinner Ring */}
        <div style={{
          position: 'absolute', inset: 6,
          borderRadius: '50%',
          border: '2.5px solid transparent',
          borderTopColor: 'var(--copper)',
          borderRightColor: 'var(--copper-light)',
          animation: 'spin 0.9s linear infinite',
          boxShadow: '0 0 20px rgba(249, 115, 22, 0.25)',
        }} />

        {/* Central Ancient Tamil Character Emblem */}
        <span className="tamil" style={{
          fontSize: 36,
          fontWeight: 800,
          color: 'var(--copper-light)',
          fontFamily: '"Noto Serif Tamil", "Noto Sans Tamil", serif',
          textShadow: '0 0 16px rgba(249, 115, 22, 0.6)',
          animation: 'pulseSlow 1.5s ease-in-out infinite alternate',
        }}>
          {tamilGlyphs[activeGlyphIdx]}
        </span>
      </div>

      {/* Status Typography Block */}
      <div style={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '0 24px',
        maxWidth: 480,
      }}>
        {/* Primary Tamil Epigraphic Text */}
        <h3 className="tamil" style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--copper-light)',
          margin: 0,
          lineHeight: 1.3,
          fontFamily: '"Noto Serif Tamil", "Noto Sans Tamil", serif',
          letterSpacing: '0.02em',
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
        }}>
          {taText}
        </h3>

        {/* English Uppercase Subtitle */}
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--fg-3)',
          margin: 0,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          {message || 'Deciphering & Segmenting Inscription…'}
        </p>

        {/* Tamil Glyph Pulse Scanner Row */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 6,
          padding: '6px 14px',
          background: 'var(--surface-2)',
          borderRadius: 20,
          border: '1px solid var(--line)',
        }}>
          {tamilGlyphs.map((glyph, idx) => (
            <span
              key={idx}
              className="tamil"
              style={{
                fontSize: 13,
                fontWeight: idx === activeGlyphIdx ? 700 : 400,
                color: idx === activeGlyphIdx ? 'var(--copper-light)' : 'var(--fg-4)',
                opacity: idx === activeGlyphIdx ? 1 : 0.4,
                transition: 'all 0.15s ease',
                transform: idx === activeGlyphIdx ? 'scale(1.25)' : 'scale(1)',
              }}
            >
              {glyph}
            </span>
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinReverse { to { transform: rotate(-360deg); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @keyframes pulseSlow { 0% { opacity: 0.7; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1.04); } }
      `}</style>
    </div>
  )
}
