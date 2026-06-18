import { useState } from 'react'
import axios from 'axios'
import UploadZone from './components/UploadZone'
import InscriptionCanvas from './components/InscriptionCanvas'
import TranslationPanel from './components/TranslationPanel'
import SentenceOutput from './components/SentenceOutput'
import LoadingOverlay from './components/LoadingOverlay'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function App() {
  const [imageFile, setImageFile]         = useState(null)
  const [imageURL, setImageURL]           = useState(null)
  const [apiResponse, setApiResponse]     = useState(null)
  const [isLoading, setIsLoading]         = useState(false)
  const [error, setError]                 = useState(null)
  const [hoveredWordId, setHoveredWordId] = useState(null)

  function handleFileSelect(file) {
    setImageFile(file)
    setImageURL(URL.createObjectURL(file))
    setApiResponse(null)
    setError(null)
    setHoveredWordId(null)
  }

  async function handleTranslate() {
    if (!imageFile) return
    setIsLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', imageFile)
      const { data } = await axios.post(`${BACKEND_URL}/translate`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setApiResponse(data)
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Unknown error from server.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const words     = apiResponse?.words ?? []
  const hasResult = apiResponse !== null

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      {isLoading && <LoadingOverlay />}

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0,
        height: 'var(--header-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #f97316 0%, #ea6a0a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🪨</div>
          <div>
            <div className="tamil-text" style={{
              fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              தமிழ் கல்வெட்டு மொழிபெயர்ப்பு
            </div>
            <div style={{
              fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--text-secondary)', marginTop: 1,
            }}>
              Ancient Tamil Inscription Translator
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pill>EfficientNet-B0</Pill>
          <Pill>28 classes</Pill>
          {hasResult && (
            <Pill accent>✓ {words.length} words detected</Pill>
          )}
        </div>
      </header>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0,
        height: 'var(--toolbar-h)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        gap: 12,
      }}>
        <UploadZone
          onFileSelect={handleFileSelect}
          onTranslate={handleTranslate}
          imageFile={imageFile}
          imageURL={imageURL}
          isLoading={isLoading}
        />
      </div>

      {/* ══ BODY ════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* LEFT — canvas (58%) */}
        <div style={{
          width: '58%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Error banner */}
          {error && (
            <div style={{
              flexShrink: 0,
              margin: '10px 16px 0',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171',
              fontSize: 13,
            }}>
              <strong>Error: </strong>{error}
            </div>
          )}

          {/* Canvas area — fills remaining height, image contained inside */}
          <div style={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'var(--bg-primary)',
          }}>
            {imageURL ? (
              <InscriptionCanvas
                imageURL={imageURL}
                words={words}
                imageWidth={apiResponse?.image_width}
                imageHeight={apiResponse?.image_height}
                hoveredWordId={hoveredWordId}
                onWordHover={setHoveredWordId}
              />
            ) : (
              <EmptyCanvas />
            )}
          </div>
        </div>

        {/* RIGHT — translation (42%) */}
        <div style={{
          width: '42%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
        }}>
          {/* Translation word list */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TranslationPanel
              words={words}
              hoveredWordId={hoveredWordId}
              onWordHover={setHoveredWordId}
            />
          </div>

          {/* Sentence output — always visible at bottom */}
          <div style={{
            flexShrink: 0,
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}>
            <SentenceOutput
              fullSentence={apiResponse?.full_sentence || ""}
              wordCount={apiResponse?.word_count || 0}
              lineCount={apiResponse?.line_count || 0}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Small reusable components ─────────────────────────────────────────── */
function Pill({ children, accent }) {
  return (
    <span style={{
      fontSize: 11,
      padding: '3px 10px',
      borderRadius: 20,
      background: accent ? 'var(--accent-muted)' : 'var(--bg-card-3)',
      color: accent ? 'var(--accent)' : 'var(--text-secondary)',
      border: `1px solid ${accent ? 'rgba(249,115,22,0.25)' : 'var(--border)'}`,
      fontWeight: accent ? 600 : 400,
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
        <rect x="4" y="4" width="56" height="56" rx="10"
          stroke="currentColor" strokeWidth="2" strokeDasharray="6 4"/>
        <path d="M22 38l8-10 6 7 4-5 8 8" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="20" cy="22" r="4" stroke="currentColor" strokeWidth="2"/>
      </svg>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        Upload an inscription image to begin
      </p>
    </div>
  )
}
