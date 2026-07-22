import { useRef, useEffect, useCallback } from 'react'

/**
 * OriginalImageViewer
 *
 * - Shows the original uploaded image clean (no boxes by default)
 * - When a character is hovered from the Translation Panel:
 *     • Draws a glowing spotlight box on the image at that character's position
 *     • Shows a large zoomed-in magnifier panel (4×) in the top-right corner
 *     • Auto-scrolls to bring the character into view
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
  const canvasRef    = useRef(null)   // spotlight overlay
  const zoomRef      = useRef(null)   // magnifier canvas

  // ── Spotlight overlay ─────────────────────────────────────────────────────
  const drawSpotlight = useCallback(() => {
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

    // Add generous padding around the character so it is never clipped
    const pad = 6
    const x = Math.max(0, Math.round(word.x * scaleX) - pad)
    const y = Math.max(0, Math.round(word.y * scaleY) - pad)
    const w = Math.min(width  - x, Math.round(word.w * scaleX) + pad * 2)
    const h = Math.min(height - y, Math.round(word.h * scaleY) + pad * 2)

    // ── Dim everything outside the box (light dim so text is still readable) ─
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0,     0,     width, y)           // top
    ctx.fillRect(0,     y + h, width, height - y - h) // bottom
    ctx.fillRect(0,     y,     x,     h)           // left
    ctx.fillRect(x + w, y,     width - x - w, h)  // right

    // ── Glowing orange border ──────────────────────────────────────────────
    ctx.save()
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur  = 20
    ctx.strokeStyle = '#f97316'
    ctx.lineWidth   = 3
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.restore()

    // ── Bright inner border (white) ────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth   = 1.2
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8)

    // ── Corner marks ───────────────────────────────────────────────────────
    const cs = Math.min(16, w * 0.35, h * 0.35)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth   = 2.5
    ctx.beginPath()
    ctx.moveTo(x, y + cs);       ctx.lineTo(x, y);       ctx.lineTo(x + cs, y)
    ctx.moveTo(x + w - cs, y);   ctx.lineTo(x + w, y);   ctx.lineTo(x + w, y + cs)
    ctx.moveTo(x, y + h - cs);   ctx.lineTo(x, y + h);   ctx.lineTo(x + cs, y + h)
    ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs)
    ctx.stroke()

    // ── Small label below the box ──────────────────────────────────────────
    const label = `#${word.id}  ${word.modern_tamil || '?'}`
    ctx.font     = 'bold 13px Inter, "Noto Sans Tamil", sans-serif'
    const tw = ctx.measureText(label).width
    const bx = x
    const by = (y + h + 4 + 22 < height) ? y + h + 4 : y - 28
    const bw = tw + 14

    ctx.fillStyle   = '#f97316'
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.roundRect(bx, by, bw, 22, 5)
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.fillStyle   = '#ffffff'
    ctx.fillText(label, bx + 7, by + 15)
  }, [hoveredWordId, words, imageWidth, imageHeight])

  // ── Zoomed magnifier ──────────────────────────────────────────────────────
  const drawZoom = useCallback(() => {
    const zoomCanvas = zoomRef.current
    const img        = imgRef.current
    if (!zoomCanvas || !img || img.naturalWidth === 0) return

    const ctx = zoomCanvas.getContext('2d')
    ctx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height)

    if (!hoveredWordId || !words.length || !imageWidth || !imageHeight) return

    const word = words.find(w => w.id === hoveredWordId)
    if (!word) return

    // Source region in original image pixels (with generous padding)
    const PAD    = Math.round(Math.max(word.w, word.h) * 0.6)
    const srcX   = Math.max(0, word.x - PAD)
    const srcY   = Math.max(0, word.y - PAD)
    const srcW   = Math.min(imageWidth  - srcX, word.w + PAD * 2)
    const srcH   = Math.min(imageHeight - srcY, word.h + PAD * 2)

    // Fill the zoom canvas with the cropped region (stretched to fill)
    ctx.imageSmoothingEnabled = false   // crisp pixel rendering
    ctx.drawImage(
      img,
      srcX, srcY, srcW, srcH,
      0, 0, zoomCanvas.width, zoomCanvas.height
    )

    // ── Highlight box inside zoom canvas ──────────────────────────────────
    const zx = (word.x - srcX) / srcW * zoomCanvas.width
    const zy = (word.y - srcY) / srcH * zoomCanvas.height
    const zw = word.w / srcW * zoomCanvas.width
    const zh = word.h / srcH * zoomCanvas.height

    // Slight tint outside
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, zoomCanvas.width, zy)
    ctx.fillRect(0, zy + zh, zoomCanvas.width, zoomCanvas.height - zy - zh)
    ctx.fillRect(0, zy, zx, zh)
    ctx.fillRect(zx + zw, zy, zoomCanvas.width - zx - zw, zh)

    // Orange border
    ctx.save()
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur  = 12
    ctx.strokeStyle = '#f97316'
    ctx.lineWidth   = 3
    ctx.strokeRect(zx + 1, zy + 1, zw - 2, zh - 2)
    ctx.restore()

    // Label
    const label = word.modern_tamil || '?'
    ctx.font     = `bold ${Math.min(28, zoomCanvas.height * 0.18)}px Inter, "Noto Sans Tamil", sans-serif`
    ctx.fillStyle   = '#f97316'
    ctx.globalAlpha = 0.95
    const tw = ctx.measureText(label).width
    ctx.fillRect(4, zoomCanvas.height - 36, tw + 16, 30)
    ctx.fillStyle   = '#000000'
    ctx.globalAlpha = 1
    ctx.fillText(label, 12, zoomCanvas.height - 11)
  }, [hoveredWordId, words, imageWidth, imageHeight])

  useEffect(() => { drawSpotlight(); drawZoom() }, [drawSpotlight, drawZoom])

  // Redraw on container resize
  useEffect(() => {
    const obs = new ResizeObserver(() => { drawSpotlight(); drawZoom() })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [drawSpotlight, drawZoom])

  // Auto-scroll removed: keeping Detection View stationary while highlighting

  // ── Mouse interaction on original image ───────────────────────────────────
  function handleMouseMove(e) {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || !words.length || !imageWidth || !imageHeight) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const sx = canvas.width  / imageWidth
    const sy = canvas.height / imageHeight
    let hit = null
    for (const word of [...words].reverse()) {
      if (mx >= word.x*sx && mx <= (word.x+word.w)*sx &&
          my >= word.y*sy && my <= (word.y+word.h)*sy) {
        hit = word.id; break
      }
    }
    onWordHover(hit)
  }

  const ZOOM_SIZE = 200   // px × px zoom panel

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>

      {/* Original image */}
      <img
        ref={imgRef}
        src={imageURL}
        alt="Original inscription"
        onLoad={() => { drawSpotlight(); drawZoom() }}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          borderRadius: 10,
          border: '1px solid var(--border)',
          boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
        }}
      />

      {/* Spotlight overlay canvas */}
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

      {/* ── Zoom panel — dynamically avoids covering the hovered character ── */}
      {hoveredWordId && (() => {
        const hoveredWord = words.find(w => w.id === hoveredWordId);
        const isRightHalf = hoveredWord && imageWidth && (hoveredWord.x > imageWidth / 2);
        return (
          <div style={{
            position: 'absolute',
            top: 10,
            right: isRightHalf ? undefined : 10,
            left: isRightHalf ? 10 : undefined,
            width:  ZOOM_SIZE,
          height: ZOOM_SIZE,
          borderRadius: 12,
          border: '2px solid #f97316',
          boxShadow: '0 0 0 3px rgba(249,115,22,0.25), 0 8px 32px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          background: '#111',
          zIndex: 20,
        }}>
          {/* Header */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 24,
            background: '#f97316',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 8,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#000',
            zIndex: 2,
            textTransform: 'uppercase',
          }}>
            🔎 Zoomed In
          </div>

          <canvas
            ref={zoomRef}
            width={ZOOM_SIZE}
            height={ZOOM_SIZE}
            style={{
              position: 'absolute',
              top: 24, left: 0,
              width:  ZOOM_SIZE,
              height: ZOOM_SIZE - 24,
              imageRendering: 'pixelated',
            }}
          />
        </div>
        )
      })()}
    </div>
  )
}
