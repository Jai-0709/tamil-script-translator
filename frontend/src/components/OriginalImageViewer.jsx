import { useRef, useEffect, useCallback } from 'react'

/**
 * OriginalImageViewer
 *
 * Renders the original uploaded image with a glowing highlight box drawn
 * over the character that is currently hovered in the Translation Panel.
 * Automatically scrolls to bring the highlighted character into view.
 */
export default function OriginalImageViewer({
  imageURL,
  words,
  imageWidth,
  imageHeight,
  hoveredWordId,
  onWordHover,
}) {
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)

  // ── Draw highlight on canvas ───────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    if (!hoveredWordId || !words.length || !imageWidth || !imageHeight) return

    const word = words.find(w => w.id === hoveredWordId)
    if (!word) return

    const scaleX = width  / imageWidth
    const scaleY = height / imageHeight

    const x = Math.round(word.x * scaleX)
    const y = Math.round(word.y * scaleY)
    const w = Math.round(word.w * scaleX)
    const h = Math.round(word.h * scaleY)

    // ── Dim everything outside the highlighted box ──────────────────────────
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    // Top
    ctx.fillRect(0, 0, width, y)
    // Bottom
    ctx.fillRect(0, y + h, width, height - (y + h))
    // Left
    ctx.fillRect(0, y, x, h)
    // Right
    ctx.fillRect(x + w, y, width - (x + w), h)

    // ── Glowing orange border ───────────────────────────────────────────────
    ctx.save()
    ctx.shadowColor  = '#f97316'
    ctx.shadowBlur   = 18
    ctx.strokeStyle  = '#f97316'
    ctx.lineWidth    = 3
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.restore()

    // ── Corner accent marks ─────────────────────────────────────────────────
    const cs = Math.min(14, w * 0.3, h * 0.3)  // corner size
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 2.5
    ctx.beginPath()
    // top-left
    ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y)
    // top-right
    ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs)
    // bottom-left
    ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h)
    // bottom-right
    ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs)
    ctx.stroke()

    // ── Label badge below the box ───────────────────────────────────────────
    const label  = `#${word.id}  ${word.modern_tamil || '?'}`
    ctx.font     = 'bold 14px Inter, "Noto Sans Tamil", sans-serif'
    const tw     = ctx.measureText(label).width
    const bx     = x
    const by     = (y + h + 4 + 22 < height) ? y + h + 4 : y - 26
    const bw     = tw + 14
    const bh     = 22

    ctx.fillStyle    = '#f97316'
    ctx.globalAlpha  = 0.95
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, bh, 5)
    ctx.fill()

    ctx.globalAlpha  = 1
    ctx.fillStyle    = '#ffffff'
    ctx.fillText(label, bx + 7, by + 16)
  }, [hoveredWordId, words, imageWidth, imageHeight])

  useEffect(() => { draw() }, [draw])

  // Redraw on container resize
  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [draw])

  // ── Auto-scroll to the highlighted character ───────────────────────────────
  useEffect(() => {
    if (!hoveredWordId || !words.length || !imageWidth || !imageHeight) return
    const word = words.find(w => w.id === hoveredWordId)
    if (!word || !imgRef.current || !containerRef.current) return

    const img = imgRef.current
    if (img.naturalWidth === 0) return

    const { height: renderedH } = img.getBoundingClientRect()
    const scaleY   = renderedH / imageHeight
    const charMidY = (word.y + word.h / 2) * scaleY

    // Scroll the scrollable left panel so the char center is in view
    // Walk up the DOM to find the scrollable ancestor
    let el = containerRef.current.parentElement
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        // Offset from scrollable container top
        const containerTop = containerRef.current.getBoundingClientRect().top
        const elTop        = el.getBoundingClientRect().top
        const relativeTop  = containerTop - elTop + el.scrollTop

        const targetScroll = relativeTop + charMidY - el.clientHeight / 2
        el.scrollTo({ top: targetScroll, behavior: 'smooth' })
        break
      }
      el = el.parentElement
    }
  }, [hoveredWordId, words, imageWidth, imageHeight])

  // ── Mouse interaction on the original image ────────────────────────────────
  function handleMouseMove(e) {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || !words.length || !imageWidth || !imageHeight) return

    const rect = canvas.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const my   = e.clientY - rect.top
    const sx   = canvas.width  / imageWidth
    const sy   = canvas.height / imageHeight

    let hit = null
    for (const word of [...words].reverse()) {
      if (
        mx >= word.x * sx && mx <= (word.x + word.w) * sx &&
        my >= word.y * sy && my <= (word.y + word.h) * sy
      ) { hit = word.id; break }
    }
    onWordHover(hit)
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
    >
      <img
        ref={imgRef}
        src={imageURL}
        alt="Original inscription"
        onLoad={draw}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          borderRadius: 10,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
        }}
      />
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onWordHover(null)}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          borderRadius: 10,
          cursor: words.length ? 'crosshair' : 'default',
          pointerEvents: words.length ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
