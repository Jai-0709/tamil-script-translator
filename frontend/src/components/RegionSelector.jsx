import { useRef, useState, useEffect } from 'react'

/**
 * RegionSelector
 *
 * Renders over the uploaded image (before translation).
 * User drags a rectangle → emits onRegionSelect({x,y,w,h}) as pixel coords
 * relative to the natural image dimensions.
 * Shows Clear and "Translate Region" UI.
 */
export default function RegionSelector({
  imageURL,
  imageNaturalWidth,
  imageNaturalHeight,
  onRegionSelect,
  onClear,
  selectedRegion,   // {x,y,w,h} in natural image px, or null
}) {
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [startPx,  setStartPx]  = useState(null)   // screen px relative to canvas
  const [endPx,    setEndPx]    = useState(null)

  // Draw selection rectangle
  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    // Draw active drag
    if (dragging && startPx && endPx) {
      drawRect(ctx, startPx, endPx, width, height)
      return
    }

    // Draw committed region
    if (selectedRegion && imageNaturalWidth && imageNaturalHeight) {
      const sx = width  / imageNaturalWidth
      const sy = height / imageNaturalHeight
      const rx = selectedRegion.x * sx
      const ry = selectedRegion.y * sy
      const rw = selectedRegion.w * sx
      const rh = selectedRegion.h * sy

      // Dim outside
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, width, ry)
      ctx.fillRect(0, ry + rh, width, height - ry - rh)
      ctx.fillRect(0, ry, rx, rh)
      ctx.fillRect(rx + rw, ry, width - rx - rw, rh)

      // Border
      ctx.save()
      ctx.strokeStyle = '#f97316'
      ctx.shadowColor = '#f97316'
      ctx.shadowBlur  = 10
      ctx.lineWidth   = 2.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2)
      ctx.restore()

      // Label
      ctx.fillStyle = '#f97316'
      ctx.font      = 'bold 11px Inter, sans-serif'
      ctx.fillText('Selected Region', rx + 4, ry > 18 ? ry - 4 : ry + 16)
    }
  }, [dragging, startPx, endPx, selectedRegion, imageNaturalWidth, imageNaturalHeight])

  function drawRect(ctx, a, b, cw, ch) {
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x)
    const h = Math.abs(b.y - a.y)
    if (w < 5 || h < 5) return

    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, cw, y)
    ctx.fillRect(0, y + h, cw, ch - y - h)
    ctx.fillRect(0, y, x, h)
    ctx.fillRect(x + w, y, cw - x - w, h)

    ctx.save()
    ctx.strokeStyle = '#f97316'
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur  = 8
    ctx.lineWidth   = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
    ctx.restore()
  }

  function getCanvasPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(e.clientX - rect.left, rect.width)),
      y: Math.max(0, Math.min(e.clientY - rect.top,  rect.height)),
    }
  }

  function onMouseDown(e) {
    e.preventDefault()
    const pos = getCanvasPos(e)
    setDragging(true)
    setStartPx(pos)
    setEndPx(pos)
    onClear()    // clear any committed region while dragging
  }

  function onMouseMove(e) {
    if (!dragging) return
    setEndPx(getCanvasPos(e))
  }

  function onMouseUp(e) {
    if (!dragging) return
    setDragging(false)
    const endPos = getCanvasPos(e)
    setEndPx(endPos)

    // Convert to natural image coordinates
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    const scaleX = img.naturalWidth  / width
    const scaleY = img.naturalHeight / height

    const x = Math.round(Math.min(startPx.x, endPos.x) * scaleX)
    const y = Math.round(Math.min(startPx.y, endPos.y) * scaleY)
    const w = Math.round(Math.abs(endPos.x - startPx.x) * scaleX)
    const h = Math.round(Math.abs(endPos.y - startPx.y) * scaleY)

    if (w > 10 && h > 10) {
      onRegionSelect({ x, y, w, h })
    } else {
      onClear()
    }
    setStartPx(null)
    setEndPx(null)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <img
        ref={imgRef}
        src={imageURL}
        alt="Select region"
        onLoad={() => {
          // trigger redraw on load
          setStartPx(s => s)
        }}
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          borderRadius: 10,
          border: '1px solid var(--border)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          borderRadius: 10,
          cursor: 'crosshair',
        }}
      />

      {/* Instruction overlay — shown when no region yet */}
      {!selectedRegion && !dragging && (
        <div style={{
          position: 'absolute',
          bottom: 12, left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(249,115,22,0.4)',
          borderRadius: 20,
          padding: '5px 14px',
          fontSize: 11,
          color: '#ccc',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          🔲 Drag to select a region, then click Translate
        </div>
      )}

      {/* Clear button when region committed */}
      {selectedRegion && (
        <button
          onClick={onClear}
          style={{
            position: 'absolute',
            top: 10, right: 10,
            background: 'rgba(0,0,0,0.7)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: '#ef4444',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 10px',
          }}
        >
          ✕ Clear Region
        </button>
      )}
    </div>
  )
}
