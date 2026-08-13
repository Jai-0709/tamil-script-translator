import { useState, useRef, useCallback, useEffect } from 'react'
import InscriptionCanvas from './InscriptionCanvas'
import OriginalImageViewer from './OriginalImageViewer'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function TouristMode() {
  const [imageFile, setImageFile] = useState(null)
  const [imageURL, setImageURL] = useState(null)
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [hoveredWordId, setHoveredWordId] = useState(null)
  const [activeView, setActiveView] = useState('canvas') // 'canvas' | 'spotlight'
  const [speakingLine, setSpeakingLine] = useState(null)

  const fileInputRef = useRef(null)

  const handleTranslate = useCallback(async (fileToTranslate) => {
    const file = fileToTranslate || imageFile
    if (!file) return
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)

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

  const handleFile = useCallback((file) => {
    if (!file) return
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImageURL(url)
    setResult(null)
    setError(null)
    // Instant Auto-Pilot execution
    handleTranslate(file)
  }, [handleTranslate])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }, [handleFile])

  const handleReset = useCallback(() => {
    setImageFile(null)
    setImageURL(null)
    setResult(null)
    setError(null)
    setHoveredWordId(null)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  const copyAll = useCallback(() => {
    if (!result) return
    const lines = (result.line_breakdown || []).map((line, i) => (
      `── Line ${line.line_num || i + 1} ──\n` +
      `Ancient Tamil: ${line.epigraphic_text || ''}\n` +
      `Modern Tamil: ${line.modern_meaning || ''}\n` +
      `English: ${line.english_translation || ''}\n` +
      (line.historical_note ? `Historical Context: ${line.historical_note}\n` : '')
    )).join('\n')

    const full = (
      `🏛️ TAMIL EPIGRAPHIC INSCRIPTION TRANSLATION\n` +
      `============================================\n` +
      `${result.full_sentence || ''}\n\n` +
      `English: ${result.english_translation || ''}\n\n` +
      `${lines}\n` +
      (result.overall_context ? `Overall Context: ${result.overall_context}` : '')
    )
    navigator.clipboard.writeText(full)
  }, [result])

  const speakTamil = useCallback((text, lineId) => {
    if ('speechSynthesis' in window && text) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ta-IN'
      utterance.rate = 0.85
      utterance.onend = () => setSpeakingLine(null)
      utterance.onerror = () => setSpeakingLine(null)
      setSpeakingLine(lineId)
      window.speechSynthesis.speak(utterance)
    }
  }, [])

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
        <div style={{ textAlign: 'center', marginBottom: 44, maxWidth: 600 }}>
          <div style={{
            fontSize: 52,
            marginBottom: 12,
            filter: 'drop-shadow(0 4px 24px rgba(201,134,55,0.35))',
          }}>🏛️</div>
          <h1 style={{
            fontSize: 30,
            fontWeight: 700,
            color: 'var(--fg)',
            marginBottom: 8,
            letterSpacing: '-0.02em',
          }}>
            Tamil Temple Inscription Reader
          </h1>
          <p style={{
            fontSize: 15,
            color: 'var(--fg-3)',
            lineHeight: 1.6,
            maxWidth: 460,
            margin: '0 auto',
          }}>
            Take a photo of any ancient Tamil stone inscription. Auto-pilot AI automatically isolates characters, translates lines, and provides historical context with zero manual clicking.
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
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--copper)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4, textAlign: 'center' }}>
              Upload Inscription Photo
            </p>
            <p style={{ fontSize: 13, color: 'var(--fg-4)', textAlign: 'center' }}>
              Drag & drop photo or tap camera · Instant 1-Pass Auto-Pilot Translation
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
          marginTop: 48,
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: 720,
        }}>
          {[
            { icon: '📸', title: '1. Take Photo', desc: 'Snap any ancient stone carving at a temple or monument' },
            { icon: '⚡', title: '2. 1-Pass Auto-Pilot', desc: 'YOLO + ViT AI detects ancient Tamil glyphs & line layout' },
            { icon: '📜', title: '3. Tourist Line Cards', desc: 'Line-by-line Modern Tamil & English translation + audio pronunciation' },
          ].map((step, i) => (
            <div key={i} style={{
              flex: '1 1 200px',
              maxWidth: 220,
              textAlign: 'center',
              padding: 16,
              background: 'var(--surface-1)',
              border: '1px solid var(--line)',
              borderRadius: 12,
            }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>{step.icon}</div>
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
      padding: '16px 20px',
      gap: 16,
    }}>
      {/* Top Action Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: 'var(--surface-1)',
        padding: '10px 16px',
        borderRadius: 12,
        border: '1px solid var(--line)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleReset}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--line)',
              borderRadius: 8,
              background: 'var(--surface-2)',
              color: 'var(--fg-2)',
              cursor: 'pointer',
            }}
          >
            ← New Inscription Photo
          </button>
          <span style={{ fontSize: 13, color: 'var(--fg-4)' }}>|</span>
          <span style={{ fontSize: 13, color: 'var(--copper)', fontWeight: 600 }}>
            Auto-Pilot Mode (Zero-Click Active)
          </span>
        </div>

        {result && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
              <button
                onClick={() => setActiveView('canvas')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  background: activeView === 'canvas' ? 'var(--copper)' : 'var(--surface-2)',
                  color: activeView === 'canvas' ? '#000' : 'var(--fg-3)',
                  cursor: 'pointer',
                }}
              >
                Bounding Boxes Overlay
              </button>
              <button
                onClick={() => setActiveView('spotlight')}
                style={{
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  border: 'none',
                  background: activeView === 'spotlight' ? 'var(--copper)' : 'var(--surface-2)',
                  color: activeView === 'spotlight' ? '#000' : 'var(--fg-3)',
                  cursor: 'pointer',
                }}
              >
                4X Magnifier Lens
              </button>
            </div>

            <button
              onClick={copyAll}
              style={{
                padding: '6px 14px',
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
            <button
              onClick={() => handleTranslate()}
              style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid var(--line)',
                borderRadius: 8,
                background: 'var(--surface-2)',
                color: 'var(--fg-3)',
                cursor: 'pointer',
              }}
            >
              🔄 Re-Analyze
            </button>
          </div>
        )}
      </div>

      {/* Main Auto-Pilot View Split */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Loading Overlay */}
        {isLoading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 60,
            border: '1px solid var(--line)',
            borderRadius: 16,
            background: 'var(--surface-1)',
          }}>
            <div style={{
              width: 44, height: 44,
              border: '3px solid var(--line)',
              borderTopColor: 'var(--copper)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 15, color: 'var(--fg-2)', fontWeight: 600 }}>
              Auto-Pilot Execution in Progress…
            </p>
            <p style={{ fontSize: 13, color: 'var(--fg-4)', textAlign: 'center', maxWidth: 360, lineHeight: 1.5 }}>
              Step 1: YOLO Segmentation → Step 2: ViT 247-Class Classifier → Step 3: Gemini Epigraphic Refinement
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

        {/* Result UI */}
        {result && (
          <>
            {/* Top Visual Proof Canvas */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              background: 'var(--surface-1)',
              padding: 16,
              borderRadius: 16,
              border: '1px solid var(--line)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
                  Visual Character Detection Proof ({result.words?.length || 0} glyphs detected)
                </span>
                {result.dynasty && result.dynasty !== 'Unknown' && (
                  <span style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 99,
                    background: 'rgba(201,134,55,0.12)',
                    color: 'var(--copper)',
                    border: '1px solid rgba(201,134,55,0.25)',
                  }}>
                    {result.dynasty} Dynasty ({result.estimated_period || 'Historical Era'})
                  </span>
                )}
              </div>

              {activeView === 'canvas' ? (
                <InscriptionCanvas
                  imageURL={imageURL}
                  words={result.words || []}
                  imageWidth={result.image_width}
                  imageHeight={result.image_height}
                  hoveredWordId={hoveredWordId}
                  onWordHover={setHoveredWordId}
                  onWordClick={() => {}}
                  threshold={0}
                  maxHeight={420}
                />
              ) : (
                <OriginalImageViewer
                  imageURL={imageURL}
                  words={result.words || []}
                  imageWidth={result.image_width}
                  imageHeight={result.image_height}
                  hoveredWordId={hoveredWordId}
                  onWordHover={setHoveredWordId}
                  maxHeight={420}
                />
              )}
            </div>

            {/* Historical Summary Banner */}
            {result.overall_context && (
              <div style={{
                padding: '16px 20px',
                borderRadius: 14,
                background: 'rgba(201,134,55,0.06)',
                border: '1px solid rgba(201,134,55,0.2)',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 24 }}>🏛️</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>
                    Historical Epigraphic Context
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.6 }}>
                    {result.overall_context}
                  </div>
                </div>
              </div>
            )}

            {/* Line-by-Line Tourist Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
                Structured Inscription Line Cards ({result.line_breakdown?.length || 0} lines)
              </div>

              {result.line_breakdown?.map((line, i) => (
                <div key={i} style={{
                  padding: '18px 22px',
                  borderRadius: 14,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}>
                  {/* Line Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: 'var(--surface-3)',
                      color: 'var(--copper)',
                      letterSpacing: '0.05em',
                    }}>
                      LINE {line.line_num || i + 1}
                    </span>

                    {line.epigraphic_text && (
                      <button
                        onClick={() => speakTamil(line.epigraphic_text, i)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: speakingLine === i ? 'rgba(201,134,55,0.2)' : 'var(--surface-2)',
                          color: speakingLine === i ? 'var(--copper)' : 'var(--fg-3)',
                          cursor: 'pointer',
                        }}
                      >
                        <span>🔊</span>
                        <span>{speakingLine === i ? 'Speaking…' : 'Listen Pronunciation'}</span>
                      </button>
                    )}
                  </div>

                  {/* 📜 Ancient Tamil */}
                  {line.epigraphic_text && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>
                        Ancient Tamil Inscription Text
                      </div>
                      <div style={{
                        fontSize: 20,
                        fontFamily: '"Noto Sans Tamil", "Tamil Sangam MN", serif',
                        color: 'var(--fg)',
                        lineHeight: 1.5,
                        fontWeight: 600,
                      }}>
                        {line.epigraphic_text}
                      </div>
                    </div>
                  )}

                  {/* 🌟 Modern Tamil */}
                  {line.modern_meaning && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--copper)', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>
                        Modern Tamil Translation
                      </div>
                      <div style={{
                        fontSize: 16,
                        fontFamily: '"Noto Sans Tamil", "Tamil Sangam MN", serif',
                        color: 'var(--fg-2)',
                        lineHeight: 1.5,
                      }}>
                        {line.modern_meaning}
                      </div>
                    </div>
                  )}

                  {/* 🇬🇧 English */}
                  {line.english_translation && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#8b8fff', letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase' }}>
                        English Meaning
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

                  {/* 🏛️ Historical Note */}
                  {line.historical_note && (
                    <div style={{
                      marginTop: 4,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: 'rgba(201,134,55,0.05)',
                      borderLeft: '3px solid var(--copper)',
                      fontSize: 12,
                      color: 'var(--fg-3)',
                      lineHeight: 1.5,
                    }}>
                      📝 {line.historical_note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
