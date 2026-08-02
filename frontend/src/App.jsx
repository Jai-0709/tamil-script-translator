import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import axios from 'axios'
import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import UploadZone from './components/UploadZone'
import InscriptionCanvas from './components/InscriptionCanvas'
import OriginalImageViewer from './components/OriginalImageViewer'
import TranslationPanel from './components/TranslationPanel'
import SentenceOutput from './components/SentenceOutput'
import LoadingOverlay from './components/LoadingOverlay'
import CorrectionPopover from './components/CorrectionPopover'
import RegionSelector from './components/RegionSelector'
import DatasetStudio from './pages/DatasetStudio'
import MemoryStudio from './pages/MemoryStudio'

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

  // Theme Management
  const [theme, setTheme]                 = useState('dark')
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  // Feature 1 — Confidence threshold
  const [threshold, setThreshold]         = useState(0)

  // Feature 2 — Manual corrections
  const [corrections, setCorrections]     = useState({})   // {[wordId]: newChar}
  const [popover, setPopover]             = useState(null) // {word, x, y}

  // AI Refinement State
  const [isRefiningAI, setIsRefiningAI]   = useState(false)
  const [aiRefinedState, setAiRefinedState] = useState(null)
  const [aiMeaningState, setAiMeaningState] = useState(null)
  const [aiWordBreakdownState, setAiWordBreakdownState] = useState([])

  // Feature 3 — Region selector
  const [regionMode, setRegionMode]       = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const imageNaturalRef                   = useRef({ w: 0, h: 0 })

  // Feature 4 — Smart Hybrid YOLO Segmentation Toggle
  const [segmentMode, setSegmentMode]     = useState('smart') // 'smart' or 'classic'

  // Feature 5 — Merge Distance (Permanently 0px)
  const mergeGap                          = 0

  // Navigation: 'landing' | 'translator' | 'dataset' | 'memory'
  const [activePage, setActivePage]       = useState('landing')

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

    setAiRefinedState(null)
    setAiMeaningState(null)
    setAiWordBreakdownState([])

    // Read natural dimensions
    const img = new Image()
    img.onload = () => {
      imageNaturalRef.current = { w: img.naturalWidth, h: img.naturalHeight }
    }
    img.src = url
  }

  // 1-Click Preset Sample Selector Handler from Landing Page
  async function handleSelectSample(sample) {
    setActivePage('translator')
    setIsLoading(true)
    setError(null)
    try {
      showToast(`Loading ${sample.title}...`)
      let dataURI = ''
      if (typeof sample.getStoneDataURI === 'function') {
        dataURI = sample.getStoneDataURI()
      }
      
      let blob
      if (dataURI) {
        const res = await fetch(dataURI)
        blob = await res.blob()
      } else {
        const res = await fetch(sample.image)
        blob = await res.blob()
      }

      const file = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' })
      handleFileSelect(file)

      const form = new FormData()
      form.append('file', file)
      form.append('merge_gap', '0')

      const translateRes = await axios.post(`${BACKEND_URL}/translate`, form)
      setApiResponse(translateRes.data)
      showToast(`Decoded ${sample.title}!`)
    } catch (err) {
      console.error("Failed to auto-translate preset sample:", err)
      showToast("Error processing sample image — check backend server", false)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRefineAI() {
    if (!words || words.length === 0) return
    setIsRefiningAI(true)
    try {
      const rawChars = words.map(w => corrections[w.id] || w.modern_tamil).filter(c => c && c !== '?')
      const res = await fetch(`${BACKEND_URL}/refine-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_characters: rawChars,
          alternative_sentences: effectiveAlternatives
        })
      })
      if (!res.ok) throw new Error('AI Refinement failed')
      const data = await res.json()
      setAiRefinedState(data.ai_refined_sentence)
      setAiMeaningState(data.ai_meaning)
      setAiWordBreakdownState(data.ai_word_breakdown || [])
      showToast('Epigraphic AI Breakdown & Word Segmentations Updated!')
    } catch (err) {
      console.error(err)
      showToast('AI Refinement service rate-limited or unavailable', false)
    } finally {
      setIsRefiningAI(false)
    }
  }

  // Translate API handler
  async function handleTranslate(gapOverride = mergeGap, regionOverride = selectedRegion, customBoxes = null) {
    if (!imageFile) return
    if (!apiResponse) setIsLoading(true)
    else setIsRefetching(true)
    setError(null)

    try {
      let fileToSend = imageFile
      let finalDisplayURL = imageURL

      if (regionOverride && imageNaturalRef.current.w > 0) {
        const cropCanvas = document.createElement('canvas')
        const naturalW = imageNaturalRef.current.w
        const naturalH = imageNaturalRef.current.h
        const cropX = (regionOverride.x / 100) * naturalW
        const cropY = (regionOverride.y / 100) * naturalH
        const cropW = (regionOverride.w / 100) * naturalW
        const cropH = (regionOverride.h / 100) * naturalH

        cropCanvas.width = cropW
        cropCanvas.height = cropH
        const ctx = cropCanvas.getContext('2d')

        const tempImg = new Image()
        tempImg.src = imageURL
        await new Promise((res) => { tempImg.onload = res })

        ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

        const blob = await new Promise((res) => cropCanvas.toBlob(res, 'image/jpeg', 0.95))
        fileToSend = new File([blob], 'cropped_region.jpg', { type: 'image/jpeg' })
        finalDisplayURL = URL.createObjectURL(blob)
      }

      const form = new FormData()
      form.append('file', fileToSend)
      form.append('merge_gap', String(gapOverride))

      const data = await axios.post(`${BACKEND_URL}/translate`, form).then(r => r.data)
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

  // Feature 4 — Manually draw & add a new box
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

  // Send corrected crops directly to the backend dataset folders
  async function sendToDataset() {
    if (!apiResponse || !imageFile) return
    const corrected = apiResponse.words
      .filter(w => corrections[w.id] !== undefined)
      .map(w => ({
        word_id:      w.id,
        x: w.x, y: w.y, w: w.w, h: w.h,
        modern_tamil: corrections[w.id]
      }))

    if (!corrected.length) return
    showToast("Sending corrected crops to dataset...")

    try {
      const res = await fetch(`${BACKEND_URL}/api/save-dataset-crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_name:  imageFile.name,
          corrections: corrected
        })
      }).then(r => r.json())

      showToast(`Saved ${res.saved_count} crops to dataset folders!`)
    } catch (err) {
      showToast("Failed to save to dataset folder", false)
    }
  }

  // Filtered words based on confidence threshold
  const rawWords = apiResponse?.words || []
  const words = useMemo(() => {
    if (threshold === 0) return rawWords
    return rawWords.filter(w => w.confidence >= threshold / 100)
  }, [rawWords, threshold])

  // Recalculate Modern Tamil Sentence with corrections & thresholds
  const effectiveFullSentence = useMemo(() => {
    if (!words.length) return apiResponse?.full_sentence || ''
    return words
      .map(w => corrections[w.id] ?? w.modern_tamil)
      .filter(c => c && c !== '?')
      .join(' ')
  }, [words, corrections, apiResponse])

  // Top 10 alternative readings
  const effectiveAlternatives = useMemo(() => {
    return apiResponse?.alternative_sentences || []
  }, [apiResponse])

  const hasResult = !!apiResponse && !isLoading

  return (
    <div className="flex flex-col min-h-screen bg-[#0b0c14] text-slate-100 font-sans">
      
      {/* ── Top SaaS Navigation Bar ── */}
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      {/* ── Toast Notification Popup ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-xs font-bold shadow-2xl flex items-center gap-3 fade-up ${
          toast.ok
            ? 'bg-slate-900/95 border-emerald-500/50 text-emerald-300 shadow-emerald-500/10'
            : 'bg-slate-900/95 border-rose-500/50 text-rose-300 shadow-rose-500/10'
        }`}>
          <span>{toast.ok ? '✓' : '⚠️'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── Main View Router ── */}
      {activePage === 'landing' ? (
        <LandingPage
          onSelectSample={handleSelectSample}
          onLaunchWorkspace={() => setActivePage('translator')}
        />
      ) : activePage === 'memory' ? (
        <div className="flex-1 min-h-0">
          <MemoryStudio />
        </div>
      ) : activePage === 'dataset' ? (
        <div className="flex-1 min-h-0">
          <DatasetStudio />
        </div>
      ) : (
        /* ── Workspace Studio ── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Workspace Toolbar Controls */}
          <div className="flex-shrink-0 h-14 bg-[#121422] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 overflow-x-auto">
            <div className="flex items-center gap-3">
              <UploadZone
                onFileSelect={handleFileSelect}
                onTranslate={() => handleTranslate(mergeGap)}
                imageFile={imageFile}
                imageURL={imageURL}
                isLoading={isLoading || isRefetching}
              />

              {imageURL && (
                <button
                  onClick={() => { setRegionMode(r => !r); setSelectedRegion(null); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    regionMode
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 shadow-lg shadow-orange-500/20'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span>{regionMode ? '✂' : '🔲'}</span>
                  <span>{regionMode ? 'Region Crop Active' : 'Select Region'}</span>
                </button>
              )}
            </div>

            {/* Threshold Slider & Action Buttons */}
            {hasResult && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
                  <span className="text-[11px] font-semibold text-slate-400">Confidence:</span>
                  <input
                    type="range" min="0" max="95" value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    className="w-20 accent-orange-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-amber-400 min-w-[32px] text-right">{threshold}%</span>
                </div>

                {Object.keys(corrections).length > 0 && (
                  <button
                    onClick={sendToDataset}
                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold text-xs shadow-md transition-colors"
                  >
                    Send Corrections ({Object.keys(corrections).length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Workspace Body Grid */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left Canvas Panel */}
            <div className="w-full lg:w-[58%] border-r border-white/10 flex flex-col bg-[#090a10] relative">
              {isLoading && <LoadingOverlay message="Analyzing Inscription with Smart-Tiled YOLO Vision..." />}
              
              {displayImageURL ? (
                regionMode ? (
                  <RegionSelector
                    imageSrc={imageURL}
                    onConfirmCrop={(region) => {
                      setSelectedRegion(region)
                      handleTranslate(mergeGap, region)
                    }}
                    onCancel={() => setRegionMode(false)}
                  />
                ) : (
                  <InscriptionCanvas
                    imageSrc={displayImageURL}
                    words={words}
                    hoveredWordId={hoveredWordId}
                    setHoveredWordId={setHoveredWordId}
                    corrections={corrections}
                    onWordClick={(word, e) => {
                      const rect = e.target.getBoundingClientRect()
                      setPopover({ word, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
                    }}
                    isAddingBox={isAddingBox}
                    setIsAddingBox={setIsAddingBox}
                    onManualBoxAdded={handleManualBoxAdded}
                  />
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
                    🪨
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1 font-heading">No Inscription Loaded</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Upload an image using the top bar or try one of our pre-loaded historical sample inscriptions.
                  </p>
                </div>
              )}

              {popover && (
                <CorrectionPopover
                  word={popover.word}
                  position={{ x: popover.x, y: popover.y }}
                  currentCorrection={corrections[popover.word.id]}
                  onCorrect={(newChar) => {
                    handleCorrect(popover.word.id, newChar)
                    setPopover(null)
                  }}
                  onForgetMemory={() => handleForgetMemory(popover.word.id)}
                  onRemoveBox={() => handleRemoveBox(popover.word.id)}
                  onClose={() => setPopover(null)}
                />
              )}
            </div>

            {/* Right Panel: Recognized Symbols & AI Sentence Breakdown */}
            <div className="hidden lg:flex w-[42%] flex-col bg-[#0e101b] overflow-y-auto p-4 gap-4">
              <TranslationPanel
                words={words}
                hoveredWordId={hoveredWordId}
                setHoveredWordId={setHoveredWordId}
                corrections={corrections}
                onWordClick={(word, e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setPopover({ word, x: rect.left, y: rect.bottom + 4 })
                }}
              />

              <SentenceOutput
                fullSentence={effectiveFullSentence}
                rawSentence={apiResponse?.raw_sentence}
                aiRefinedSentence={aiRefinedState || apiResponse?.ai_refined_sentence}
                aiMeaning={aiMeaningState || apiResponse?.ai_meaning}
                aiWordBreakdown={aiWordBreakdownState.length ? aiWordBreakdownState : apiResponse?.ai_word_breakdown}
                romanSentence={apiResponse?.roman_sentence}
                alternativeSentences={effectiveAlternatives}
                alternativeRomanSentences={apiResponse?.alternative_roman_sentences || []}
                onRefineAI={handleRefineAI}
                isRefiningAI={isRefiningAI}
              />
            </div>

          </div>

        </div>
      )}

    </div>
  )
}
