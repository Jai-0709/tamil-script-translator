import { useRef, useEffect } from 'react'

function wordColor(id) {
  return `hsl(${(id * 47) % 360}, 70%, 60%)`
}

export default function TranslationPanel({
  words, hoveredWordId, onWordHover,
  threshold = 0,
  corrections = {},
  onWordClick,
  onRemoveBox,
  onAddBoxClick,
  isAddingBox = false,
}) {
  const listRef  = useRef(null)
  const itemRefs = useRef({})

  useEffect(() => {
    if (hoveredWordId == null) return
    const el = itemRefs.current[hoveredWordId]
    if (el && listRef.current) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [hoveredWordId])

  // Group by line
  const lineGroups = {}
  for (const w of words) {
    if (!lineGroups[w.line]) lineGroups[w.line] = []
    lineGroups[w.line].push(w)
  }

  const belowThreshold = words.filter(w => Math.round(w.confidence * 100) < threshold).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-primary)' }}>
      {/* Sticky header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '12px 18px',
        background: '#0e1017',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.08em'
        }}>
          Character Breakdown
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onAddBoxClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, padding: '3px 9px', borderRadius: 6,
              background: isAddingBox ? 'var(--accent)' : 'rgba(249, 115, 22, 0.15)',
              color: isAddingBox ? '#000' : 'var(--accent)',
              border: '1px solid rgba(249, 115, 22, 0.4)', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            {isAddingBox ? '✏️ Drag on Image...' : '➕ Add Box'}
          </button>
          {belowThreshold > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 600,
            }}>
              {belowThreshold} low confidence
            </span>
          )}
          {Object.keys(corrections).length > 0 && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
              border: '1px solid rgba(34, 197, 94, 0.2)', fontWeight: 600,
            }}>
              {Object.keys(corrections).length} corrected
            </span>
          )}
          {words.length > 0 && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(249, 115, 22, 0.12)', color: 'var(--accent)',
              border: '1px solid rgba(249, 115, 22, 0.25)', fontWeight: 700,
            }}>
              {words.length} items
            </span>
          )}
        </div>
      </div>

      {/* Click-to-correct hint */}
      {words.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '6px 18px',
          fontSize: 10, color: 'var(--text-secondary)',
          background: 'rgba(255, 255, 255, 0.015)',
          borderBottom: '1px solid var(--border)',
        }}>
          Click any character below to view details or apply manual corrections
        </div>
      )}

      {/* Scrollable list */}
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px' }}>
        {words.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 12, opacity: 0.35, userSelect: 'none',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>🔤</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              Character recognition stream will populate here
            </p>
          </div>
        ) : (
          Object.keys(lineGroups).map(Number).sort((a, b) => a - b).map((ln) => (
            <div key={ln} style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '4px 6px 8px',
              }}>
                <div style={{ width: 3, height: 12, borderRadius: 2, background: 'var(--accent)' }} />
                Line {ln} ({lineGroups[ln].length} characters)
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {lineGroups[ln].map((word) => {
                const color        = wordColor(word.id)
                const hovered      = word.id === hoveredWordId
                const pct          = Math.round(word.confidence * 100)
                const isLowConf    = pct < threshold
                const isCorrected  = corrections[word.id] !== undefined
                const confColor    = isCorrected ? '#22c55e'
                                   : pct >= 80   ? '#22c55e'
                                   : pct >= 60   ? '#eab308'
                                   : '#ef4444'

                return (
                  <div
                    key={word.id}
                    ref={(el) => { itemRefs.current[word.id] = el }}
                    onMouseEnter={() => onWordHover(word.id)}
                    onMouseLeave={() => onWordHover(null)}
                    onClick={(e) => onWordClick?.(word.id, e.clientX, e.clientY)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10, marginBottom: 4,
                      cursor: 'pointer',
                      opacity: isLowConf ? 0.45 : 1,
                      background: hovered ? 'rgba(255, 255, 255, 0.05)' : word.is_memorized ? 'rgba(34, 197, 94, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                      borderTop: `1px solid ${hovered ? 'rgba(249, 115, 22, 0.35)' : isCorrected ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                      borderRight: `1px solid ${hovered ? 'rgba(249, 115, 22, 0.35)' : isCorrected ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                      borderBottom: `1px solid ${hovered ? 'rgba(249, 115, 22, 0.35)' : isCorrected ? 'rgba(34, 197, 94, 0.3)' : 'var(--border)'}`,
                      borderLeft: `4px solid ${
                        word.is_memorized ? '#22c55e'
                        : isCorrected ? '#22c55e'
                        : hovered   ? color
                        : isLowConf ? '#ef4444'
                        : 'rgba(255, 255, 255, 0.15)'
                      }`,
                      transition: 'all 0.15s ease',
                      transform: hovered ? 'translateX(2px)' : 'none',
                    }}
                  >
                    {/* Index badge */}
                    <span style={{
                      flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                      background: isCorrected ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isCorrected ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: isCorrected ? '#4ade80' : 'var(--text-secondary)',
                    }}>
                      #{word.id}
                    </span>

                    {/* Tamil character */}
                    <span className="tamil-text" style={{
                      flex: 1, fontSize: 24, fontWeight: 700, lineHeight: 1.2,
                      color: isLowConf ? '#f87171' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {word.modern_tamil || word.class_id}
                      {isCorrected && (
                        <span style={{ fontSize: 11, color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Fixed</span>
                      )}
                    </span>

                    {/* Confidence & Delete Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {word.is_memorized ? (
                          <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓</span>
                        ) : isCorrected ? (
                          <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>user override</span>
                        ) : (
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>cls {word.class_id}</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 44, height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: confColor, borderRadius: 3, transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: confColor, minWidth: 32, textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {onRemoveBox && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveBox(word.id)
                          }}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444', borderRadius: 6, width: 26, height: 26,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, cursor: 'pointer', opacity: 0.7,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)' }}
                          onMouseOut={(e) => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)' }}
                          title={`Delete Box #${word.id}`}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

