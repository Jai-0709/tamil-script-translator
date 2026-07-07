import { useRef, useEffect, useCallback } from 'react'

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
  onWordClick,       // NEW: called with (wordId, screenX, screenY) on click
  threshold = 0,     // NEW: confidence threshold 0–100
  corrections = {},  // NEW: {[wordId]: correctedChar}
}) {
  const wrapRef   = useRef(null)
  const imgRef    = useRef(null)
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    if (!words.length || !imageWidth || !imageHeight) return

    const scaleX = width  / imageWidth
    const scaleY = height / imageHeight

    for (const word of words) {
      const x = Math.round(word.x * scaleX)
      const y = Math.round(word.y * scaleY)
      const w = Math.round(word.w * scaleX)
      const h = Math.round(word.h * scaleY)

      const pct        = Math.round(word.confidence * 100)
      const isCorrected  = corrections[word.id] !== undefined
      const isLowConf    = !isCorrected && pct < threshold
      const color        = isCorrected ? '#22c55e' : isLowConf ? '#ef4444' : wordColor(word.id)
      const hovered      = word.id === hoveredWordId

      // Fill
      ctx.globalAlpha = hovered ? 0.32 : 0.12
      ctx.fillStyle   = color
      ctx.fillRect(x, y, w, h)

      // Border — dashed for low-confidence, solid for normal/corrected
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

      // Badge (show corrected char if corrected)
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

      // ✓ indicator for corrected words
      if (isCorrected) {
        ctx.fillStyle   = '#22c55e'
        ctx.globalAlpha = 0.9
        ctx.font        = 'bold 11px Inter, sans-serif'
        ctx.fillText('✓', x + bw + 2, badgeY + 12)
      }
    }
  }, [words, imageWidth, imageHeight, hoveredWordId, threshold, corrections])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [draw])

  function _hitTest(mx, my, cw, ch) {
    const sx = cw / imageWidth
    const sy = ch / imageHeight
    for (const word of [...words].reverse()) {
      if (
        mx >= word.x * sx && mx <= (word.x + word.w) * sx &&
        my >= word.y * sy && my <= (word.y + word.h) * sy
      ) return word.id
    }
    return null
  }

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas || !words.length || !imageWidth || !imageHeight) return
    const rect = canvas.getBoundingClientRect()
    const hit  = _hitTest(e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height)
    onWordHover(hit)
  }

  function handleClick(e) {
    const canvas = canvasRef.current
    if (!canvas || !words.length || !imageWidth || !imageHeight || !onWordClick) return
    const rect = canvas.getBoundingClientRect()
    const hit  = _hitTest(e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height)
    if (hit !== null) {
      onWordClick(hit, e.clientX, e.clientY)
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
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
        }}
      />
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onWordHover(null)}
        onClick={handleClick}
        style={{
          position:     'absolute',
          top: 0, left: 0,
          width:  '100%',
          height: '100%',
          cursor: words.length ? 'crosshair' : 'default',
          borderRadius: 10,
        }}
      />
    </div>
  )
}
