import { useState } from 'react'

export default function SentenceOutput({
  fullSentence,
  rawSentence,
  aiRefinedSentence,
  englishTranslation,
  aiMeaning,
  englishMeaning,
  aiWordBreakdown = [],
  alternativeSentences = [],
  onRefineAI,
  onSync,
  isRefiningAI = false,
}) {
  const [copied, setCopied]       = useState(false)
  const [copiedAi, setCopiedAi]   = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [langTab, setLangTab]     = useState('all') // 'all' | 'tamil' | 'english'

  const detectedText = fullSentence || rawSentence
  const aiText       = aiRefinedSentence
  const activeText   = aiText || detectedText

  function copy(text, set) {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      set(true)
      setTimeout(() => set(false), 2000)
    })
  }

  function copyAllAlternatives() {
    if (!alternativeSentences.length) return
    const txt = alternativeSentences
      .slice(0, 10)
      .map((alt, i) => `${i + 1}. ${alt}`)
      .join('\n')
    navigator.clipboard.writeText(txt).then(() => {
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    })
  }

  return (
    <div style={{
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-sm)',
      background: 'var(--surface-1)',
      overflow: 'hidden',
    }}>
      {/* ── Window Header ── */}
      <div style={{
        padding: '10px 16px',
        background: 'var(--surface-2)',
        borderBottom: collapsed ? 'none' : '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
            Translation & AI Analysis
          </span>
          <button
            className="btn-ghost"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
            style={{ padding: '2px 6px', gap: 4 }}
          >
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform var(--dur-fast)',
              }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {collapsed ? 'Expand' : 'Collapse'}
            </span>
          </button>

          {/* Language Translation Tabs */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--surface-3)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)', padding: 2,
          }}>
            {[
              ['all', 'All (Bilingual)'],
              ['tamil', 'Tamil (தமிழ்)'],
              ['english', 'English'],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setLangTab(k)}
                style={{
                  background: langTab === k ? 'var(--surface-1)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 11,
                  fontWeight: langTab === k ? 700 : 500,
                  color: langTab === k ? 'var(--copper-light)' : 'var(--fg-3)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onSync && (
            <button
              className="btn-secondary"
              onClick={onSync}
              title="Synchronize detected sequence and alternative readings from active boxes"
              style={{ padding: '4px 10px', fontSize: 12, color: 'var(--copper)', borderColor: 'var(--copper-border)' }}
            >
              <span>Synchronize Text</span>
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => copy(activeText, setCopied)}
            disabled={!activeText}
            style={{ fontSize: 12, color: copied ? '#3da35d' : undefined }}
          >
            {copied ? 'Copied' : 'Copy Text'}
          </button>
        </div>
      </div>

      {/* ── Collapsible Body ─────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: 16 }}>

          {/* ── 2-Column Standalone Feature Panels: Left (Model Translation) | Right (AI Translation) ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'stretch',
            width: '100%',
          }}>

            {/* ========================================================================= */}
            {/* ── LEFT CONTAINER: MODEL DETECTED TRANSLATION & ALTERNATIVES ─────────── */}
            {/* ========================================================================= */}
            <div style={{
              padding: 16,
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxSizing: 'border-box',
            }}>

              {/* Feature 1: Model Primary Detected Sequence */}
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 12, flexWrap: 'wrap', gap: 8,
                }}>
                  <span className="label" style={{ color: 'var(--fg-3)', letterSpacing: '0.06em' }}>
                    Model Detected Sequence
                  </span>
                </div>
                <p className="tamil" style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: 'var(--fg)',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  margin: 0,
                  padding: '12px 14px',
                  background: 'var(--surface-3)',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--line)',
                }}>
                  {detectedText || (
                    <span style={{ color: 'var(--fg-4)', fontStyle: 'italic', fontSize: 13 }}>
                      Awaiting analysis…
                    </span>
                  )}
                </p>
              </div>

              {/* Feature 2: Alternative Readings (Inside Left Container) */}
              {alternativeSentences.length > 0 && (
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 10, flexWrap: 'wrap', gap: 6,
                  }}>
                    <span className="label" style={{ color: 'var(--fg-4)' }}>
                      Alternative Readings · {Math.min(alternativeSentences.length, 10)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {onSync && (
                        <button
                          className="btn-secondary"
                          onClick={onSync}
                          title="Manually refresh and synchronize alternative readings with newly changed characters"
                          style={{ padding: '3px 8px', fontSize: 11, color: 'var(--copper)', borderColor: 'var(--copper-border)' }}
                        >
                          <span>Sync</span>
                        </button>
                      )}
                      <button
                        className="btn-ghost"
                        onClick={copyAllAlternatives}
                        style={{ fontSize: 11, color: copiedAll ? '#3da35d' : undefined }}
                      >
                        {copiedAll ? 'Copied' : 'Copy all'}
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 8,
                    maxHeight: 260,
                    overflowY: 'auto',
                  }}>
                    {alternativeSentences.slice(0, 10).map((altText, idx) => (
                      <div
                        key={idx}
                        onClick={() => navigator.clipboard.writeText(altText)}
                        title="Click to copy"
                        style={{
                          padding: '8px 10px',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          cursor: 'pointer',
                          transition: 'border-color var(--dur-fast)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--copper-border)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line)'}
                      >
                        <div style={{ fontSize: 9, color: 'var(--copper)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                          Option {idx + 1}
                        </div>
                        <div className="tamil" style={{
                          fontSize: 15, fontWeight: 600, color: 'var(--fg)',
                          wordBreak: 'break-word', lineHeight: 1.3,
                        }}>
                          {altText}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>


            {/* ========================================================================= */}
            {/* ── RIGHT CONTAINER: AI EPIGRAPHIC REFINEMENT & WORD BREAKDOWN ────────── */}
            {/* ========================================================================= */}
            <div style={{
              padding: 16,
              background: 'var(--surface-2)',
              border: `1px solid ${aiText ? 'var(--copper-border)' : 'var(--line)'}`,
              borderRadius: 'var(--r-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxSizing: 'border-box',
            }}>

              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 0, flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="label" style={{ color: 'var(--copper)', letterSpacing: '0.06em' }}>
                    AI Epigraphic Refinement
                  </span>
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 99,
                    background: 'var(--copper-dim)', color: 'var(--copper)',
                    fontWeight: 600, letterSpacing: '0.04em',
                  }}>
                    Gemini
                  </span>
                </div>
                {aiText && (
                  <button
                    className="btn-ghost"
                    onClick={() => copy(aiText, setCopiedAi)}
                    style={{ fontSize: 11, color: copiedAi ? '#3da35d' : undefined }}
                  >
                    {copiedAi ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {aiText ? (
                <>
                  {/* Feature 1: Refined Sentence & English Translation (Symmetrical Professional Layout) */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'var(--surface-3)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--copper-border)',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    {(langTab === 'all' || langTab === 'tamil') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            Tamil Transcription
                          </span>
                        </div>
                        <p className="tamil" style={{
                          fontSize: 22, fontWeight: 600, color: 'var(--copper-light)',
                          lineHeight: 1.45, wordBreak: 'break-word', margin: 0,
                        }}>
                          {aiText}
                        </p>
                      </div>
                    )}

                    {(langTab === 'all' || langTab === 'english') && englishTranslation && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 4,
                        borderTop: langTab === 'all' && (langTab === 'all' || langTab === 'tamil') ? '1px solid var(--copper-border)' : 'none',
                        paddingTop: langTab === 'all' && (langTab === 'all' || langTab === 'tamil') ? 8 : 0,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            English Translation
                          </span>
                        </div>
                        <p style={{
                          fontSize: 14, fontWeight: 500, color: 'var(--fg-2)',
                          lineHeight: 1.45, wordBreak: 'break-word', margin: 0,
                        }}>
                          {englishTranslation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Feature 2: Historical Context & Meaning (Symmetrical Professional Structure) */}
                  {(aiMeaning || englishMeaning) && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'var(--surface-3)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--line)',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
                      <div className="label" style={{ color: 'var(--fg-4)', letterSpacing: '0.06em' }}>
                        Historical Context & Epigraphic Meaning
                      </div>

                      {(langTab === 'all' || langTab === 'tamil') && aiMeaning && (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 4,
                          background: 'var(--surface-2)', padding: '8px 10px',
                          borderRadius: 6, border: '1px solid var(--line)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.04em' }}>
                              TAMIL
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.45, margin: 0 }}>
                            {aiMeaning}
                          </p>
                        </div>
                      )}

                      {(langTab === 'all' || langTab === 'english') && englishMeaning && (
                        <div style={{
                          display: 'flex', flexDirection: 'column', gap: 4,
                          background: 'var(--surface-2)', padding: '8px 10px',
                          borderRadius: 6, border: '1px solid var(--line)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.04em' }}>
                              ENGLISH
                            </span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.45, margin: 0 }}>
                            {englishMeaning}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feature 3: Word Analysis Grid (Symmetrical TA/EN Cards) */}
                  {aiWordBreakdown.length > 0 && (
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                      <div className="label" style={{ color: 'var(--fg-4)', marginBottom: 8 }}>
                        Word Analysis · {aiWordBreakdown.length} items
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                        gap: 8,
                        maxHeight: 250,
                        overflowY: 'auto',
                      }}>
                        {aiWordBreakdown.map((item, idx) => {
                          const isRestored = item.is_restored || (item.type?.toLowerCase().includes('restored'))
                          const wordLen    = item.word?.length || 0
                          const fontSize   = wordLen > 10 ? 14 : wordLen > 6 ? 16 : 18

                          return (
                            <div key={idx} style={{
                              padding: '10px 12px',
                              background: 'var(--surface-3)',
                              border: `1px solid ${isRestored ? 'var(--copper-border)' : 'var(--line)'}`,
                              borderRadius: 'var(--r-sm)',
                              display: 'flex', flexDirection: 'column', gap: 6,
                              minWidth: 0,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                                <span className="tamil" style={{
                                  fontSize: fontSize,
                                  fontWeight: 600,
                                  color: isRestored ? 'var(--copper-light)' : 'var(--fg)',
                                  lineHeight: 1.3,
                                  wordBreak: 'break-word',
                                  flex: '1 1 auto',
                                  minWidth: 0,
                                }}>
                                  {item.word}
                                </span>
                                {(item.type || isRestored) && (
                                  <span style={{
                                    fontSize: 9,
                                    color: isRestored ? 'var(--copper-light)' : 'var(--fg-3)',
                                    background: isRestored ? 'var(--copper-dim)' : 'var(--surface-4)',
                                    border: `1px solid ${isRestored ? 'var(--copper-border)' : 'var(--line)'}`,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    flexShrink: 0,
                                  }}>
                                    {isRestored ? 'RESTORED' : item.type}
                                  </span>
                                )}
                              </div>

                              {(langTab === 'all' || langTab === 'tamil') && item.meaning && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.35 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', background: 'var(--surface-4)', padding: '0 4px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>
                                    TA
                                  </span>
                                  <span style={{ wordBreak: 'break-word' }}>{item.meaning}</span>
                                </div>
                              )}

                              {(langTab === 'all' || langTab === 'english') && item.english_meaning && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.35 }}>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--copper)', background: 'var(--surface-4)', padding: '0 4px', borderRadius: 3, flexShrink: 0, marginTop: 1 }}>
                                    EN
                                  </span>
                                  <span style={{ wordBreak: 'break-word' }}>{item.english_meaning}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Compact Top Golden Banner inside the window (Clean & Uncluttered) */
                <div style={{
                  padding: '14px 16px',
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(20,20,20,0.8) 100%)',
                  border: '1px solid var(--copper-border)',
                  borderRadius: 'var(--r-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ color: 'var(--copper-light)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
                      Epigraphic AI Analysis
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '4px 0 0', lineHeight: 1.4, maxWidth: 480 }}>
                      Enhance raw detected character sequence into word-segmented Tamil text, historical contextual meaning, and word etymology breakdown with Gemini.
                    </p>
                  </div>
                  {onRefineAI && (
                    <button
                      className="btn-primary"
                      onClick={onRefineAI}
                      disabled={isRefiningAI || !detectedText}
                      style={{
                        padding: '7px 16px',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
                      }}
                    >
                      {isRefiningAI ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            style={{ animation: 'spin 0.9s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          Refining with AI…
                        </>
                      ) : 'Refine with AI'}
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes skeletonPulse { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}
