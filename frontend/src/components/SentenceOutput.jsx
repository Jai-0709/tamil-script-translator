import { useState } from 'react'

export default function SentenceOutput({ fullSentence, romanSentence, wordCount, lineCount, alternativeSentences = [], alternativeRomanSentences = [] }) {
  const [copied, setCopied]         = useState(false)
  const [fontSize, setFontSize]     = useState(24)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showRoman, setShowRoman]   = useState(false)   // Tamil | Roman toggle

  const activeText = showRoman ? (romanSentence || fullSentence) : fullSentence

  function copy() {
    navigator.clipboard.writeText(activeText).then(() => {
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

          {/* ── Tamil | Roman toggle ── */}
          {!isCollapsed && romanSentence && (
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--bg-card-3)', borderRadius: 6,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <button
                onClick={() => setShowRoman(false)}
                style={{
                  background: !showRoman ? 'var(--accent)' : 'none',
                  border: 'none',
                  color: !showRoman ? '#fff' : 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  padding: '3px 9px',
                  transition: 'background 0.15s, color 0.15s',
                }}
                title="Show Tamil script"
              >
                Tamil
              </button>
              <button
                onClick={() => setShowRoman(true)}
                style={{
                  background: showRoman ? 'var(--accent)' : 'none',
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  color: showRoman ? '#fff' : 'var(--text-secondary)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  padding: '3px 9px',
                  transition: 'background 0.15s, color 0.15s',
                }}
                title="Show Roman/phonetic transliteration (ISO-15919)"
              >
                Roman
              </button>
            </div>
          )}

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

      {/* Script label */}
      {!isCollapsed && romanSentence && (
        <div style={{
          fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 4,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: showRoman ? '#60a5fa' : '#f97316',
            display: 'inline-block',
          }}/>
          {showRoman ? 'ISO-15919 Roman Transliteration (via Aksharamukha)' : 'Tamil Unicode Script'}
        </div>
      )}

      {/* Sentence text */}
      {!isCollapsed && (
        <div style={{ maxHeight: '120px', overflowY: 'auto', paddingRight: 4 }}>
          <p
            className={showRoman ? '' : 'tamil-text'}
            style={{
              fontSize: showRoman ? Math.max(14, fontSize - 6) : `${fontSize}px`,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              wordBreak: 'break-word',
              transition: 'font-size 0.15s ease-out',
              fontFamily: showRoman ? 'Inter, sans-serif' : undefined,
            }}
          >
            {activeText || '—'}
          </p>
        </div>
      )}

      {/* Alternative Readings */}
      {!isCollapsed && alternativeSentences.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
          <div style={{
            fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Alternative AI Readings
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '200px', overflowY: 'auto', paddingRight: 6 }}>
            {alternativeSentences.map((altText, idx) => {
              const textToDisplay = showRoman ? alternativeRomanSentences[idx] : altText
              return (
                <div key={idx} style={{
                  padding: '8px 12px', background: 'var(--bg-card-3)',
                  borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: showRoman ? Math.max(12, fontSize - 8) : Math.max(14, fontSize - 6),
                  color: 'var(--text-secondary)', fontFamily: showRoman ? 'Inter, sans-serif' : undefined,
                  wordBreak: 'break-word', lineHeight: 1.5, flexShrink: 0
                }}>
                  {textToDisplay}
                </div>
              )
            })}
          </div>
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
