import { useEffect, useRef } from 'react'

/**
 * CorrectionPopover
 * macOS-style floating context panel — hairline border, tight padding,
 * auto-positioning above/below click to prevent screen bottom/taskbar clipping.
 */
export default function CorrectionPopover({ word, position, onCorrect, onClose, onForgetMemory, onRemoveBox, onSplitBox }) {
  if (!word) return null

  const top3 = word.top3 || []

  function handleKey(e) {
    if (e.key === 'Escape') onClose()
  }

  const POPOVER_WIDTH  = 272
  const POPOVER_HEIGHT = 440

  const isMobile = window.innerWidth <= 480

  // Horizontal clamping: keep inside viewport with 16px margin
  const panelX = isMobile ? '50%' : Math.max(16, Math.min(position.x, window.innerWidth - POPOVER_WIDTH - 16))

  // Vertical clamping: if click is near bottom, position ABOVE click or clamp to top margin
  let panelY = isMobile ? '50%' : position.y
  if (!isMobile && position.y + POPOVER_HEIGHT > window.innerHeight - 20) {
    panelY = Math.max(16, position.y - POPOVER_HEIGHT - 10)
    if (panelY + POPOVER_HEIGHT > window.innerHeight - 16) {
      panelY = Math.max(16, window.innerHeight - POPOVER_HEIGHT - 16)
    }
  }

  return (
    <>
      {/* Click-outside backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: isMobile ? 'rgba(0,0,0,0.5)' : 'transparent' }} />

      {/* Popover panel */}
      <div
        onKeyDown={handleKey}
        style={{
          position: 'fixed',
          left: panelX,
          top: panelY,
          transform: isMobile ? 'translate(-50%, -50%)' : 'none',
          zIndex: 1000,
          width: isMobile ? '90vw' : POPOVER_WIDTH,
          maxWidth: 320,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-2)',
          border: '1px solid var(--line-strong)',
          borderRadius: 'var(--r-md)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'popIn 0.14s ease-out both',
        }}
      >
        <style>{`
          @keyframes popIn {
            from { opacity: 0; transform: scale(0.96) translateY(-4px); }
            to   { opacity: 1; transform: scale(1)    translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{
          flexShrink: 0,
          padding: '10px 14px 8px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-3)',
        }}>
          <span className="label" style={{ color: 'var(--copper)', fontWeight: 700 }}>
            Character #{word.id}
          </span>
          <button
            className="btn-ghost"
            onClick={onClose}
            style={{ padding: '2px 6px', fontSize: 16, lineHeight: 1, color: 'var(--fg-3)' }}
          >
            ×
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>

          {/* Current prediction */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: 'var(--surface-3)',
            borderRadius: 'var(--r-sm)',
            marginBottom: 12,
            border: '1px solid var(--line)',
          }}>
            <span className="tamil" style={{ fontSize: 28, fontWeight: 600, color: 'var(--copper-light)' }}>
              {word.modern_tamil}
            </span>
            <div>
              <div style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 500 }}>
                {Math.round(word.confidence * 100)}% confidence
              </div>
              {word.is_memorized && (
                <div style={{ fontSize: 11, color: '#3da35d', marginTop: 1, fontWeight: 600 }}>Memorised</div>
              )}
            </div>
            {word.is_memorized && onForgetMemory && (
              <button
                className="btn-ghost"
                onClick={() => { onForgetMemory(word.id); onClose() }}
                style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Contextual options */}
          {word.ambiguous_options && word.ambiguous_options.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6, color: 'var(--fg-4)' }}>Contextual options</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {word.ambiguous_options.map((alt, i) => {
                  const active = alt === word.modern_tamil
                  return (
                    <button
                      key={i}
                      onClick={() => { if (!active) { onCorrect(word.id, alt); onClose() } }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 'var(--r-sm)',
                        cursor: active ? 'default' : 'pointer',
                        background: active ? 'var(--copper-dim)' : 'var(--surface-3)',
                        border: `1px solid ${active ? 'var(--copper-border)' : 'var(--line)'}`,
                        transition: 'background var(--dur-fast)',
                      }}
                    >
                      <span className="tamil" style={{ fontSize: 20, fontWeight: 600, color: active ? 'var(--copper-light)' : 'var(--fg)' }}>
                        {alt}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top-3 model alternatives */}
          {top3.length > 1 && (
            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6, color: 'var(--fg-4)' }}>Model alternatives</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {top3.map((alt, i) => (
                  <button
                    key={i}
                    onClick={() => { onCorrect(word.id, alt.modern_tamil); onClose() }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--r-sm)',
                      cursor: 'pointer',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--line)',
                    }}
                    title={`${Math.round(alt.confidence * 100)}% confidence`}
                  >
                    <span className="tamil" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>
                      {alt.modern_tamil}
                    </span>
                    <div style={{ fontSize: 10, color: 'var(--fg-3)', textAlign: 'center', marginTop: 2 }}>
                      {Math.round(alt.confidence * 100)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual input */}
          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6, color: 'var(--fg-4)' }}>Custom character</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                className="input tamil"
                maxLength={4}
                placeholder="அ"
                defaultValue={word.modern_tamil}
                id={`cp-input-${word.id}`}
                style={{ fontSize: 18 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = e.target.value.trim()
                    if (v) { onCorrect(word.id, v); onClose() }
                  }
                }}
              />
              <button
                className="btn-primary"
                style={{ padding: '0 14px', fontSize: 13, flexShrink: 0 }}
                onClick={() => {
                  const el = document.getElementById(`cp-input-${word.id}`)
                  const v = el?.value.trim()
                  if (v) { onCorrect(word.id, v); onClose() }
                }}
              >
                Set
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 4 }}>
              Enter to confirm · Esc to dismiss
            </div>
          </div>

          {/* Destructive / Structural actions */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {onSplitBox && (
              <button
                className="btn-secondary"
                onClick={() => { onSplitBox(word.id); onClose() }}
                style={{ fontSize: 12, width: '100%', justifyContent: 'center', color: 'var(--copper)' }}
              >
                Split Bounding Box
              </button>
            )}
            {onRemoveBox && (
              <button
                className="btn-ghost"
                onClick={() => { onRemoveBox(word.id); onClose() }}
                style={{ fontSize: 12, color: '#8e3b3b', width: '100%', justifyContent: 'center' }}
              >
                Delete Bounding Box
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
