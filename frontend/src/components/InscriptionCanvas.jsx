import { useRef, useEffect, useCallback, useState } from 'react'

function wordColor(id) {
  return `hsl(${(id * 47) % 360}, 70%, 60%)`
}

export default function InscriptionCanvas({
  imageURL,
  words,
  imageWidth,
  imageHeight,
  hoveredWordId,
  onWordHover,
  onWordClick,
  onBoxesEdited,     // NEW: callback when boxes are resized
  threshold = 0,
  corrections = {},
}) {
  const wrapRef   = useRef(null)
  const imgRef    = useRef(null)
  const canvasRef = useRef(null)

  // Local state for instant dragging updates
  const [localWords, setLocalWords] = useState(words)
  const [dragState, setDragState] = useState(null)
  const hasDraggedRef = useRef(false)

  // Sync prop to state when backend returns new words
  useEffect(() => {
    setLocalWords(words)
  }, [words])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    if (!localWords.length || !imageWidth || !imageHeight) return

    const scaleX = width  / imageWidth
    const scaleY = height / imageHeight

    for (const word of localWords) {
      const x = Math.round(word.x * scaleX)
      const y = Math.round(word.y * scaleY)
      const w = Math.round(word.w * scaleX)
      const h = Math.round(word.h * scaleY)

      const pct          = Math.round(word.confidence * 100)
      const isCorrected  = corrections[word.id] !== undefined || word.is_memorized
      const isLowConf    = !isCorrected && pct < threshold
      const color        = isCorrected ? '#22c55e' : isLowConf ? '#ef4444' : wordColor(word.id)
      const hovered      = word.id === hoveredWordId

      // Fill
      ctx.globalAlpha = hovered ? 0.32 : 0.12
      ctx.fillStyle   = color
      ctx.fillRect(x, y, w, h)

      // Border
      ctx.globalAlpha = 1
      ctx.strokeStyle  = color
      ctx.lineWidth    = hovered ? 2.5 : 1.5
      if (isLowConf) {
        ctx.setLineDash([4, 3])
      } else {
        ctx.setLineDash([])
      }
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      ctx.setLineDash([])
      
      // Draw drag handles if hovered
      if (hovered) {
        ctx.fillStyle = '#fff'
        ctx.lineWidth = 1.5
        const hw = 8
        // Left center
        ctx.fillRect(x - hw/2, y + h/2 - hw/2, hw, hw)
        ctx.strokeRect(x - hw/2, y + h/2 - hw/2, hw, hw)
        // Right center
        ctx.fillRect(x + w - hw/2, y + h/2 - hw/2, hw, hw)
        ctx.strokeRect(x + w - hw/2, y + h/2 - hw/2, hw, hw)
        // Top center
        ctx.fillRect(x + w/2 - hw/2, y - hw/2, hw, hw)
        ctx.strokeRect(x + w/2 - hw/2, y - hw/2, hw, hw)
        // Bottom center
        ctx.fillRect(x + w/2 - hw/2, y + h - hw/2, hw, hw)
        ctx.strokeRect(x + w/2 - hw/2, y + h - hw/2, hw, hw)
      }

      // Badge
      const displayChar = corrections[word.id] ?? word.modern_tamil ?? '?'
      const badgeText   = `${word.id}: ${displayChar}`
      ctx.font = 'bold 11px Inter, "Noto Sans Tamil", sans-serif'
      const tw = ctx.measureText(badgeText).width
      const bw = tw + 8
      const bh = 16
      const badgeY = (y - bh >= 0) ? (y - bh) : y

      ctx.globalAlpha  = hovered ? 0.95 : 0.8
      ctx.fillStyle    = isCorrected ? '#22c55e' : hovered ? '#f97316' : color
      ctx.beginPath()
      ctx.roundRect(x, badgeY, bw, bh, 3)
      ctx.fill()

      ctx.globalAlpha = 1
      ctx.fillStyle   = '#000000'
      ctx.fillText(badgeText, x + 4, badgeY + 12)

      // ✓ indicator
      if (isCorrected) {
        ctx.fillStyle   = '#22c55e'
        ctx.globalAlpha = 0.9
        ctx.font        = 'bold 11px Inter, sans-serif'
        ctx.fillText('✓', x + bw + 2, badgeY + 12)
      }
    }
  }, [localWords, imageWidth, imageHeight, hoveredWordId, threshold, corrections])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [draw])

  function _hitTest(mx, my, cw, ch) {
    const sx = cw / imageWidth
    const sy = ch / imageHeight
    for (const word of [...localWords].reverse()) {
      if (
        mx >= word.x * sx && mx <= (word.x + word.w) * sx &&
        my >= word.y * sy && my <= (word.y + word.h) * sy
      ) return word.id
    }
    return null
  }

  function _hitEdge(mx, my, cw, ch) {
    if (hoveredWordId === null) return null
    const sx = cw / imageWidth
    const sy = ch / imageHeight
    const word = localWords.find(w => w.id === hoveredWordId)
    if (!word) return null
    
    const x = word.x * sx
    const y = word.y * sy
    const w = word.w * sx
    const h = word.h * sy
    const tol = 8
    
    if (my >= y - tol && my <= y + h + tol) {
      if (Math.abs(mx - x) <= tol) return 'left'
      if (Math.abs(mx - (x + w)) <= tol) return 'right'
    }
    
    if (mx >= x - tol && mx <= x + w + tol) {
      if (Math.abs(my - y) <= tol) return 'top'
      if (Math.abs(my - (y + h)) <= tol) return 'bottom'
    }
    return null
  }

  function handlePointerDown(e) {
    const canvas = canvasRef.current
    if (!canvas || !localWords.length || !imageWidth) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    
    const edge = _hitEdge(mx, my, canvas.width, canvas.height)
    if (edge && hoveredWordId) {
      const word = localWords.find(w => w.id === hoveredWordId)
      if (word) {
        hasDraggedRef.current = false // reset flag
        setDragState({
          wordId: word.id,
          edge,
          startX: mx,
          startY: my,
          initialWord: { ...word }
        })
        e.preventDefault()
      }
    }
  }

  function handlePointerMove(e) {
    const canvas = canvasRef.current
    if (!canvas || !localWords.length || !imageWidth) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    
    if (dragState) {
      hasDraggedRef.current = true // user actually dragged
      const sx = imageWidth / canvas.width
      const sy = imageHeight / canvas.height
      const dx = (mx - dragState.startX) * sx
      const dy = (my - dragState.startY) * sy
      
      setLocalWords(prev => prev.map(w => {
        if (w.id !== dragState.wordId) return w
        let { x, y, w: width, h: height } = dragState.initialWord
        
        if (dragState.edge === 'left') {
          const rightEdge = dragState.initialWord.x + dragState.initialWord.w
          x = Math.min(x + dx, rightEdge - 5) // min width 5
          width = rightEdge - x
        } else if (dragState.edge === 'right') {
          width = Math.max(5, dragState.initialWord.w + dx)
        } else if (dragState.edge === 'top') {
          const bottomEdge = dragState.initialWord.y + dragState.initialWord.h
          y = Math.min(y + dy, bottomEdge - 5)
          height = bottomEdge - y
        } else if (dragState.edge === 'bottom') {
          height = Math.max(5, dragState.initialWord.h + dy)
        }
        return { ...w, x, y, w: width, h: height }
      }))
    } else {
      const edge = _hitEdge(mx, my, canvas.width, canvas.height)
      if (edge === 'left' || edge === 'right') canvas.style.cursor = 'ew-resize'
      else if (edge === 'top' || edge === 'bottom') canvas.style.cursor = 'ns-resize'
      else {
        const hit = _hitTest(mx, my, canvas.width, canvas.height)
        onWordHover(hit)
        canvas.style.cursor = hit ? 'pointer' : 'crosshair'
      }
    }
  }

  function handlePointerUp() {
    if (dragState) {
      if (hasDraggedRef.current && onBoxesEdited) {
        // Send the updated boxes to backend
        onBoxesEdited(localWords)
      }
      setDragState(null)
    }
  }

  function handleClick(e) {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false
      return // Ignore click if we just finished dragging
    }
    const canvas = canvasRef.current
    if (!canvas || !localWords.length || !imageWidth || !onWordClick) return
    const rect = canvas.getBoundingClientRect()
    const hit  = _hitTest(e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height)
    if (hit !== null) {
      onWordClick(hit, e.clientX, e.clientY)
    }
  }

  return (
    <div ref={wrapRef} style={{
      position: 'relative',
      width: '100%',
    }}>
      <img
        ref={imgRef}
        src={imageURL}
        alt="Tamil inscription"
        onLoad={draw}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          borderRadius: 10,
          border: '1px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        }}
      />
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          handlePointerUp()
          onWordHover(null)
        }}
        onClick={handleClick}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          borderRadius: 10,
        }}
      />
    </div>
  )
}
