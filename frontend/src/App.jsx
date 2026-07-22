import { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import UploadZone from './components/UploadZone'
import InscriptionCanvas from './components/InscriptionCanvas'
import OriginalImageViewer from './components/OriginalImageViewer'
import TranslationPanel from './components/TranslationPanel'
import SentenceOutput from './components/SentenceOutput'
import LoadingOverlay from './components/LoadingOverlay'
import CorrectionPopover from './components/CorrectionPopover'
import RegionSelector from './components/RegionSelector'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// ── Correction feedback persisted to localStorage ──────────────────────────
const LS_KEY = 'tamil_corrections'
function loadCorrections() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveCorrections(c) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

export default function App() {
  const [imageFile, setImageFile]         = useState(null)
  const [imageURL, setImageURL]           = useState(null)
  const [displayImageURL, setDisplayImageURL] = useState(null)
  const [apiResponse, setApiResponse]     = useState(null)
  const [isLoading, setIsLoading]         = useState(false)
  const [isRefetching, setIsRefetching]   = useState(false)
  const [error, setError]                 = useState(null)
  const [hoveredWordId, setHoveredWordId] = useState(null)

  // Feature 1 — Confidence threshold
  const [threshold, setThreshold]         = useState(0)

  // Feature 2 — Manual corrections
  const [corrections, setCorrections]     = useState({})   // {[wordId]: newChar}
  const [popover, setPopover]             = useState(null) // {word, x, y}

  // Feature 3 — Region selector
  const [regionMode, setRegionMode]       = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const imageNaturalRef                   = useRef({ w: 0, h: 0 })

  // Feature 4 — Smart Hybrid YOLO Segmentation Toggle
  const [segmentMode, setSegmentMode]     = useState('smart') // 'smart' or 'classic'

  // Feature 5 — Merge Distance
  const [mergeGap, setMergeGap]           = useState(4)

  function handleFileSelect(file) {
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImageURL(url)
    setDisplayImageURL(url)
    setApiResponse(null)
    setError(null)
    setHoveredWordId(null)
    setCorrections({})
    setPopover(null)
    setSelectedRegion(null)
    setRegionMode(false)

    // Read natural dimensions
    const img = new Image()
    img.onload = () => {
      imageNaturalRef.current = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.src = url
  }

  async function handleTranslate(gapOverride = mergeGap, regionOverride = selectedRegion) {
    if (!imageFile) return
    
    if (!apiResponse) setIsLoading(true)
    else setIsRefetching(true)
    
    setError(null)
    setCorrections({})
    try {
      let blob = imageFile
      let finalDisplayURL = imageURL

      // Feature 3: crop image to selectedRegion before sending
      if (regionOverride) {
        blob = await cropImageToBlob(imageURL, regionOverride)
        finalDisplayURL = URL.createObjectURL(blob)
      }

      const form = new FormData()
      form.append('file', blob, imageFile.name)
      form.append('mode', segmentMode) // pass the mode
      form.append('merge_gap', gapOverride) // use the override
      const { data } = await axios.post(`${BACKEND_URL}/translate`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setApiResponse(data)
      setDisplayImageURL(finalDisplayURL)
      setRegionMode(false)
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Unknown error from server.')
    } finally {
      setIsLoading(false)
      setIsRefetching(false)
    }
  }

  // Feature 2 — apply a correction
  const handleCorrect = useCallback((wordId, newChar) => {
    setCorrections(prev => {
      const next = { ...prev, [wordId]: newChar }
      saveCorrections(next)
      return next
    })
  }, [])

  // Download corrections as JSON
  function downloadCorrections() {
    if (!apiResponse) return
    const feedback = apiResponse.words.map(w => ({
      id:            w.id,
      original:      w.modern_tamil,
      corrected:     corrections[w.id] ?? w.modern_tamil,
      was_corrected: corrections[w.id] !== undefined,
      confidence:    w.confidence,
      x: w.x, y: w.y, w: w.w, h: w.h,
    }))
    const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `corrections_${Date.now()}.json`
    a.click()
  }

  // Build effective word list (with corrections applied)
  const rawWords  = apiResponse?.words ?? []
  const words = rawWords.map(w => ({
    ...w,
    modern_tamil: corrections[w.id] ?? w.modern_tamil,
  }))

  // Build effective full sentence (with corrections)
  function buildSentence(ws) {
    if (!ws.length) return ''
    const lines = {}
    for (const w of ws) lines[w.line] = [...(lines[w.line] || []), w.modern_tamil]
    return Object.keys(lines).sort((a,b)=>a-b).map(l => lines[l].join('')).join('  ')
  }
  const effectiveSentence = words.length ? buildSentence(words) : (apiResponse?.full_sentence || '')

  const hasResult = apiResponse !== null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      overflow: 'hidden', background: 'var(--bg-primary)',
    }}>
      {isLoading && <LoadingOverlay />}

      {/* Correction Popover */}
      {popover && (
        <CorrectionPopover
          word={popover.word}
          position={{ x: popover.x, y: popover.y }}
          onCorrect={handleCorrect}
          onClose={() => setPopover(null)}
        />
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0, height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #f97316 0%, #ea6a0a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🪨</div>
          <div>
            <div className="tamil-text" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              தமிழ் கல்வெட்டு மொழிபெயர்ப்பு
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: 1 }}>
              Ancient Tamil Inscription Translator
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {hasResult && <Pill accent>✓ {words.length} words detected</Pill>}
          {Object.keys(corrections).length > 0 && (
            <Pill green>✏️ {Object.keys(corrections).length} corrected</Pill>
          )}
        </div>
      </header>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, height: 'var(--toolbar-h)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', gap: 12,
      }}>
        <UploadZone
          onFileSelect={handleFileSelect}
          onTranslate={() => handleTranslate(mergeGap)}
          imageFile={imageFile}
          imageURL={imageURL}
          isLoading={isLoading || isRefetching}
        />

        {/* ── Feature 3: Region mode toggle ── */}
        {imageURL && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => { setRegionMode(r => !r); setSelectedRegion(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 6, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: regionMode ? 'rgba(249,115,22,0.15)' : 'var(--bg-card-3)',
                color: regionMode ? 'var(--accent)' : 'var(--text-secondary)',
                outline: regionMode ? '1px solid rgba(249,115,22,0.4)' : 'none',
                transition: 'all 0.15s',
              }}
              title="Draw a rectangle to focus on a specific region of the inscription"
            >
              🔲 {regionMode ? 'Region Mode ON' : 'Select Region'}
            </button>


          </div>
        )}

        {/* ── Feature 5: Merge Gap slider (only if Smart mode) ── */}
        {imageURL && segmentMode === 'smart' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Merge Dist:
            </span>
            <input
              type="range" min={0} max={20} step={1}
              value={mergeGap}
              onChange={e => setMergeGap(Number(e.target.value))}
              onPointerUp={() => handleTranslate(mergeGap)}
              style={{ width: 60, accentColor: '#f97316', cursor: 'pointer' }}
              title="Max distance to automatically join split strokes together"
            />
            <span style={{
              fontSize: 11, fontWeight: 700, minWidth: 26,
              color: mergeGap > 0 ? '#f97316' : 'var(--text-secondary)',
            }}>
              {mergeGap}px
            </span>
          </div>
        )}

        {/* Download corrections */}
        {hasResult && Object.keys(corrections).length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            <button
              onClick={downloadCorrections}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: 'var(--green)', color: '#fff',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              📥 Export Fixes ({Object.keys(corrections).length})
            </button>
          </div>
        )}
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — canvas (58%) */}
        <div style={{
          width: '58%', display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          overflowY: 'auto', overflowX: 'hidden',
          background: 'var(--bg-primary)',
        }}>
          {error && (
            <div style={{
              flexShrink: 0, margin: '10px 16px 0', padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', fontSize: 13,
            }}>
              <strong>Error: </strong>{error}
            </div>
          )}

          {/* ── PANEL 1: Detection canvas / Region Selector ── */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              padding: '6px 14px', fontSize: 10, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-secondary)',
              background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
              borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 12 }}>
                {regionMode ? '🔲' : '🔍'}
              </span>
              {regionMode
                ? 'Region Selector — Drag to select area'
                : 'Detection View — Character Bounding Boxes'}
              {words.length > 0 && !regionMode && (
                <span style={{
                  marginLeft: 'auto', background: 'rgba(249,115,22,0.15)',
                  color: 'var(--accent)', padding: '1px 8px', borderRadius: 20,
                  fontSize: 10, fontWeight: 600,
                }}>
                  {words.length} characters
                </span>
              )}
              {regionMode && (
                <span style={{
                  marginLeft: 'auto', color: 'var(--accent)',
                  fontSize: 10, fontWeight: 600,
                }}>
                  {selectedRegion ? '✓ Region selected — click Translate' : 'Draw a rectangle on the image'}
                </span>
              )}
            </div>

            <div style={{
              padding: 12, display: 'flex', justifyContent: 'center',
              opacity: isRefetching ? 0.4 : 1, transition: 'opacity 0.2s', pointerEvents: isRefetching ? 'none' : 'auto'
            }}>
              {imageURL ? (
                regionMode ? (
                  <RegionSelector
                    imageURL={imageURL}
                    imageNaturalWidth={imageNaturalRef.current.w}
                    imageNaturalHeight={imageNaturalRef.current.h}
                    selectedRegion={selectedRegion}
                    onRegionSelect={setSelectedRegion}
                    onClear={() => setSelectedRegion(null)}
                  />
                ) : (
                  <InscriptionCanvas
                    imageURL={displayImageURL}
                    words={words}
                    imageWidth={apiResponse?.image_width}
                    imageHeight={apiResponse?.image_height}
                    hoveredWordId={hoveredWordId}
                    onWordHover={setHoveredWordId}
                    threshold={threshold}
                    corrections={corrections}
                    onWordClick={(wordId, screenX, screenY) => {
                      const word = words.find(w => w.id === wordId)
                      if (word) setPopover({ word, x: screenX + 12, y: screenY - 20 })
                    }}
                  />
                )
              ) : (
                <EmptyCanvas />
              )}
            </div>
          </div>

          {displayImageURL && (
            <div style={{ flexShrink: 0 }}>
              <div style={{
                position: 'sticky', top: 0, zIndex: 10,
                padding: '6px 14px', fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-secondary)',
                background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
                borderTop: '2px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>🖼️</span>
                Original Image — No boxes, read the full inscription
              </div>
              <div style={{ 
                padding: 12, display: 'flex', justifyContent: 'center',
                opacity: isRefetching ? 0.4 : 1, transition: 'opacity 0.2s', pointerEvents: isRefetching ? 'none' : 'auto'
              }}>
                <OriginalImageViewer
                  imageURL={displayImageURL}
                  words={words}
                  imageWidth={apiResponse?.image_width}
                  imageHeight={apiResponse?.image_height}
                  hoveredWordId={hoveredWordId}
                  onWordHover={setHoveredWordId}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — translation (42%) */}
        <div style={{
          width: '42%', display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'var(--bg-primary)',
        }}>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TranslationPanel
              words={words}
              hoveredWordId={hoveredWordId}
              onWordHover={setHoveredWordId}
              threshold={threshold}
              corrections={corrections}
              onWordClick={(wordId, screenX, screenY) => {
                const word = words.find(w => w.id === wordId)
                if (word) setPopover({ word, x: screenX + 12, y: screenY - 20 })
              }}
            />
          </div>

          <div style={{
            flexShrink: 0, padding: '12px 16px',
            borderTop: '1px solid var(--border)', background: 'var(--bg-card)',
          }}>
            <SentenceOutput
              fullSentence={effectiveSentence}
              romanSentence={apiResponse?.roman_sentence || ""}
              alternativeSentences={apiResponse?.alternative_sentences || []}
              alternativeRomanSentences={apiResponse?.alternative_roman_sentences || []}
              wordCount={apiResponse?.word_count || 0}
              lineCount={apiResponse?.line_count || 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Crop image to region (client-side) ─────────────────────────────────── */
async function cropImageToBlob(imageURL, region) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width  = region.w
          canvas.height = region.h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h)
          canvas.toBlob(blob => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create image blob'))
          }, 'image/jpeg', 0.95)
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = () => reject(new Error('Failed to load image for cropping'))
      img.src = imageURL
    } catch (err) {
      reject(err)
    }
  })
}

/* ── Small reusable components ─────────────────────────────────────────── */
function Pill({ children, accent, green }) {
  return (
    <span style={{
      fontSize: 11, padding: '3px 10px', borderRadius: 20,
      background: accent ? 'var(--accent-muted)' : green ? 'rgba(34,197,94,0.1)' : 'var(--bg-card-3)',
      color: accent ? 'var(--accent)' : green ? '#22c55e' : 'var(--text-secondary)',
      border: `1px solid ${accent ? 'rgba(249,115,22,0.25)' : green ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
      fontWeight: (accent || green) ? 600 : 400,
    }}>
      {children}
    </span>
  )
}

function EmptyCanvas() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, opacity: 0.2, userSelect: 'none',
    }}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="4" y="4" width="56" height="56" rx="10" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4"/>
        <path d="M22 38l8-10 6 7 4-5 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="20" cy="22" r="4" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        Upload an inscription image to begin
      </p>
    </div>
  )
}
