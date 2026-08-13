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
  corrections = {},
  maxHeight = null,
  zoomLevel = 1.0,
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

    const natW = img.naturalWidth || imageWidth || 1
    const natH = img.naturalHeight || imageHeight || 1
    const scaleX = width  / natW
    const scaleY = height / natH

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
    const displayChar = corrections[word.id] ?? word.modern_tamil ?? '?'
    const label = `#${word.id}  ${displayChar}`
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
  }, [hoveredWordId, words, imageWidth, imageHeight, corrections])

  // ── Zoomed magnifier ──────────────────────────────────────────────────────
  const drawZoom = useCallback(() => {
    const zoomCanvas = zoomRef.current
    const img        = imgRef.current
    if (!zoomCanvas || !img || img.naturalWidth === 0) return

    const ctx = zoomCanvas.getContext('2d')
    const cw = zoomCanvas.width
    const ch = zoomCanvas.height
    ctx.clearRect(0, 0, cw, ch)

    if (!hoveredWordId || !words.length || !imageWidth || !imageHeight) return

    const word = words.find(w => w.id === hoveredWordId)
    if (!word) return

    // Scale word coordinates to natural image pixels
    const scaleX = img.naturalWidth / imageWidth
    const scaleY = img.naturalHeight / imageHeight

    const wordX = word.x * scaleX
    const wordY = word.y * scaleY
    const wordW = word.w * scaleX
    const wordH = word.h * scaleY

    // Source region in original image pixels (preserving 1:1 aspect ratio)
    const PAD = Math.round(Math.max(wordW, wordH) * 0.7)
    const srcX = Math.max(0, wordX - PAD)
    const srcY = Math.max(0, wordY - PAD)
    const srcW = Math.min(img.naturalWidth - srcX, wordW + PAD * 2)
    const srcH = Math.min(img.naturalHeight - srcY, wordH + PAD * 2)

    ctx.imageSmoothingEnabled = false   // crisp pixel rendering
    ctx.drawImage(
      img,
      srcX, srcY, srcW, srcH,
      0, 0, cw, ch
    )

    // Highlight box inside zoom canvas
    const zx = ((wordX - srcX) / srcW) * cw
    const zy = ((wordY - srcY) / srcH) * ch
    const zw = (wordW / srcW) * cw
    const zh = (wordH / srcH) * ch

    // Darken surrounding area in zoom preview
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.fillRect(0, 0, cw, Math.max(0, zy))
    ctx.fillRect(0, Math.min(ch, zy + zh), cw, ch - (zy + zh))
    ctx.fillRect(0, Math.max(0, zy), Math.max(0, zx), Math.min(ch, zh))
    ctx.fillRect(Math.min(cw, zx + zw), Math.max(0, zy), cw - (zx + zw), Math.min(ch, zh))

    // Glowing Orange border
    ctx.save()
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur  = 12
    ctx.strokeStyle = '#f97316'
    ctx.lineWidth   = 3
    ctx.strokeRect(zx + 1, zy + 1, zw - 2, zh - 2)
    ctx.restore()

    // Character Label Overlay
    const displayChar = corrections[word.id] ?? word.modern_tamil ?? '?'
    const label = `#${word.id} ${displayChar}`
    ctx.font     = 'bold 14px Inter, "Noto Sans Tamil", sans-serif'
    ctx.fillStyle   = '#f97316'
    ctx.globalAlpha = 0.95
    const tw = ctx.measureText(label).width
    ctx.fillRect(4, ch - 28, tw + 14, 24)
    ctx.fillStyle   = '#ffffff'
    ctx.globalAlpha = 1
    ctx.fillText(label, 11, ch - 12)
  }, [hoveredWordId, words, imageWidth, imageHeight, corrections])

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

  const ZOOM_SIZE = maxHeight ? Math.min(190, maxHeight - 24) : 190

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxHeight: maxHeight ? `${maxHeight}px` : '52vh',
        overflow: 'visible', // Ensures floating zoom popup is never clipped
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
          alt="Original Tamil inscription"
          onLoad={() => { drawSpotlight(); drawZoom() }}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: maxHeight ? `${maxHeight}px` : '50vh',
            width: 'auto',
            height: 'auto',
            borderRadius: 6,
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
            borderRadius: 6,
            cursor: words.length ? 'crosshair' : 'default',
            pointerEvents: words.length ? 'auto' : 'none',
          }}
        />
      </div>

      {/* ── Zoom panel — Dynamically sized to fit container height with ZERO clipping ── */}
      {hoveredWordId && (() => {
        const containerH = containerRef.current?.clientHeight || (maxHeight ? maxHeight : 180)
        const FLOAT_ZOOM_SIZE = Math.max(105, Math.min(160, containerH - 16))
        const hoveredWord = words.find(w => w.id === hoveredWordId);
        const isRightHalf = hoveredWord && imageWidth && (hoveredWord.x > imageWidth / 2);
        return (
          <div style={{
            position: 'absolute',
            top: 6,
            right: isRightHalf ? undefined : 12,
            left: isRightHalf ? 12 : undefined,
            width:  FLOAT_ZOOM_SIZE,
            height: FLOAT_ZOOM_SIZE,
            borderRadius: 10,
            border: '2px solid #f97316',
            boxShadow: '0 0 0 3px rgba(249,115,22,0.4), 0 8px 30px rgba(0,0,0,0.95)',
            overflow: 'hidden',
            background: '#0d0d0d',
            zIndex: 99999,
            pointerEvents: 'none',
          }}>
            {/* Header */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 20,
              background: '#f97316',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 6,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: '#000',
              zIndex: 2,
              textTransform: 'uppercase',
            }}>
              4X Zoom Magnifier
            </div>

            <canvas
              ref={zoomRef}
              width={FLOAT_ZOOM_SIZE}
              height={FLOAT_ZOOM_SIZE}
              style={{
                position: 'absolute',
                top: 20, left: 0,
                width:  FLOAT_ZOOM_SIZE,
                height: FLOAT_ZOOM_SIZE - 20,
                imageRendering: 'pixelated',
              }}
            />
          </div>
        )
      })()}
    </div>
  )
}
