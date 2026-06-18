import { useState } from 'react'

export default function SentenceOutput({ fullSentence, wordCount, lineCount }) {
  const [copied, setCopied] = useState(false)
  const [fontSize, setFontSize] = useState(24) // default 24px
  const [isCollapsed, setIsCollapsed] = useState(false)

  function copy() {
    navigator.clipboard.writeText(fullSentence).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fade-up" style={{
      borderRadius: 10,
      background: 'var(--bg-card-2)',
      border: '1px solid var(--border)',
      padding: '12px 14px',
      transition: 'all 0.2s ease-in-out',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? 0 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2,
            }}
            title={isCollapsed ? "Expand panel" : "Collapse panel"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          
          <span style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-secondary)',
          }}>
            Full Sentence
          </span>
          <StatBadge>{wordCount} words</StatBadge>
          <StatBadge>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</StatBadge>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Font Size controls */}
          {!isCollapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-card-3)', borderRadius: 6,
              padding: '2px 4px', border: '1px solid var(--border)'
            }}>
              <button
                onClick={() => setFontSize(prev => Math.max(14, prev - 4))}
                disabled={fontSize <= 14}
                style={{
                  background: 'none', border: 'none', color: fontSize <= 14 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600, cursor: fontSize <= 14 ? 'not-allowed' : 'pointer', padding: '2px 6px',
                }}
                title="Decrease font size"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize(24)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer', padding: '2px 4px',
                  borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)'
                }}
                title="Reset font size"
              >
                A
              </button>
              <button
                onClick={() => setFontSize(prev => Math.min(38, prev + 4))}
                disabled={fontSize >= 38}
                style={{
                  background: 'none', border: 'none', color: fontSize >= 38 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600, cursor: fontSize >= 38 ? 'not-allowed' : 'pointer', padding: '2px 6px',
                }}
                title="Increase font size"
              >
                A+
              </button>
            </div>
          )}

          <button
            onClick={copy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, border: 'none',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              background: copied ? 'rgba(74,222,128,0.12)' : 'var(--bg-card-3)',
              color:      copied ? 'var(--green)' : 'var(--text-secondary)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sentence text */}
      {!isCollapsed && (
        <div style={{
          maxHeight: '120px',
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          <p className="tamil-text" style={{
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            transition: 'font-size 0.15s ease-out',
          }}>
            {fullSentence || '—'}
          </p>
        </div>
      )}
    </div>
  )
}

function StatBadge({ children }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 10,
      background: 'var(--bg-card-3)', color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    }}>
      {children}
    </span>
  )
}
