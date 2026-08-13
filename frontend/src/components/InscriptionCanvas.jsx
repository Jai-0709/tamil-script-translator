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
  onBoxesEdited,     // callback when boxes are resized
  onAddBoxComplete, // callback when a new box is drawn
  isAddingBox = false,
  threshold = 0,
  corrections = {},
  maxHeight = null,
  zoomLevel = 1.0,
}) {
  const wrapRef   = useRef(null)
  const imgRef    = useRef(null)
  const canvasRef = useRef(null)

  // Local state for instant dragging updates
  const [localWords, setLocalWords] = useState(words)
  const [dragState, setDragState] = useState(null)
  const [drawNewState, setDrawNewState] = useState(null)
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

    if (!localWords.length) return

    const natW = img.naturalWidth || imageWidth || 1
    const natH = img.naturalHeight || imageHeight || 1
    const scaleX = width  / natW
    const scaleY = height / natH

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

      // Label badge
      const displayChar = corrections[word.id] ?? word.modern_tamil ?? '?'
      const badgeText = `${displayChar}`
      ctx.font = '600 11px Inter, "Noto Sans Tamil", sans-serif'
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

    // Render preview box when user is manually drawing a new box
    if (drawNewState) {
      const nx = Math.min(drawNewState.startX, drawNewState.currX)
      const ny = Math.min(drawNewState.startY, drawNewState.currY)
      const nw = Math.abs(drawNewState.currX - drawNewState.startX)
      const nh = Math.abs(drawNewState.currY - drawNewState.startY)

      ctx.globalAlpha = 0.25
      ctx.fillStyle   = '#f97316'
      ctx.fillRect(nx, ny, nw, nh)

      ctx.globalAlpha = 1
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth   = 2
      ctx.setLineDash([4, 4])
      ctx.strokeRect(nx, ny, nw, nh)
      ctx.setLineDash([])
    }
  }, [localWords, imageWidth, imageHeight, hoveredWordId, threshold, corrections, drawNewState])

  useEffect(() => { draw() }, [draw])

  // Keyboard Shortcuts for Bounding Box Navigation (Tab / Shift+Tab)
  useEffect(() => {
    function handleKeyDown(e) {
      if (!localWords || !localWords.length) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Tab') {
        e.preventDefault()
        const ids = localWords.map(w => w.id)
        if (!ids.length) return

        if (hoveredWordId === null) {
          onWordHover?.(ids[0])
        } else {
          const idx = ids.indexOf(hoveredWordId)
          if (e.shiftKey) {
            const nextIdx = (idx - 1 + ids.length) % ids.length
            onWordHover?.(ids[nextIdx])
          } else {
            const nextIdx = (idx + 1) % ids.length
            onWordHover?.(ids[nextIdx])
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [localWords, hoveredWordId, onWordHover])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (wrapRef.current) obs.observe(wrapRef.current)
    if (imgRef.current) obs.observe(imgRef.current)
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
    if (!canvas || !imageWidth) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    
    if (isAddingBox) {
      setDrawNewState({ startX: mx, startY: my, currX: mx, currY: my })
      e.preventDefault()
      return
    }

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
    if (!canvas || !imageWidth) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    
    // Handle manual box drawing
    if (drawNewState) {
      setDrawNewState(prev => ({ ...prev, currX: mx, currY: my }))
      return
    }

    // Handle box edge resizing
    if (dragState) {
      hasDraggedRef.current = true
      const { wordId, edge, startX, startY, initialWord } = dragState
      const scaleX = canvas.width  / imageWidth
      const scaleY = canvas.height / imageHeight

      const dxImg = (mx - startX) / scaleX
      const dyImg = (my - startY) / scaleY

      setLocalWords(prev => prev.map(w => {
        if (w.id !== wordId) return w
        let { x, y, w: width, h: height } = initialWord

        if (edge === 'left') {
          const newX = Math.min(x + dxImg, x + width - 10)
          const newW = width + (x - newX)
          x = newX
          width = newW
        } else if (edge === 'right') {
          width = Math.max(10, width + dxImg)
        } else if (edge === 'top') {
          const newY = Math.min(y + dyImg, y + height - 10)
          const newH = height + (y - newY)
          y = newY
          height = newH
        } else if (edge === 'bottom') {
          height = Math.max(10, height + dyImg)
        }

        return { ...w, x, y, w: width, h: height }
      }))
      return
    }

    // Normal hover & cursor update
    const edge = _hitEdge(mx, my, canvas.width, canvas.height)
    if (edge) {
      if (edge === 'left' || edge === 'right') canvas.style.cursor = 'ew-resize'
      else if (edge === 'top' || edge === 'bottom') canvas.style.cursor = 'ns-resize'
    } else {
      const hit = _hitTest(mx, my, canvas.width, canvas.height)
      canvas.style.cursor = isAddingBox ? 'crosshair' : (hit !== null ? 'pointer' : 'default')
      onWordHover(hit)
    }
  }

  function handlePointerUp() {
    if (drawNewState) {
      const canvas = canvasRef.current
      if (canvas && imageWidth && imageHeight) {
        const { startX, startY, currX, currY } = drawNewState
        const scaleX = canvas.width  / imageWidth
        const scaleY = canvas.height / imageHeight

        const x1 = Math.min(startX, currX) / scaleX
        const y1 = Math.min(startY, currY) / scaleY
        const w1 = Math.abs(currX - startX) / scaleX
        const h1 = Math.abs(currY - startY) / scaleY

        if (w1 > 5 && h1 > 5 && onAddBoxComplete) {
          onAddBoxComplete({ x: x1, y: y1, w: w1, h: h1 })
        }
      }
      setDrawNewState(null)
      return
    }

    if (dragState) {
      if (hasDraggedRef.current && onBoxesEdited) {
        onBoxesEdited(localWords)
      }
      setDragState(null)
    }
  }

  function handleClick(e) {
    if (isAddingBox || hasDraggedRef.current) {
      hasDraggedRef.current = false
      return
    }
    const canvas = canvasRef.current
    if (!canvas || !imageWidth) return
    const rect = canvas.getBoundingClientRect()
    const hit  = _hitTest(e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height)
    if (hit !== null) {
      onWordClick(hit, e.clientX, e.clientY)
    }
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: maxHeight ? `${maxHeight}px` : '52vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: 6,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '100%',
          maxHeight: maxHeight ? `${maxHeight}px` : '50vh',
          transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : 'none',
          transformOrigin: 'top left',
          transition: 'transform 0.15s ease-out',
        }}
      >
        <img
          ref={imgRef}
          src={imageURL}
          alt="Tamil inscription"
          onLoad={draw}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: maxHeight ? `${maxHeight}px` : '50vh',
            width: 'auto',
            height: 'auto',
            borderRadius: 6,
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
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  )
}
