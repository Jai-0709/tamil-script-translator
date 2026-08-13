import { useState, useRef, useCallback } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function TouristMode() {
  const [imageFile, setImageFile] = useState(null)
  const [imageURL, setImageURL] = useState(null)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file) return
    setImageFile(file)
    setImageURL(URL.createObjectURL(file))
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  const handleTranslate = useCallback(async () => {
    if (!imageFile) return
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', imageFile)

      const res = await fetch(`${BACKEND_URL}/api/tourist-translate`, {
        method: 'POST',
        body: form,
        headers: {
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true',
        }
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Server error (${res.status})`)
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Translation failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [imageFile])

  const handleReset = useCallback(() => {
    setImageFile(null)
    setImageURL(null)
    setResult(null)
    setError(null)
  }, [])

  const copyAll = useCallback(() => {
    if (!result) return
    const lines = (result.line_breakdown || []).map((line, i) => (
      `── Line ${line.line_num || i + 1} ──\n` +
      `Tamil: ${line.epigraphic_text || ''}\n` +
      `Modern: ${line.modern_meaning || ''}\n` +
      `English: ${line.english_translation || ''}\n` +
      (line.historical_note ? `Note: ${line.historical_note}\n` : '')
    )).join('\n')

    const full = (
      `${result.full_sentence || ''}\n\n` +
      `English: ${result.english_translation || ''}\n\n` +
      `${lines}\n` +
      (result.overall_context ? `Context: ${result.overall_context}` : '')
    )
    navigator.clipboard.writeText(full)
  }, [result])

  // ── Upload State ──
  if (!imageURL) {
    return (
      <div style={{
        minHeight: 'calc(100dvh - 52px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'var(--base)',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 600 }}>
          <div style={{
            fontSize: 52,
            marginBottom: 12,
            filter: 'drop-shadow(0 4px 24px rgba(201,134,55,0.3))',
          }}>🏛️</div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--fg)',
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            Tamil Inscription Reader
          </h1>
          <p style={{
            fontSize: 15,
            color: 'var(--fg-3)',
            lineHeight: 1.6,
            maxWidth: 440,
            margin: '0 auto',
          }}>
            Take a photo of any ancient Tamil stone inscription and get an instant
            line-by-line translation in Tamil and English with historical context.
          </p>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%',
            maxWidth: 480,
            minHeight: 220,
            border: `2px dashed ${dragOver ? 'var(--copper)' : 'var(--line)'}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 32,
            cursor: 'pointer',
            background: dragOver ? 'rgba(201,134,55,0.06)' : 'var(--surface-1)',
            transition: 'all 0.2s ease',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4, textAlign: 'center' }}>
              Upload inscription photo
            </p>
            <p style={{ fontSize: 13, color: 'var(--fg-4)', textAlign: 'center' }}>
              Drag & drop or click to browse · JPG, PNG, WEBP
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {/* How it works */}
        <div style={{
          marginTop: 56,
          display: 'flex',
          gap: 32,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 700,
        }}>
          {[
            { icon: '📸', title: 'Take Photo', desc: 'Photograph any stone inscription at a temple or monument' },
            { icon: '🤖', title: 'AI Reads It', desc: 'Gemini Vision AI reads the carved text directly from your photo' },
            { icon: '📜', title: 'Get Translation', desc: 'Line-by-line Tamil and English translation with historical context' },
          ].map((step, i) => (
            <div key={i} style={{
              flex: '1 1 180px',
              maxWidth: 200,
              textAlign: 'center',
              padding: 16,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.5 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Result State ──
  return (
    <div style={{
      minHeight: 'calc(100dvh - 52px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--base)',
      padding: '20px',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleReset}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--line)',
            borderRadius: 8,
            background: 'var(--surface-2)',
            color: 'var(--fg-2)',
            cursor: 'pointer',
          }}
        >
          ← New Photo
        </button>

        {!result && !isLoading && (
          <button
            onClick={handleTranslate}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #c98637, #e6a84d)',
              color: '#000',
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(201,134,55,0.3)',
            }}
          >
            ▶ Read Inscription
          </button>
        )}

        {result && (
          <button
            onClick={copyAll}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(61,163,93,0.4)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: '#3da35d',
              cursor: 'pointer',
            }}
          >
            📋 Copy All
          </button>
        )}

        {result && (
          <button
            onClick={handleTranslate}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--fg-3)',
              cursor: 'pointer',
            }}
          >
            🔄 Re-read
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        display: 'flex',
        gap: 24,
        flex: 1,
        minHeight: 0,
        flexWrap: 'wrap',
      }}>
        {/* Left: Uploaded Image */}
        <div style={{
          flex: '1 1 400px',
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
            Uploaded Inscription
          </div>
          <div style={{
            border: '1px solid var(--line)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--surface-2)',
            padding: 8,
          }}>
            <img
              src={imageURL}
              alt="Uploaded inscription"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                maxHeight: '60vh',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </div>

          {/* Dynasty & Period Badge */}
          {result && (result.dynasty || result.estimated_period) && (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}>
              {result.dynasty && result.dynasty !== 'Unknown' && (
                <span style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 99,
                  background: 'rgba(201,134,55,0.12)',
                  color: 'var(--copper)',
                  border: '1px solid rgba(201,134,55,0.2)',
                }}>
                  {result.dynasty} Dynasty
                </span>
              )}
              {result.estimated_period && (
                <span style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 99,
                  background: 'rgba(100,108,255,0.1)',
                  color: '#8b8fff',
                  border: '1px solid rgba(100,108,255,0.2)',
                }}>
                  {result.estimated_period}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Translation Output */}
        <div style={{
          flex: '1 1 400px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
        }}>
          {/* Loading */}
          {isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: 60,
              border: '1px solid var(--line)',
              borderRadius: 12,
              background: 'var(--surface-1)',
            }}>
              <div style={{
                width: 40, height: 40,
                border: '3px solid var(--line)',
                borderTopColor: 'var(--copper)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontSize: 14, color: 'var(--fg-3)', fontWeight: 500 }}>
                Reading inscription...
              </p>
              <p style={{ fontSize: 12, color: 'var(--fg-4)', lineHeight: 1.6, textAlign: 'center', maxWidth: 320 }}>
                Step 1: YOLO character detection → Step 2: Ancient Tamil classification → Step 3: Gemini AI cross-verification
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'rgba(142,59,59,0.1)',
              border: '1px solid rgba(142,59,59,0.25)',
              color: '#c87474',
              fontSize: 14,
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Overall Context */}
          {result?.overall_context && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'rgba(201,134,55,0.06)',
              border: '1px solid rgba(201,134,55,0.15)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
                Historical Context
              </div>
              <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6, margin: 0 }}>
                {result.overall_context}
              </p>
            </div>
          )}

          {/* Full English Translation */}
          {result?.english_translation && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 12,
              background: 'var(--surface-1)',
              border: '1px solid var(--line)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b8fff', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>
                Full English Translation
              </div>
              <p style={{ fontSize: 15, color: 'var(--fg)', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
                {result.english_translation}
              </p>
            </div>
          )}

          {/* Line-by-Line Breakdown */}
          {result?.line_breakdown?.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
                Line-by-Line Breakdown ({result.line_breakdown.length} lines)
              </div>

              {result.line_breakdown.map((line, i) => (
                <div key={i} style={{
                  padding: '16px 20px',
                  borderRadius: 12,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--line)',
                  transition: 'border-color 0.2s',
                }}>
                  {/* Line number */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: 'var(--surface-3)',
                      color: 'var(--copper)',
                    }}>
                      LINE {line.line_num || i + 1}
                    </span>
                  </div>

                  {/* Epigraphic Tamil */}
                  {line.epigraphic_text && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-4)', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>
                        Ancient Tamil
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontFamily: '"Noto Sans Tamil", "Tamil Sangam MN", serif',
                        color: 'var(--fg)',
                        lineHeight: 1.5,
                        fontWeight: 500,
                      }}>
                        {line.epigraphic_text}
                      </div>
                    </div>
                  )}

                  {/* Modern Tamil */}
                  {line.modern_meaning && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-4)', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>
                        Modern Tamil
                      </div>
                      <div style={{
                        fontSize: 15,
                        fontFamily: '"Noto Sans Tamil", "Tamil Sangam MN", serif',
                        color: 'var(--fg-2)',
                        lineHeight: 1.5,
                      }}>
                        {line.modern_meaning}
                      </div>
                    </div>
                  )}

                  {/* English */}
                  {line.english_translation && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-4)', letterSpacing: '0.08em', marginBottom: 3, textTransform: 'uppercase' }}>
                        English
                      </div>
                      <div style={{
                        fontSize: 14,
                        color: 'var(--fg-2)',
                        lineHeight: 1.5,
                        fontStyle: 'italic',
                      }}>
                        {line.english_translation}
                      </div>
                    </div>
                  )}

                  {/* Historical Note */}
                  {line.historical_note && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'rgba(201,134,55,0.05)',
                      borderLeft: '3px solid var(--copper)',
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                        📝 {line.historical_note}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Prompt to translate if no result yet */}
          {!result && !isLoading && !error && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 48,
              border: '1px solid var(--line)',
              borderRadius: 12,
              background: 'var(--surface-1)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>📜</div>
              <p style={{ fontSize: 14, color: 'var(--fg-3)', maxWidth: 300 }}>
                Click <strong>"▶ Read Inscription"</strong> to have Gemini AI read and translate this inscription.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
