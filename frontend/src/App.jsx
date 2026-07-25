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
import DatasetStudio from './pages/DatasetStudio'

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

  // Navigation
  const [activePage, setActivePage]       = useState('translator')  // 'translator' | 'dataset'

  // Toast notification
  const [toast, setToast]                 = useState(null)  // { msg, ok }
  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

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

  async function handleTranslate(gapOverride = mergeGap, regionOverride = selectedRegion, customBoxes = null) {
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
      form.append('is_region_crop', selectedRegion ? 'true' : 'false')
      if (customBoxes) {
        form.append('custom_boxes_json', JSON.stringify(customBoxes))
      }
      
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
    // 1. Update UI state instantly
    setCorrections(prev => {
      const next = { ...prev, [wordId]: newChar }
      saveCorrections(next)
      return next
    })

    // 2. Send memory trace to backend
    if (apiResponse && apiResponse.words) {
      const word = apiResponse.words.find(w => w.id === wordId)
      if (word) {
        fetch(`${BACKEND_URL}/api/remember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word_id: word.id,
            modern_tamil: newChar
          })
        }).catch(err => console.error("Failed to memorize:", err))
      }
    }
  }, [apiResponse])

  // Reset/forget vector memory for a character
  const handleForgetMemory = useCallback((wordId) => {
    if (apiResponse && apiResponse.words) {
      const word = apiResponse.words.find(w => w.id === wordId)
      if (word) {
        fetch(`${BACKEND_URL}/api/forget-memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word_id: word.id })
        })
        .then(res => res.json())
        .then(() => {
          showToast(`Forgot memory for character #${word.id}`)
          handleTranslate(mergeGap)
        })
        .catch(err => console.error("Failed to forget memory:", err))
      }
    }
  }, [apiResponse, mergeGap])

  // Feature 3 — Remove/Delete a box manually
  const handleRemoveBox = useCallback((wordId) => {
    setPopover(null)
    if (!apiResponse || !apiResponse.words) return
    const word = apiResponse.words.find(w => w.id === wordId)
    const updatedWords = apiResponse.words.filter(w => w.id !== wordId)

    setApiResponse(prev => ({
      ...prev,
      words: updatedWords,
      word_count: updatedWords.length,
    }))
    showToast(`Removed Box #${wordId}`)

    // Store in backend vector memory as __IGNORE__ so future uploads auto-suppress this box!
    if (word) {
      fetch(`${BACKEND_URL}/api/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word_id: word.id,
          modern_tamil: '__IGNORE__'
        })
      }).catch(err => console.error("Failed to memorize ignored box:", err))
    }
  }, [apiResponse])

  // Feature 4 — Manually draw & add a new box for unsegmented characters
  const [isAddingBox, setIsAddingBox] = useState(false)

  const handleManualBoxAdded = useCallback(async (newBox) => {
    setIsAddingBox(false)
    if (!apiResponse || !imageFile) return
    showToast("Classifying custom character box...")
    
    try {
      let fileToSend = imageFile
      if (displayImageURL && displayImageURL !== imageURL) {
        const res = await fetch(displayImageURL)
        const blob = await res.blob()
        fileToSend = new File([blob], "region_crop.jpg", { type: "image/jpeg" })
      }

      const form = new FormData()
      form.append('file', fileToSend)
      form.append('x', Math.round(newBox.x))
      form.append('y', Math.round(newBox.y))
      form.append('w', Math.round(newBox.w))
      form.append('h', Math.round(newBox.h))
      if (imageFile && imageFile.name) {
        form.append('filename', imageFile.name)
      }

      const res = await fetch(`${BACKEND_URL}/api/classify-crop`, {
        method: 'POST',
        body: form
      })
      
      const data = await res.json()
      if (res.ok) {
        const nextId = (apiResponse.words.reduce((max, w) => Math.max(max, w.id), 0) || 0) + 1
        const newWord = {
          id: nextId,
          x: Math.round(newBox.x),
          y: Math.round(newBox.y),
          w: Math.round(newBox.w),
          h: Math.round(newBox.h),
          modern_tamil: data.modern_tamil || '?',
          confidence: data.confidence || 0.85,
          line: 1,
          is_unknown: false
        }
        
        const updatedWords = [...apiResponse.words, newWord].sort((a, b) => a.x - b.x)
        setApiResponse(prev => ({
          ...prev,
          words: updatedWords,
          word_count: updatedWords.length
        }))
        showToast(`Added Box #${newWord.id} (${newWord.modern_tamil})`)
      }
    } catch (err) {
      console.error("Failed to classify custom crop:", err)
      showToast("Error adding manual box", false)
    }
  }, [apiResponse, imageFile, displayImageURL, imageURL])

  // Save final segmentation layout and memory to disk
  const handleSaveFinalSegmentation = useCallback(async () => {
    if (!apiResponse || !apiResponse.words || !imageFile) {
      showToast("No active segmentation to save", false)
      return
    }
    showToast("Saving final segmentation memory...")
    try {
      const finalBoxes = apiResponse.words.map(w => ({
        x: w.x, y: w.y, w: w.w, h: w.h,
        modern_tamil: corrections[w.id] ?? w.modern_tamil
      }))

      const res = await fetch(`${BACKEND_URL}/api/save-final-segmentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: imageFile.name,
          boxes: finalBoxes
        })
      })

      const data = await res.json()
      if (res.ok) {
        showToast(`Saved final segmentation (${data.saved_count} boxes) to memory!`)
      } else {
        showToast("Failed to save final segmentation", false)
      }
    } catch (err) {
      console.error("Error saving final segmentation:", err)
      showToast("Connection error — is backend running?", false)
    }
  }, [apiResponse, imageFile, corrections])

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

  // Send corrected crops directly to the backend dataset folders
  async function sendToDataset() {
    if (!apiResponse || !imageFile) return
    const corrected = apiResponse.words
      .filter(w => corrections[w.id] !== undefined)
      .map(w => ({
        corrected: corrections[w.id],
        x: w.x, y: w.y, w: w.w, h: w.h,
        orig_w: apiResponse.image_width,
        orig_h: apiResponse.image_height,
      }))
    if (corrected.length === 0) { showToast('No corrections to send!', false); return }

    let fileToSend = imageFile
    if (displayImageURL && displayImageURL !== imageURL) {
      try {
        const res = await fetch(displayImageURL)
        const blob = await res.blob()
        fileToSend = new File([blob], "region_crop.jpg", { type: "image/jpeg" })
      } catch (e) {
        console.error("Error creating blob from displayImageURL", e)
      }
    }

    const form = new FormData()
    form.append('file', fileToSend)
    form.append('corrections', JSON.stringify(corrected))
    try {
      const res  = await fetch(`${BACKEND_URL}/api/dataset/add-crops`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        showToast(`Saved ${data.saved} crop${data.saved !== 1 ? 's' : ''} to Dataset!`)
        setCorrections({})
      } else {
        showToast('Failed to save crops', false)
      }
    } catch {
      showToast('Connection error — is the backend running?', false)
    }
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

  // ── Dataset Studio page (full screen swap) ────────────────────────────
  if (activePage === 'dataset') {
    return <DatasetStudio onBack={() => setActivePage('translator')} />
  }

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
          onForgetMemory={handleForgetMemory}
          onRemoveBox={handleRemoveBox}
          onClose={() => setPopover(null)}
          onSplitBox={(wordId) => {
            setPopover(null)
            if (!apiResponse || !apiResponse.words) return
            const words = [...apiResponse.words]
            const idx = words.findIndex(w => w.id === wordId)
            if (idx === -1) return
            
            const w = words[idx]
            words.splice(idx, 1)
            
            const wHalf = Math.floor(w.w / 2)
            const box1 = { ...w, id: Date.now(), w: wHalf }
            const box2 = { ...w, id: Date.now()+1, x: w.x + wHalf, w: w.w - wHalf }
            
            words.splice(idx, 0, box1, box2)
            
            const newBoxes = words.map(wd => ({ x: wd.x, y: wd.y, w: wd.w, h: wd.h, line: wd.line }))
            handleTranslate(mergeGap, selectedRegion, newBoxes)
          }}
        />
      )}

      {/* ══ HEADER ══════════════════════════════════════════════════════ */}
      <header style={{
        flexShrink: 0, height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', background: '#0e1017',
        borderBottom: '1px solid var(--border)',
        zIndex: 50,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#fff', fontWeight: 700, flexShrink: 0,
          }}>
            🪨
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tamil-text" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                தமிழ் கல்வெட்டு மொழிபெயர்ப்பு
              </span>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.2)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                Online
              </span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: 1 }}>
              Ancient Tamil Inscription Translation Platform
            </div>
          </div>
        </div>

        {/* Header Right / Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Navigation tabs */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--bg-card-2)',
            borderRadius: 8, padding: 3,
            border: '1px solid var(--border)',
          }}>
            {[
              ['translator', 'Translator'],
              ['dataset', 'Dataset Studio']
            ].map(([page, label]) => (
              <button
                key={page}
                onClick={() => setActivePage(page)}
                style={{
                  height: 32, padding: '0 16px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: activePage === page ? 'linear-gradient(135deg, #f97316 0%, #ea6a0a 100%)' : 'transparent',
                  color: activePage === page ? '#fff' : 'var(--text-secondary)',
                  boxShadow: activePage === page ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      </header>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, height: 'var(--toolbar-h)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)', gap: 14,
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
          <button
            onClick={() => { setRegionMode(r => !r); setSelectedRegion(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              height: 36, padding: '0 16px', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              background: regionMode ? 'rgba(249,115,22,0.18)' : 'var(--bg-card-2)',
              color: regionMode ? '#f97316' : 'var(--text-primary)',
              border: regionMode ? '1px solid rgba(249,115,22,0.4)' : '1px solid var(--border)',
              boxShadow: regionMode ? '0 0 12px rgba(249,115,22,0.2)' : 'none',
              transition: 'all 0.15s ease',
            }}
            title="Crop & translate a specific region of interest"
          >
            <span style={{ fontSize: 13 }}>{regionMode ? '✂' : '🔲'}</span>
            {regionMode ? 'Region Crop Active' : 'Select Region'}
          </button>
        )}

        {/* ── Feature 5: Redesigned Easy-Access Merge Gap Control ── */}
        {imageURL && segmentMode === 'smart' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 10px',
            background: 'var(--bg-card-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Merge Gap
            </span>

            {/* Stepper − button */}
            <button
              onClick={() => setMergeGap(m => Math.max(0, m - 1))}
              disabled={mergeGap <= 0}
              style={{
                width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                background: mergeGap <= 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
                color: mergeGap <= 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 14, fontWeight: 700, cursor: mergeGap <= 0 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
              title="Decrease merge gap"
            >−</button>

            {/* Smooth range slider */}
            <input
              type="range" min={0} max={20} step={1}
              value={mergeGap}
              onChange={e => setMergeGap(Number(e.target.value))}
              style={{
                width: 80, height: 4, accentColor: '#f97316', cursor: 'pointer',
                borderRadius: 2, background: 'rgba(255,255,255,0.1)'
              }}
              title="Adjust maximum stroke merging distance"
            />

            {/* Stepper + button */}
            <button
              onClick={() => setMergeGap(m => Math.min(20, m + 1))}
              disabled={mergeGap >= 20}
              style={{
                width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)',
                background: mergeGap >= 20 ? 'transparent' : 'rgba(255,255,255,0.06)',
                color: mergeGap >= 20 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 14, fontWeight: 700, cursor: mergeGap >= 20 ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
              title="Increase merge gap"
            >+</button>

            {/* Digital Badge */}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
              background: mergeGap > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
              color: mergeGap > 0 ? '#f97316' : 'var(--text-secondary)',
              border: `1px solid ${mergeGap > 0 ? 'rgba(249,115,22,0.3)' : 'var(--border)'}`,
              minWidth: 36, textAlign: 'center',
            }}>
              {mergeGap}px
            </span>
          </div>
        )}

        {/* Send to Dataset */}
        {hasResult && Object.keys(corrections).length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <button
              id="btn-send-dataset"
              onClick={sendToDataset}
              style={{
                padding: '7px 16px', borderRadius: 7, border: 'none',
                background: '#f97316',
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background='#ea580c' }}
              onMouseLeave={e => { e.currentTarget.style.background='#f97316' }}
            >
              Send to Dataset ({Object.keys(corrections).length})
            </button>
          </div>
        )}
      </div>

      {/* ══ KPI METRICS STRIP ═════════════════════════════════════════ */}
      {hasResult && (
        <div style={{
          flexShrink: 0, padding: '8px 24px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {[
            {
              label: 'Detected Characters',
              val: words.length,
              unit: 'chars',
              color: '#f97316'
            },
            {
              label: 'Average Confidence',
              val: `${words.length ? Math.round(words.reduce((s,w)=>s+w.confidence, 0) / words.length * 100) : 0}%`,
              unit: 'score',
              color: '#22c55e'
            },
            {
              label: 'Lines Segmented',
              val: apiResponse?.line_count || 1,
              unit: apiResponse?.line_count === 1 ? 'line' : 'lines',
              color: '#3b82f6'
            },
            {
              label: 'User Fixes',
              val: Object.keys(corrections).length,
              unit: 'active',
              color: Object.keys(corrections).length > 0 ? '#22c55e' : '#64748b'
            }
          ].map(kpi => (
            <div key={kpi.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255, 255, 255, 0.025)',
              border: '1px solid var(--border)',
              borderRadius: 8, padding: '6px 16px', flex: 1,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: kpi.color, lineHeight: 1.1 }}>
                  {kpi.val} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>{kpi.unit}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                  {kpi.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
              flexShrink: 0, margin: '12px 16px 0', padding: '12px 16px', borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171', fontSize: 13,
            }}>
              <strong>Error: </strong>{error}
            </div>
          )}

          {/* ── PANEL 1: Detection canvas / Region Selector ── */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              padding: '8px 16px', fontSize: 11, letterSpacing: '0.06em',
              fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)',
              background: '#0e1017',
              borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {regionMode
                ? 'Region Selector — Drag to select focus area'
                : 'Bounding Box Segmentation View'}
              {words.length > 0 && !regionMode && (
                <span style={{
                  marginLeft: 'auto', background: 'rgba(249, 115, 22, 0.12)',
                  color: 'var(--accent)', border: '1px solid rgba(249, 115, 22, 0.25)',
                  padding: '2px 8px', borderRadius: 12,
                  fontSize: 10, fontWeight: 700,
                }}>
                  {words.length} items
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
              padding: 14, width: '100%', boxSizing: 'border-box',
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
                    isAddingBox={isAddingBox}
                    onAddBoxComplete={handleManualBoxAdded}
                    onWordClick={(wordId, screenX, screenY) => {
                      const word = words.find(w => w.id === wordId)
                      if (word) setPopover({ word, x: screenX + 12, y: screenY - 20 })
                    }}
                    onBoxesEdited={(newBoxes) => handleTranslate(mergeGap, selectedRegion, newBoxes)}
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
                padding: 14, width: '100%', boxSizing: 'border-box',
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
              onRemoveBox={handleRemoveBox}
              isAddingBox={isAddingBox}
              onAddBoxClick={() => setIsAddingBox(prev => !prev)}
              onSaveSegmentation={handleSaveFinalSegmentation}
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

      {/* ── Toast notification ────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          padding: '10px 22px', borderRadius: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 9999, pointerEvents: 'none',
          animation: 'fadeInUpToast 0.25s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes fadeInUpToast {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
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
