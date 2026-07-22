/**
 * CorrectionPopover
 *
 * Appears when the user clicks a bounding box in the Detection View.
 * Shows top-3 model predictions and a manual text input.
 * Calls onCorrect(wordId, newChar) when user confirms.
 */
export default function CorrectionPopover({ word, position, onCorrect, onClose }) {
  if (!word) return null

  const top3 = word.top3 || []

  function handleKey(e) {
    if (e.key === 'Escape') onClose()
  }

  return (
    <>
      {/* Click-outside backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
        }}
      />

      {/* Popover panel */}
      <div
        onKeyDown={handleKey}
        style={{
          position: 'fixed',
          left:  Math.min(position.x, window.innerWidth  - 280),
          top:   Math.min(position.y, window.innerHeight - 260),
          zIndex: 1000,
          width: 270,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '10px 14px 8px',
          background: 'var(--bg-card-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            ✏️ Correct Character #{word.id}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 2,
          }}>×</button>
        </div>

        <div style={{ padding: '12px 14px' }}>

          {/* Current prediction */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Current Prediction
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.25)',
            }}>
              <span className="tamil-text" style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
                {word.modern_tamil}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {Math.round(word.confidence * 100)}% confidence
              </span>
            </div>
          </div>

          {/* Ambiguous NLP Options */}
          {word.ambiguous_options && word.ambiguous_options.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Contextual Alternatives (Same Shape)
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {word.ambiguous_options.map((alt, i) => {
                  const isCurrent = alt === word.modern_tamil;
                  return (
                    <button
                      key={i}
                      onClick={() => { if (!isCurrent) { onCorrect(word.id, alt); onClose(); } }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '6px 12px', borderRadius: 8, cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? 'rgba(249,115,22,0.1)' : 'var(--bg-card-3)',
                        border: `1px solid ${isCurrent ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
                        transition: 'background 0.1s',
                        minWidth: 50,
                      }}
                      title={isCurrent ? "Currently selected by NLP Engine" : `Override NLP and select ${alt}`}
                    >
                      <span className="tamil-text" style={{ fontSize: 22, fontWeight: 700,
                        color: isCurrent ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {alt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top-3 alternatives */}
          {top3.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Model Alternatives — click to select
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {top3.map((alt, i) => (
                  <button
                    key={i}
                    onClick={() => { onCorrect(word.id, alt.modern_tamil); onClose() }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      background: i === 0 ? 'rgba(249,115,22,0.1)' : 'var(--bg-card-3)',
                      border: `1px solid ${i === 0 ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
                      transition: 'background 0.1s',
                      minWidth: 60,
                    }}
                    title={`Select ${alt.modern_tamil} (${Math.round(alt.confidence * 100)}%)`}
                  >
                    <span className="tamil-text" style={{ fontSize: 22, fontWeight: 700,
                      color: i === 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {alt.modern_tamil}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual input */}
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Type custom character
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                autoFocus
                className="tamil-text"
                maxLength={4}
                placeholder="அ"
                defaultValue={word.modern_tamil}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = e.target.value.trim()
                    if (v) { onCorrect(word.id, v); onClose() }
                  }
                }}
                style={{
                  flex: 1, background: 'var(--bg-card-3)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text-primary)', fontSize: 18,
                  padding: '5px 10px', outline: 'none',
                  fontFamily: 'inherit',
                }}
                id={`correction-input-${word.id}`}
              />
              <button
                onClick={() => {
                  const el = document.getElementById(`correction-input-${word.id}`)
                  const v = el?.value.trim()
                  if (v) { onCorrect(word.id, v); onClose() }
                }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✓ Set
              </button>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
              Press Enter or click ✓ Set. Press Esc to cancel.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
