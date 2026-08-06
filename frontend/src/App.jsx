import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import axios from 'axios'
import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import UploadZone from './components/UploadZone'
import InscriptionCanvas from './components/InscriptionCanvas'
import OriginalImageViewer from './components/OriginalImageViewer'
import RegionSelector from './components/RegionSelector'
import TranslationPanel from './components/TranslationPanel'
import SentenceOutput from './components/SentenceOutput'
import LoadingOverlay from './components/LoadingOverlay'
import CorrectionPopover from './components/CorrectionPopover'
import DatasetStudio from './pages/DatasetStudio'
import MemoryStudio from './pages/MemoryStudio'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// Global Axios defaults to bypass Localtunnel 511 & Ngrok warning pages
axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true'
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'

// Global window.fetch interceptor for native fetch calls (refine-ai, dataset/stats, memory/summary)
if (typeof window !== 'undefined' && window.fetch) {
  const _origFetch = window.fetch
  window.fetch = function (url, options) {
    const opts = options || {}
    opts.headers = {
      ...(opts.headers || {}),
      'Bypass-Tunnel-Reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    }
    return _origFetch(url, opts)
  }
}

const LS_KEY = 'tamil_corrections'
function loadCorrections() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function saveCorrections(c) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)) } catch { /* noop */ }
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, ok }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px',
      background: 'var(--surface-3)',
      border: `1px solid ${ok ? 'rgba(61,163,93,0.35)' : 'rgba(142,59,59,0.35)'}`,
      borderRadius: 'var(--r-md)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      animation: 'slideUp 0.22s ease-out',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#3da35d' : '#8e3b3b', flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--fg-2)', fontWeight: 500 }}>{msg}</span>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}

