import { useState } from 'react'

export default function SentenceOutput({
  fullSentence,
  rawSentence,
  aiRefinedSentence,
  aiMeaning,
  aiWordBreakdown = [],
  romanSentence,
  alternativeSentences = [],
  alternativeRomanSentences = [],
  onRefineAI,
  isRefiningAI = false,
}) {
  const [copied, setCopied]          = useState(false)
  const [copiedAi, setCopiedAi]      = useState(false)
  const [copiedAll, setCopiedAll]    = useState(false)
  const [showRoman, setShowRoman]    = useState(false)

  const detectedText  = rawSentence || fullSentence
  const aiText        = aiRefinedSentence
  const activeText    = showRoman ? (romanSentence || aiText || detectedText) : (aiText || detectedText)

  function copy(textToCopy, setCopyState) {
    if (!textToCopy) return
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyState(true)
      setTimeout(() => setCopyState(false), 2000)
    })
  }

  function copyAllAlternatives() {
    if (!alternativeSentences.length) return
    const textToCopy = alternativeSentences.slice(0, 10).map((alt, i) => {
      const rom = alternativeRomanSentences[i] ? ` (${alternativeRomanSentences[i]})` : ''
      return `Option #${i + 1}: ${alt}${rom}`
    }).join('\n')

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    })
  }

  return (
    <div style={{
      borderRadius: 12,
      background: '#12141f',
      border: '1px solid var(--border)',
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
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
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          📜 Inscription Translation & Epigraphic AI Analyzer
        </span>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

          <button
            onClick={() => copy(activeText, setCopied)}
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

      {/* ── Area 1: Detected Inscription Glyphs (Vision Model) ───────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            🔤 Detected Character Sequence (Vision Model)
          </span>

          {/* Dedicated Refine & Analyze with AI Button */}
          {onRefineAI && (
            <button
              onClick={onRefineAI}
              disabled={isRefiningAI || !detectedText}
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: 10,
                fontWeight: 700,
                cursor: isRefiningAI ? 'wait' : 'pointer',
                boxShadow: '0 2px 10px rgba(168, 85, 247, 0.3)',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s ease',
              }}
              title="Analyze Top 50 Beam Search Variations with Gemini AI for Word-by-Word Breakdown"
            >
              {isRefiningAI ? '⏳ Analyzing Top 50 Variations...' : '✨ Refine & Analyze with AI'}
            </button>
          )}
        </div>

        <div style={{
          background: '#090a10',
          borderRadius: 8,
          border: '1px solid var(--border)',
          padding: '8px 12px',
          maxHeight: 70,
          overflowY: 'auto',
        }}>
          <p
            className={showRoman ? '' : 'tamil-text'}
            style={{
              fontSize: showRoman ? 13 : 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              wordBreak: 'break-word',
              fontFamily: showRoman ? 'Inter, sans-serif' : undefined,
              margin: 0,
            }}
          >
            {detectedText || (
              <span style={{ opacity: 0.3, fontStyle: 'italic', fontSize: 12, fontWeight: 400 }}>
                No character detection available.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Area 2: Final AI Epigraphic Refinement & Word-by-Word Analysis ─────── */}
      {aiText && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: 12, borderRadius: 8,
          background: 'rgba(168, 85, 247, 0.06)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#c084fc',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              ✨ Final AI Epigraphic Word Segmentation & Meaning Breakdown
            </span>
            <button
              onClick={() => copy(aiText, setCopiedAi)}
              style={{
                background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#e9d5ff', borderRadius: 4, padding: '2px 8px',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {copiedAi ? '✓ Copied' : '📋 Copy AI Text'}
            </button>
          </div>

          <div className="tamil-text" style={{
            fontSize: 20, fontWeight: 700, color: '#f3e8ff',
            lineHeight: 1.4, wordBreak: 'break-word',
          }}>
            {aiText}
          </div>

          {/* Word-by-Word Meaning Breakdown Cards */}
          {aiWordBreakdown && aiWordBreakdown.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📖 Separated Word Breakdown & Meanings ({aiWordBreakdown.length} Words):
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 6,
                maxHeight: 160,
                overflowY: 'auto',
              }}>
                {aiWordBreakdown.map((item, idx) => {
                  const isRestored = item.is_restored || (item.type && item.type.toLowerCase().includes('restored'))
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isRestored ? 'rgba(234, 179, 8, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                        border: isRestored ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(168, 85, 247, 0.25)',
                        borderRadius: 8,
                        padding: '8px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        boxShadow: isRestored ? '0 0 10px rgba(234, 179, 8, 0.15)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span className="tamil-text" style={{ fontSize: 16, fontWeight: 700, color: isRestored ? '#fef08a' : '#ffffff' }}>
                          {item.word}
                        </span>
                        <span style={{
                          fontSize: 8,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: isRestored ? 'rgba(234, 179, 8, 0.25)' : 'rgba(249,115,22,0.2)',
                          color: isRestored ? '#fde047' : '#f97316',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          {isRestored ? '✨ AI Restored' : (item.type || 'Word')}
                        </span>
                      </div>
                      {item.meaning && (
                        <span style={{ fontSize: 11, color: isRestored ? '#fef9c3' : '#e9d5ff', lineHeight: 1.3 }}>
                          {item.meaning}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {aiMeaning && (
            <div style={{
              fontSize: 11, color: '#d8b4fe', fontStyle: 'italic',
              marginTop: 4, padding: '4px 8px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span style={{ fontWeight: 700, color: '#c084fc' }}>💡 Overall Inscription Meaning:</span>
              <span>{aiMeaning}</span>
            </div>
          )}
        </div>
      )}

      {/* Alternative Readings Grid (Top 10 Combinations) */}
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
              Top Suitable Readings ({Math.min(alternativeSentences.length, 10)})
            </span>

            {/* Copy All Button */}
            <button
              onClick={copyAllAlternatives}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                background: copiedAll ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                color: copiedAll ? '#4ade80' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
              title="Copy all top alternative readings to clipboard"
            >
              {copiedAll ? '✓ Copied All!' : '📋 Copy All Readings'}
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 6,
            maxHeight: 180,
            overflowY: 'auto',
            paddingRight: 2,
          }}>
            {alternativeSentences.slice(0, 10).map((altText, idx) => {
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

                  <div className="tamil-text" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.3 }}>
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
