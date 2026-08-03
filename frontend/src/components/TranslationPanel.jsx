import { useRef, useEffect, useState } from 'react'

export default function TranslationPanel({
  words,
  hoveredWordId,
  onWordHover,
  threshold = 0,
  corrections = {},
  onWordClick,
}) {
  const listRef  = useRef(null)
  const itemRefs = useRef({})
  const [gridMode, setGridMode] = useState('auto') // 'auto', 3, 4, 5

  const lineGroups = {}
  for (const w of words) {
    if (!lineGroups[w.line]) lineGroups[w.line] = []
    lineGroups[w.line].push(w)
  }

  function getLineColumns(lineCount) {
    if (gridMode !== 'auto') {
      return `repeat(${gridMode}, 1fr)`
    }
    // Auto Mode: Adapt rows & columns dynamically based on line character size
    if (lineCount >= 10) return 'repeat(5, 1fr)' // long line -> 5 columns per row
    if (lineCount >= 6)  return 'repeat(4, 1fr)' // medium line -> 4 columns per row
    if (lineCount >= 3)  return 'repeat(3, 1fr)' // standard line -> 3 columns per row
    return `repeat(${Math.max(1, lineCount)}, 1fr)` // small line -> adapt to line count
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: 'var(--base)',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px',
        borderBottom: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface-2)',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="label" style={{ color: 'var(--copper)', letterSpacing: '0.06em' }}>
            Characters Breakdown
          </span>
          {words.length > 0 && (
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 99,
              background: 'var(--surface-3)', color: 'var(--fg-2)', fontWeight: 600,
            }}>
              {words.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Object.keys(corrections).length > 0 && (
            <span style={{ fontSize: 11, color: '#3da35d', fontWeight: 600, letterSpacing: '0.04em' }}>
              {Object.keys(corrections).length} fixed
            </span>
          )}
          
          {/* Dynamic Grid Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="label" style={{ color: 'var(--fg-4)', fontSize: 10 }}>Cols</span>
            <div style={{ display: 'flex', background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 5, padding: 1 }}>
              {['auto', 3, 4, 5].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setGridMode(opt)}
                  title={opt === 'auto' ? 'Auto-adapt 3, 4, or 5 columns depending on line character count' : `Force ${opt} columns`}
                  style={{
                    background: gridMode === opt ? 'var(--surface-4)' : 'transparent',
                    border: 'none',
                    color: gridMode === opt ? 'var(--copper-light)' : 'var(--fg-3)',
                    fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {opt === 'auto' ? 'Auto' : `${opt}c`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hint */}
      {words.length > 0 && (
        <div style={{
          flexShrink: 0,
          padding: '5px 14px',
          fontSize: 11, color: 'var(--fg-4)',
          borderBottom: '1px solid var(--line)',
        }}>
          Click character to correct · drag box edge to resize
        </div>
      )}

      {/* Dynamic Auto-Adaptive Grid List */}
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px' }}>
        {words.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 8, opacity: 0.3, userSelect: 'none',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
            <p style={{ fontSize: 12, color: 'var(--fg-3)' }}>No characters yet</p>
          </div>
        ) : (
          Object.keys(lineGroups).map(Number).sort((a, b) => a - b).map((ln) => {
            const lineWords = lineGroups[ln]
            const lineCols  = getLineColumns(lineWords.length)

            return (
              <div key={ln} style={{ marginBottom: 14 }}>
                {/* Line header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '3px 4px 8px',
                  fontSize: 10, fontWeight: 700, color: 'var(--fg-4)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  <div style={{ width: 3, height: 10, background: 'var(--copper)', borderRadius: 1.5 }} />
                  Line {ln} ({lineWords.length} chars)
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>

                {/* Dynamic Character Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: lineCols,
                  gap: 5,
                }}>
                  {lineWords.map((word) => {
                    const hovered     = word.id === hoveredWordId
                    const pct         = Math.round(word.confidence * 100)
                    const isLowConf   = pct < threshold
                    const isCorrected = corrections[word.id] !== undefined
                    const confColor   = isCorrected ? '#3da35d'
                                      : pct >= 80   ? '#3da35d'
                                      : pct >= 60   ? '#c0983a'
                                      : '#8e3b3b'

                    return (
                      <div
                        key={word.id}
                        ref={(el) => { itemRefs.current[word.id] = el }}
                        onMouseEnter={() => onWordHover?.(word.id)}
                        onMouseLeave={() => onWordHover?.(null)}
                        onClick={(e) => onWordClick?.(word.id, e.clientX, e.clientY)}
                        style={{
                          display: 'flex', flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '5px 6px',
                          borderRadius: 'var(--r-sm)',
                          background: hovered ? 'var(--surface-3)' : 'var(--surface-1)',
                          border: `1px solid ${hovered ? 'var(--copper-border)' : 'var(--line)'}`,
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all var(--dur-fast)',
                        }}
                      >
                        {/* Top row: ID badge & confidence pct */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 9, color: 'var(--fg-4)', fontWeight: 700 }}>
                            #{word.id}
                          </span>
                          <span style={{ fontSize: 9, color: confColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {pct}%
                          </span>
                        </div>

                        {/* Character symbol */}
                        <div style={{ textAlign: 'center', padding: '2px 0' }}>
                          <span className="tamil" style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: isCorrected ? 'var(--copper-light)' : 'var(--fg)',
                            lineHeight: 1.2,
                          }}>
                            {corrections[word.id] ?? word.modern_tamil ?? '?'}
                          </span>
                        </div>

                        {/* Confidence bar track */}
                        <div style={{
                          height: 3, borderRadius: 2,
                          background: 'var(--surface-3)',
                          overflow: 'hidden', marginTop: 3,
                        }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: confColor, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