export default function App() {
  const [imageFile, setImageFile]     = useState(null)
  const [imageURL, setImageURL]       = useState(null)
  const [displayImageURL, setDisplayImageURL] = useState(null)
  const [apiResponse, setApiResponse] = useState(null)
  const [isLoading, setIsLoading]     = useState(false)
  const [isRefetching, setIsRefetching] = useState(false)
  const [error, setError]             = useState(null)
  const [hoveredWordId, setHoveredWordId] = useState(null)

  const [threshold, setThreshold]     = useState(0)
  const [corrections, setCorrections] = useState({})
  const [popover, setPopover]         = useState(null)

  const [isRefiningAI, setIsRefiningAI]                             = useState(false)
  const [aiRefinedState, setAiRefinedState]                         = useState(null)
  const [aiModernTamilSentenceState, setAiModernTamilSentenceState] = useState(null)
  const [aiEnglishTranslationState, setAiEnglishTranslationState]   = useState(null)
  const [aiMeaningState, setAiMeaningState]                         = useState(null)
  const [aiEnglishMeaningState, setAiEnglishMeaningState]           = useState(null)
  const [aiWordBreakdownState, setAiWordBreakdownState]             = useState([])
  const [aiLineBreakdownState, setAiLineBreakdownState]             = useState([])

  const [regionMode, setRegionMode]         = useState(false)
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [isAddingBox, setIsAddingBox]       = useState(false)
  const imageNaturalRef                     = useRef({ w: 0, h: 0 })
  const fullInscriptionApiResponseRef       = useRef(null)

  const mergeGap = 0

  const [activePage, setActivePage] = useState('landing')
  const [toast, setToast]           = useState(null)

  const [theme, setTheme]                 = useState('dark') // 'dark' | 'light'
  const [imageFitMode, setImageFitMode]   = useState('full') // 'full' (Full Height by default) vs 'fit'
  const [windowHeight, setWindowHeight]   = useState(480)   // 380, 480, 620
  const [zoomLevel, setZoomLevel]         = useState(1.0)   // 0.6x to 2.5x

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const [isCroppedView, setIsCroppedView] = useState(false)
  const [canvasViewMode, setCanvasViewMode] = useState('both') // 'both' | 'detection' | 'original'

  // ── Derived data ──────────────────────────────────────────────────────────
  const rawWords = apiResponse?.words || []
  const words = useMemo(() => {
    const list = threshold === 0 ? rawWords : rawWords.filter(w => w.confidence >= threshold / 100)
    return sortInscriptionWords(list)
  }, [rawWords, threshold])

  const effectiveFullSentence = useMemo(() => {
    if (!words.length) return apiResponse?.full_sentence || ''
    const sorted = sortInscriptionWords(words)
    return sorted.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
  }, [words, corrections, apiResponse])

  const effectiveAlternatives = useMemo(() => {
    if (!words.length) return apiResponse?.alternative_sentences || []

    const primarySeq = words.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join('')
    if (!primarySeq) return apiResponse?.alternative_sentences || []

    const alts = new Set()

    // 1. Base backend alternative sentences mapped with current corrections
    const baseAlts = apiResponse?.alternative_sentences || []
    baseAlts.forEach(alt => {
      let mod = alt
      Object.entries(corrections).forEach(([id, char]) => {
        const target = words.find(w => String(w.id) === String(id))
        if (target && target.modern_tamil) {
          mod = mod.replaceAll(target.modern_tamil, char)
        }
      })
      if (mod && mod !== primarySeq) alts.add(mod)
    })

    // 2. Candidate substitutions from top3 and ambiguous_options
    words.forEach((word, idx) => {
      const options = (word.top3?.map(t => t.modern_tamil) || word.ambiguous_options || []).filter(c => c && c !== '?')
      options.forEach(cand => {
        const copyWords = [...words]
        copyWords[idx] = { ...word, modern_tamil: cand }
        const varSeq = copyWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join('')
        if (varSeq && varSeq !== primarySeq) alts.add(varSeq)
      })
    })

    // 3. Common Tamil Epigraphic / Grammatical Variants
    const grammaticalVariants = ['வு', 'ந்த', 'ந்தது', 'த்தல்', 'த்து', 'ன்', 'கள்', 'அ']
    grammaticalVariants.forEach(suf => {
      alts.add(primarySeq + suf)
    })

    // 4. Euphonic / Sandhi variations for classical Tamil inscriptions
    if (primarySeq.endsWith('ல்')) {
      alts.add(primarySeq.slice(0, -1) + 'ற்')
      alts.add(primarySeq.slice(0, -1) + 'ல')
    }
    if (primarySeq.endsWith('ம்')) {
      alts.add(primarySeq.slice(0, -1) + 'ந்')
      alts.add(primarySeq.slice(0, -1) + 'ங்')
    }

    const result = Array.from(alts).filter(s => s && s.trim().length > 0).slice(0, 10)
    return result.length > 0 ? result : [primarySeq]
  }, [words, corrections, apiResponse])

  const hasResult = !!apiResponse && !isLoading

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
    setIsCroppedView(false)
    setAiRefinedState(null)
    setAiMeaningState(null)
    setAiWordBreakdownState([])

    fullInscriptionApiResponseRef.current = null
    const img = new Image()
    img.onload = () => { imageNaturalRef.current = { w: img.naturalWidth, h: img.naturalHeight } }
    img.src = url
  }

  async function handleTranslate(gapOverride = mergeGap, regionOverride = selectedRegion) {
    if (!imageFile) return
    if (!apiResponse) setIsLoading(true)
    else setIsRefetching(true)
    setError(null)

    try {
      let fileToSend      = imageFile
      let finalDisplayURL = imageURL

      if (regionOverride) {
        const tempImg = new Image()
        await new Promise((resolve, reject) => {
          tempImg.onload = resolve
          tempImg.onerror = () => reject(new Error('Failed to load image for cropping'))
          tempImg.src = imageURL
          if (tempImg.complete) resolve()
        })

        const naturalW = tempImg.naturalWidth  || imageNaturalRef.current.w || 1000
        const naturalH = tempImg.naturalHeight || imageNaturalRef.current.h || 1000

        const cropX = Math.round((regionOverride.x / 100) * naturalW)
        const cropY = Math.round((regionOverride.y / 100) * naturalH)
        const cropW = Math.round((regionOverride.w / 100) * naturalW)
        const cropH = Math.round((regionOverride.h / 100) * naturalH)

        const cropCanvas  = document.createElement('canvas')
        cropCanvas.width  = Math.max(1, cropW)
        cropCanvas.height = Math.max(1, cropH)
        const ctx = cropCanvas.getContext('2d')
        ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

        const blob = await new Promise((res) => cropCanvas.toBlob(res, 'image/jpeg', 0.95))
        fileToSend      = new File([blob], 'cropped_region.jpg', { type: 'image/jpeg' })
        finalDisplayURL = URL.createObjectURL(blob)
      } else {
        finalDisplayURL = imageURL
      }

      const form = new FormData()
      form.append('file', fileToSend)
      form.append('merge_gap', String(gapOverride))

      const data = await axios.post(`${BACKEND_URL}/translate`, form, { timeout: 180000 }).then(r => r.data)
      setApiResponse(data)
      if (!regionOverride) {
        fullInscriptionApiResponseRef.current = data
      }
      setDisplayImageURL(finalDisplayURL)
      setIsCroppedView(!!regionOverride)
      setRegionMode(false)

      // Reset AI refinement state for the new translation
      setAiRefinedState(null)
      setAiMeaningState(null)
      setAiWordBreakdownState([])
      setAiLineBreakdownState([])

      showToast(regionOverride ? `Translated region (${data.words?.length || 0} characters)` : `Translated full inscription (${data.words?.length || 0} characters)`)
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.detail || err?.message || 'Server error')
      showToast('Translation failed', false)
    } finally {
      setIsLoading(false)
      setIsRefetching(false)
    }
  }

  const handleResetToFullImage = useCallback(() => {
    setSelectedRegion(null)
    setIsCroppedView(false)
    setDisplayImageURL(imageURL)
    setRegionMode(false)
    setHoveredWordId(null)
    setPopover(null)

    const cachedFull = fullInscriptionApiResponseRef.current
    const naturalW = imageNaturalRef.current?.w

    if (cachedFull && cachedFull.words && cachedFull.image_width && (!naturalW || Math.abs(cachedFull.image_width - naturalW) < 10)) {
      setApiResponse(cachedFull)
      showToast('Restored full image view')
    } else {
      // Re-trigger full image translation if cached response is missing or belonged to a cropped region
      handleTranslate(mergeGap, null)
    }
  }, [imageURL, mergeGap])

  async function handleRefineAI() {
    if (!words || words.length === 0) return
    setIsRefiningAI(true)
    try {
      const rawChars = words.map(w => corrections[w.id] || w.modern_tamil).filter(c => c && c !== '?')

      const lineMap = {}
      words.forEach(w => {
        const lNum = w.line ?? 1
        if (!lineMap[lNum]) lineMap[lNum] = []
        const char = corrections[w.id] || w.modern_tamil
        if (char && char !== '?') lineMap[lNum].push(char)
      })
      const lineGroups = Object.keys(lineMap).sort((a, b) => Number(a) - Number(b)).map(lNum => ({
        line: Number(lNum),
        text: lineMap[lNum].join('')
      }))

      const res = await fetch(`${BACKEND_URL}/refine-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_characters: rawChars,
          alternative_sentences: effectiveAlternatives,
          line_groups: lineGroups
        })
      })
      if (!res.ok) throw new Error('AI Refinement failed')
      const data = await res.json()
      setAiRefinedState(data.ai_refined_sentence)
      setAiModernTamilSentenceState(data.modern_tamil_sentence || data.ai_refined_sentence)
      setAiEnglishTranslationState(data.english_translation || '')
      setAiMeaningState(data.ai_meaning)
      setAiEnglishMeaningState(data.english_meaning || '')
      setAiWordBreakdownState(data.ai_word_breakdown || [])
      setAiLineBreakdownState(data.line_breakdown || [])
      showToast('AI refinement complete')
    } catch (err) {
      console.error(err)
      showToast('AI service rate-limited or unavailable', false)
    } finally {
      setIsRefiningAI(false)
    }
  }

function sortInscriptionWords(wordsList = []) {
  if (!wordsList || !wordsList.length) return []
  return [...wordsList].sort((a, b) => {
    // 1. Line number sort
    const lineA = a.line ?? 1
    const lineB = b.line ?? 1
    if (lineA !== lineB) return lineA - lineB

    // 2. Vertical Y coordinate center position threshold (if lines are equal or unassigned)
    const yA = (a.y || 0) + (a.h || 0) / 2
    const yB = (b.y || 0) + (b.h || 0) / 2
    const avgH = ((a.h || 30) + (b.h || 30)) / 2
    if (Math.abs(yA - yB) > avgH * 0.5) {
      return yA - yB
    }

    // 3. Horizontal X coordinate sort (Left to Right)
    return (a.x || 0) - (b.x || 0)
  })
}

function generateAlternativeSentences(wordList = [], corrMap = {}) {
  if (!wordList || !wordList.length) return []
  const sortedWords = sortInscriptionWords(wordList)
  const primarySeq = sortedWords.map(w => corrMap[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
  if (!primarySeq) return []

  const alts = new Set()
  alts.add(primarySeq)

  // 1. Collect candidate character options per position
  const positionOptions = sortedWords.map(w => {
    const primary = corrMap[w.id] ?? w.modern_tamil
    const topCandidates = (w.top3?.map(t => t.modern_tamil) || w.ambiguous_options || []).filter(c => c && c !== '?')
    const uniqueCands = Array.from(new Set([primary, ...topCandidates]))
    return uniqueCands
  })

  // 2. Multi-position Permutations spread uniformly across beginning, middle, and end of sentence
  const n = sortedWords.length
  
  // Single substitutions for every position index (0 to n-1)
  for (let idx = 0; idx < n; idx++) {
    const opts = positionOptions[idx] || []
    for (const cand of opts) {
      if (alts.size >= 80) break
      const copyWords = [...sortedWords]
      copyWords[idx] = { ...sortedWords[idx], modern_tamil: cand }
      const varSeq = copyWords.map(w => corrMap[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
      if (varSeq) alts.add(varSeq)
    }
  }

  // Dual-position substitutions across varied character distances (beginning + end, middle + end, etc.)
  for (let step = 1; step < n; step += 2) {
    for (let i = 0; i < n - step; i++) {
      const j = i + step
      const optsI = positionOptions[i] || []
      const optsJ = positionOptions[j] || []
      for (const candI of optsI) {
        for (const candJ of optsJ) {
          if (alts.size >= 120) break
          const copyWords = [...sortedWords]
          copyWords[i] = { ...sortedWords[i], modern_tamil: candI }
          copyWords[j] = { ...sortedWords[j], modern_tamil: candJ }
          const permSeq = copyWords.map(w => corrMap[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
          if (permSeq) alts.add(permSeq)
        }
      }
    }
  }

  const result = Array.from(alts).filter(s => s && s.trim().length > 0).slice(0, 20)
  return result.length > 0 ? result : [primarySeq]
}

  const handleCorrect = useCallback((wordId, newChar) => {
    const nextCorrections = { ...corrections, [wordId]: newChar }
    setCorrections(nextCorrections)
    saveCorrections(nextCorrections)

    if (apiResponse?.words) {
      const updatedWords = sortInscriptionWords(apiResponse.words.map(w => w.id === wordId ? { ...w, modern_tamil: newChar } : w))
      const updatedSeq = updatedWords.map(w => w.modern_tamil).filter(c => c && c !== '?').join(' ')
      const updatedAlts = generateAlternativeSentences(updatedWords, nextCorrections)
      setApiResponse(prev => ({
        ...prev,
        words: updatedWords,
        full_sentence: updatedSeq,
        raw_sentence: updatedSeq,
        alternative_sentences: updatedAlts,
      }))

      const word = apiResponse.words.find(w => w.id === wordId)
      if (word) {
        fetch(`${BACKEND_URL}/api/remember`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word_id: word.id, modern_tamil: newChar })
        }).catch(console.error)
      }
    }
  }, [apiResponse, corrections])

  const handleForgetMemory = useCallback((wordId) => {
    if (!apiResponse?.words) return
    const word = apiResponse.words.find(w => w.id === wordId)
    if (!word) return
    fetch(`${BACKEND_URL}/api/forget-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word_id: word.id })
    })
    .then(r => r.json())
    .then(() => { showToast(`Memory reset for #${word.id}`); handleTranslate(mergeGap) })
    .catch(console.error)
  }, [apiResponse, mergeGap])

  const classifyBoxCrop = useCallback(async (box) => {
    if (!imageFile) return box
    try {
      let fileToSend = imageFile
      if (displayImageURL && displayImageURL !== imageURL) {
        const res = await fetch(displayImageURL)
        const blob = await res.blob()
        fileToSend = new File([blob], 'region_crop.jpg', { type: 'image/jpeg' })
      }
      const form = new FormData()
      form.append('file', fileToSend)
      form.append('x', Math.round(box.x))
      form.append('y', Math.round(box.y))
      form.append('w', Math.round(box.w))
      form.append('h', Math.round(box.h))
      if (imageFile?.name) form.append('filename', imageFile.name)

      const res = await fetch(`${BACKEND_URL}/api/classify-crop`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        return {
          ...box,
          modern_tamil: data.modern_tamil || box.modern_tamil || '?',
          confidence: data.confidence || 0.85,
          top3: data.top3 || [],
        }
      }
    } catch (err) {
      console.error('Classification error:', err)
    }
    return box
  }, [imageFile, displayImageURL, imageURL])

  const handleSplitBox = useCallback(async (wordId) => {
    setPopover(null)
    if (!apiResponse || !apiResponse.words) return
    const target = apiResponse.words.find(w => w.id === wordId)
    if (!target) return

    showToast(`Classifying split boxes #${wordId}…`)
    const halfW = Math.max(5, Math.round(target.w / 2))
    const nextId = (apiResponse.words.reduce((max, w) => Math.max(max, w.id), 0) || 0) + 1

    const rawB1 = { ...target, w: halfW }
    const rawB2 = { ...target, id: nextId, x: target.x + halfW, w: target.w - halfW }

    // Run both split halves through ResNet classifier!
    const [classifiedB1, classifiedB2] = await Promise.all([
      classifyBoxCrop(rawB1),
      classifyBoxCrop(rawB2)
    ])

    const unsortedWords = apiResponse.words.flatMap(w => w.id === wordId ? [classifiedB1, classifiedB2] : [w])
    const updatedWords  = sortInscriptionWords(unsortedWords)
    const updatedSeq    = updatedWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
    const updatedAlts   = generateAlternativeSentences(updatedWords, corrections)

    setApiResponse(prev => ({
      ...prev,
      words: updatedWords,
      word_count: updatedWords.length,
      full_sentence: updatedSeq,
      raw_sentence: updatedSeq,
      alternative_sentences: updatedAlts,
    }))
    showToast(`Split & classified #${classifiedB1.id} (${classifiedB1.modern_tamil}) & #${classifiedB2.id} (${classifiedB2.modern_tamil})`)
  }, [apiResponse, classifyBoxCrop, corrections])

  const handleBoxesEdited = useCallback(async (newWords) => {
    if (!apiResponse || !apiResponse.words) return
    const resizedWord = newWords.find(nw => {
      const orig = apiResponse.words.find(ow => ow.id === nw.id)
      return orig && (orig.x !== nw.x || orig.y !== nw.y || orig.w !== nw.w || orig.h !== nw.h)
    })

    let updatedWords = newWords
    if (resizedWord) {
      showToast(`Classifying resized character box #${resizedWord.id}…`)
      const reClassified = await classifyBoxCrop(resizedWord)
      updatedWords = newWords.map(w => w.id === reClassified.id ? reClassified : w)
    }

    updatedWords = sortInscriptionWords(updatedWords)
    const updatedSeq  = updatedWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
    const updatedAlts = generateAlternativeSentences(updatedWords, corrections)

    setApiResponse(prev => ({
      ...prev,
      words: updatedWords,
      full_sentence: updatedSeq,
      raw_sentence: updatedSeq,
      alternative_sentences: updatedAlts,
    }))
  }, [apiResponse, classifyBoxCrop, corrections])

  const handleSyncTranslation = useCallback(() => {
    const rawActiveWords = apiResponse?.words || words
    if (!rawActiveWords || rawActiveWords.length === 0) return
    const activeWords = sortInscriptionWords(rawActiveWords)
    const updatedSentence = activeWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
    const updatedAlts = generateAlternativeSentences(activeWords, corrections)

    setApiResponse(prev => ({
      ...prev,
      words: activeWords,
      raw_sentence: updatedSentence,
      full_sentence: updatedSentence,
      alternative_sentences: updatedAlts,
    }))

    showToast('Synchronized sequence')
  }, [apiResponse, words, corrections])

  const handleRemoveBox = useCallback((wordId) => {
    setPopover(null)
    if (!apiResponse?.words) return
    const word = apiResponse.words.find(w => w.id === wordId)
    const updatedWords = sortInscriptionWords(apiResponse.words.filter(w => w.id !== wordId))
    const updatedSeq   = updatedWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
    const updatedAlts  = generateAlternativeSentences(updatedWords, corrections)

    setApiResponse(prev => ({
      ...prev,
      words: updatedWords,
      word_count: updatedWords.length,
      full_sentence: updatedSeq,
      raw_sentence: updatedSeq,
      alternative_sentences: updatedAlts,
    }))
    showToast(`Box #${wordId} removed`)
    if (word) {
      fetch(`${BACKEND_URL}/api/remember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: word.id, modern_tamil: '__IGNORE__' })
      }).catch(console.error)
    }
  }, [apiResponse, corrections])

  const handleManualBoxAdded = useCallback(async (newBox) => {
    setIsAddingBox(false)
    if (!apiResponse || !imageFile) return
    showToast('Classifying character…')
    try {
      let fileToSend = imageFile
      if (displayImageURL && displayImageURL !== imageURL) {
        const res = await fetch(displayImageURL)
        const blob = await res.blob()
        fileToSend = new File([blob], 'region_crop.jpg', { type: 'image/jpeg' })
      }
      const form = new FormData()
      form.append('file', fileToSend)
      form.append('x', Math.round(newBox.x))
      form.append('y', Math.round(newBox.y))
      form.append('w', Math.round(newBox.w))
      form.append('h', Math.round(newBox.h))
      if (imageFile?.name) form.append('filename', imageFile.name)

      const res = await fetch(`${BACKEND_URL}/api/classify-crop`, { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok) {
        const nextId = (apiResponse.words.reduce((max, w) => Math.max(max, w.id), 0) || 0) + 1
        const lineForBox = apiResponse.words.find(w => Math.abs((w.y + w.h / 2) - (newBox.y + newBox.h / 2)) < Math.max(w.h, newBox.h) * 0.6)?.line || 1
        const newWord = {
          id: nextId,
          x: Math.round(newBox.x), y: Math.round(newBox.y),
          w: Math.round(newBox.w), h: Math.round(newBox.h),
          modern_tamil: data.modern_tamil || '?',
          confidence: data.confidence || 0.85,
          line: lineForBox, is_unknown: false,
        }
        const updatedWords = sortInscriptionWords([...apiResponse.words, newWord])
        const updatedSeq   = updatedWords.map(w => corrections[w.id] ?? w.modern_tamil).filter(c => c && c !== '?').join(' ')
        const updatedAlts  = generateAlternativeSentences(updatedWords, corrections)

        setApiResponse(prev => ({
          ...prev,
          words: updatedWords,
          word_count: updatedWords.length,
          full_sentence: updatedSeq,
          raw_sentence: updatedSeq,
          alternative_sentences: updatedAlts,
        }))
        showToast(`Added box #${newWord.id} → ${newWord.modern_tamil}`)
      }
    } catch (err) {
      console.error(err)
      showToast('Error classifying box', false)
    }
  }, [apiResponse, imageFile, displayImageURL, imageURL, corrections])

  async function sendToDataset() {
    if (!apiResponse || !imageFile) return
    const corrected = apiResponse.words
      .filter(w => corrections[w.id] !== undefined)
      .map(w => ({ word_id: w.id, x: w.x, y: w.y, w: w.w, h: w.h, modern_tamil: corrections[w.id] }))
    if (!corrected.length) return
    showToast('Saving to dataset…')
    try {
      const res = await fetch(`${BACKEND_URL}/api/save-dataset-crop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_name: imageFile.name, corrections: corrected })
      }).then(r => r.json())
      showToast(`${res.saved_count} crops saved to dataset`)
      setCorrections({})
      saveCorrections({})
    } catch {
      showToast('Dataset save failed', false)
    }
  }



  // ── Workspace ─────────────────────────────────────────────────────────────
  const renderWorkspace = () => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 52 }}>

      {/* Upper Toolbar */}
      <div style={{
        flexShrink: 0,
        height: 52,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--line)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center',
        gap: 12,
        overflow: 'hidden',
      }}>
        {/* Upload zone */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: 580 }}>
          <UploadZone
            onFileSelect={handleFileSelect}
            onTranslate={() => handleTranslate(mergeGap)}
            imageFile={imageFile}
            imageURL={imageURL}
            isLoading={isLoading || isRefetching}
          />
        </div>

        {/* Upper Toolbar Action Buttons */}
        {imageURL && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Crop Region Button */}
            <button
              className={regionMode ? 'btn-primary' : 'btn-secondary'}
              onClick={() => { setRegionMode(r => !r); setSelectedRegion(null) }}
              style={{ padding: '7px 14px', fontSize: 13 }}
            >
              {regionMode ? 'Cancel Selection' : 'Crop Region'}
            </button>

            {/* Add Bounding Box Button */}
            <button
              className={isAddingBox ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setIsAddingBox(a => !a)}
              title="Click and drag on the image to define a new character bounding box"
              style={{ padding: '7px 14px', fontSize: 13 }}
            >
              <span>{isAddingBox ? 'Drawing Box…' : 'Add Bounding Box'}</span>
            </button>

            {/* Save Layout Memory Button */}
            <button
              className="btn-secondary"
              onClick={() => {
                if (!apiResponse?.words) return
                fetch(`${BACKEND_URL}/api/save-segmentation`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ words: apiResponse.words, image_name: imageFile?.name })
                })
                .then(() => showToast('Saved segmentation layout memory'))
                .catch(() => showToast('Save layout memory failed', false))
              }}
              title="Save all current segmentation and character changes to layout memory"
              style={{ padding: '7px 14px', fontSize: 13, color: '#3da35d', borderColor: 'rgba(61,163,93,0.4)' }}
            >
              <span>Save Layout Memory</span>
            </button>
          </div>
        )}

        {/* Export corrections button */}
        {Object.keys(corrections).length > 0 && (
          <button
            className="btn-primary"
            onClick={sendToDataset}
            style={{ padding: '7px 14px', fontSize: 13, flexShrink: 0 }}
          >
            Export {Object.keys(corrections).length} correction{Object.keys(corrections).length > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div style={{
          flexShrink: 0,
          padding: '8px 20px',
          background: 'rgba(142,59,59,0.12)',
          borderBottom: '1px solid rgba(142,59,59,0.25)',
          fontSize: 13, color: '#c87474',
        }}>
          {error}
        </div>
      )}

      {/* Workspace Main Scrollable Split Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--base)', position: 'relative' }}>
        {(isLoading || isRefetching) && (
          <LoadingOverlay message={isRefetching ? 'Re-analysing…' : 'Segmenting inscription…'} />
        )}

        {/* Top Section: Image Views (Left) + Character Breakdown Sidebar (Right 340px) */}
        <div className="workspace-split-container" style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* ── Left Panel: Image Views Area ──── */}
          <div style={{
            flex: '1',
            minWidth: 0,
            borderRight: '1px solid var(--line)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--base)',
            position: 'relative',
          }}>
            {displayImageURL ? (
              regionMode ? (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <RegionSelector
                    imageSrc={imageURL}
                    onConfirmCrop={(region) => {
                      setSelectedRegion(region)
                      handleTranslate(mergeGap, region)
                    }}
                    onCancel={() => setRegionMode(false)}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {isCroppedView && (
                    <button
                      className="btn-ghost"
                      onClick={handleResetToFullImage}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 16,
                        zIndex: 10,
                        fontSize: 11,
                        color: 'var(--copper)',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--copper-border)',
                        padding: '4px 10px',
                        borderRadius: 6,
                      }}
                    >
                      Reset to Full Image
                    </button>
                  )}

                  {/* Left Panel Scrollable Container: Images Only */}
                  <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    
                    {/* Image 1: Bounding Box Detection View */}
                    {(canvasViewMode === 'both' || canvasViewMode === 'detection') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'center' }}>
                        <div className="label" style={{ color: 'var(--copper)', letterSpacing: '0.08em' }}>
                          1. Detection View (Bounding Boxes & Character Labels)
                        </div>
                        <InscriptionCanvas
                          imageURL={displayImageURL}
                          words={words}
                          imageWidth={apiResponse?.image_width}
                          imageHeight={apiResponse?.image_height}
                          hoveredWordId={hoveredWordId}
                          onWordHover={setHoveredWordId}
                          onWordClick={(wordId, x, y) => {
                            const word = words.find(w => w.id === wordId)
                            if (word) setPopover({ word, x, y })
                          }}
                          onBoxesEdited={handleBoxesEdited}
                          onAddBoxComplete={handleManualBoxAdded}
                          isAddingBox={isAddingBox}
                          threshold={0}
                          corrections={corrections}
                          maxHeight={imageFitMode === 'fit' ? windowHeight : null}
                          zoomLevel={zoomLevel}
                        />
                      </div>
                    )}

                    {/* Image 2: Clean Original Image with 4x Zoom Lens Magnifier */}
                    {(canvasViewMode === 'both' || canvasViewMode === 'original') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div className="label" style={{ color: 'var(--fg-3)', letterSpacing: '0.08em' }}>
                          2. Original Inscription (Hover character for Spotlight & 4x Magnifier)
                        </div>
                        <OriginalImageViewer
                          imageURL={displayImageURL}
                          words={words}
                          imageWidth={apiResponse?.image_width}
                          imageHeight={apiResponse?.image_height}
                          hoveredWordId={hoveredWordId}
                          onWordHover={setHoveredWordId}
                          onWordClick={(wordId, x, y) => {
                            const word = words.find(w => w.id === wordId)
                            if (word) setPopover({ word, x, y })
                          }}
                          corrections={corrections}
                          maxHeight={imageFitMode === 'fit' ? windowHeight : null}
                          zoomLevel={zoomLevel}
                        />
                      </div>
                    )}

                  </div>
                </div>
              )
            ) : (
              /* Empty state */
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: 48, textAlign: 'center',
              }}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ opacity: 0.25 }}>
                  <rect x="1" y="1" width="54" height="54" rx="10" stroke="var(--fg)" strokeWidth="1.5"/>
                  <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
                    style={{ fontFamily: '"Noto Sans Tamil", serif', fontSize: 28, fill: 'var(--fg)' }}>
                    அ
                  </text>
                </svg>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 4 }}>
                    Upload an inscription
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--fg-4)', maxWidth: 280 }}>
                    Drag an image into the toolbar above, or click Browse to load a stone carving or palm-leaf scan.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right Panel: Pinned Character Breakdown Sidebar (340px) ──────────── */}
          <div className="character-breakdown-sidebar" style={{
            flex: '0 0 340px',
            display: 'flex', flexDirection: 'column',
            background: 'var(--base)',
            maxHeight: '680px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--copper) var(--surface-3)',
            borderRadius: 'var(--r-sm)',
            borderLeft: '1px solid var(--line)',
          }}>
            <TranslationPanel
              words={words}
              hoveredWordId={hoveredWordId}
              onWordHover={setHoveredWordId}
              threshold={0}
              corrections={corrections}
              onWordClick={(wordId, x, y) => {
                const word = words.find(w => w.id === wordId)
                if (word) setPopover({ word, x, y })
              }}
              onRemoveBox={handleRemoveBox}
            />
          </div>

        </div>

        {/* ── Full-Width Extended Bottom Area: Translation & AI Analysis Window (100% Width) ── */}
        {displayImageURL && (
          <div style={{
            width: '100%',
            padding: 16,
            boxSizing: 'border-box',
            borderTop: '1px solid var(--line)',
            background: 'var(--surface-1)',
          }}>
            <SentenceOutput
              fullSentence={effectiveFullSentence}
              rawSentence={apiResponse?.raw_sentence}
              aiRefinedSentence={aiRefinedState || apiResponse?.ai_refined_sentence}
              modernTamilSentence={aiModernTamilSentenceState || apiResponse?.modern_tamil_sentence}
              englishTranslation={aiEnglishTranslationState || apiResponse?.english_translation}
              aiMeaning={aiMeaningState || apiResponse?.ai_meaning}
              englishMeaning={aiEnglishMeaningState || apiResponse?.english_meaning}
              aiWordBreakdown={aiWordBreakdownState.length ? aiWordBreakdownState : (apiResponse?.ai_word_breakdown || [])}
              aiLineBreakdown={aiLineBreakdownState.length ? aiLineBreakdownState : (apiResponse?.line_breakdown || [])}
              alternativeSentences={effectiveAlternatives}
              onRefineAI={handleRefineAI}
              onSync={handleSyncTranslation}
              isRefiningAI={isRefiningAI}
            />
          </div>
        )}

        {/* Correction popover */}
        {popover && (
          <CorrectionPopover
            word={popover.word}
            position={{ x: popover.x, y: popover.y }}
            onCorrect={(wordId, newChar) => { handleCorrect(wordId, newChar); setPopover(null) }}
            onClose={() => setPopover(null)}
            onForgetMemory={handleForgetMemory}
            onRemoveBox={handleRemoveBox}
            onSplitBox={handleSplitBox}
          />
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Navbar activePage={activePage} setActivePage={setActivePage} theme={theme} onToggleTheme={toggleTheme} />

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {activePage === 'landing' ? (
        <LandingPage onLaunchWorkspace={() => setActivePage('translator')} />
      ) : activePage === 'memory' ? (
        <div style={{ flex: 1, paddingTop: 52 }}><MemoryStudio /></div>
      ) : activePage === 'dataset' ? (
        <div style={{ flex: 1, paddingTop: 52 }}><DatasetStudio /></div>
      ) : (
        renderWorkspace()
      )}
    </div>
  )
}
