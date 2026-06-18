import { useRef, useEffect } from 'react'

function wordColor(id) {
  return `hsl(${(id * 47) % 360}, 70%, 60%)`
}

export default function TranslationPanel({ words, hoveredWordId, onWordHover }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sticky header */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Translation
        </span>
        {words.length > 0 && (
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: 'var(--accent-muted)', color: 'var(--accent)',
          }}>
            {words.length} words · {Object.keys(lineGroups).length} lines
          </span>
        )}
      </div>

      {/* Scrollable list */}
      <div ref={listRef} style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        padding: '8px 10px',
      }}>
        {words.length === 0 ? (
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10, opacity: 0.25,
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Translated words appear here
            </p>
          </div>
        ) : (
          Object.keys(lineGroups)
            .map(Number).sort((a, b) => a - b)
            .map((ln) => (
              <div key={ln} style={{ marginBottom: 6 }}>
                {/* Line label */}
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '4px 6px 2px',
                }}>
                  Line {ln}
                </div>

                {lineGroups[ln].map((word) => {
                  const color   = wordColor(word.id)
                  const hovered = word.id === hoveredWordId
                  const pct     = Math.round(word.confidence * 100)
                  const confColor = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)'

                  return (
                    <div
                      key={word.id}
                      ref={(el) => { itemRefs.current[word.id] = el }}
                      onMouseEnter={() => onWordHover(word.id)}
                      onMouseLeave={() => onWordHover(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '7px 10px',
                        borderRadius: 8,
                        marginBottom: 2,
                        cursor: 'pointer',
                        background: hovered ? 'var(--bg-card-2)' : 'transparent',
                        borderLeft: `3px solid ${hovered ? color : 'transparent'}`,
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                    >
                      {/* Color badge */}
                      <span style={{
                        flexShrink: 0,
                        width: 26, height: 26,
                        borderRadius: '50%',
                        background: color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: '#000',
                      }}>
                        {word.id}
                      </span>

                      {/* Tamil character */}
                      <span className="tamil-text" style={{
                        flex: 1,
                        fontSize: 26, fontWeight: 600, lineHeight: 1.2,
                        color: 'var(--text-primary)',
                      }}>
                        {word.modern_tamil || word.class_id}
                      </span>

                      {/* Class ID + confidence */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          cls {word.class_id}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{
                            width: 40, height: 3, borderRadius: 2,
                            background: 'var(--bg-card-3)', overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`, height: '100%',
                              background: confColor,
                              borderRadius: 2,
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: confColor, minWidth: 32, textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>
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
