import { useState } from 'react'

export default function SentenceOutput({
  fullSentence,
  romanSentence,
  alternativeSentences = [],
  alternativeRomanSentences = []
}) {
  const [copied, setCopied]       = useState(false)
  const [showRoman, setShowRoman] = useState(false)

  const activeText = showRoman ? (romanSentence || fullSentence) : fullSentence

  function copy() {
    if (!activeText) return
    navigator.clipboard.writeText(activeText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      borderRadius: 10,
      background: '#12141f',
      border: '1px solid var(--border)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Top Header Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}>
          Full Inscription Translation
        </span>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Script Segmented Control */}
          {romanSentence && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 6,
              border: '1px solid var(--border)',
              padding: 2,
            }}>
              <button
                onClick={() => setShowRoman(false)}
                style={{
                  background: !showRoman ? '#f97316' : 'transparent',
                  border: 'none',
                  color: !showRoman ? '#fff' : 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                Tamil
              </button>
              <button
                onClick={() => setShowRoman(true)}
                style={{
                  background: showRoman ? '#f97316' : 'transparent',
                  border: 'none',
                  color: showRoman ? '#fff' : 'var(--text-secondary)',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 8px',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                Roman
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={copy}
            disabled={!activeText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 600,
              cursor: !activeText ? 'not-allowed' : 'pointer',
              background: copied ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: copied ? '#4ade80' : 'var(--text-primary)',
              transition: 'all 0.15s ease',
            }}
          >
            {copied ? '✓ Copied' : 'Copy Output'}
          </button>
        </div>
      </div>

      {/* Main Translation Inset Box */}
      <div style={{
        background: '#090a10',
        borderRadius: 8,
        border: '1px solid var(--border)',
        padding: '12px 14px',
        maxHeight: 110,
        overflowY: 'auto',
      }}>
        <p
          className={showRoman ? '' : 'tamil-text'}
          style={{
            fontSize: showRoman ? 15 : 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            fontFamily: showRoman ? 'Inter, sans-serif' : undefined,
          }}
        >
          {activeText || (
            <span style={{ opacity: 0.3, fontStyle: 'italic', fontSize: 12, fontWeight: 400 }}>
              No translation generated yet.
            </span>
          )}
        </p>
      </div>

      {/* Alternative Readings Grid */}
      {alternativeSentences.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Alternative Readings ({Math.min(alternativeSentences.length, 6)})
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 6,
            maxHeight: 140,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {alternativeSentences.slice(0, 6).map((altText, idx) => {
              const romanText = alternativeRomanSentences[idx] || ''
              return (
                <div
                  key={idx}
                  onClick={() => {
                    navigator.clipboard.writeText(altText)
                  }}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-card-2)',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 2,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(249,115,22,0.4)'
                    e.currentTarget.style.background = 'rgba(249,115,22,0.05)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-card-2)'
                  }}
                  title="Click to copy this reading"
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Option #{idx + 1}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>📋 Copy</span>
                  </div>

                  <div className="tamil-text" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {altText}
                  </div>

                  {romanText && (
                    <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}>
                      {romanText}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
