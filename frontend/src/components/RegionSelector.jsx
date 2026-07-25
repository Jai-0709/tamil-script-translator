import { useRef, useState, useEffect } from 'react'

export default function RegionSelector({
  imageURL,
  imageNaturalWidth,
  imageNaturalHeight,
  onRegionSelect,
  onClear,
  selectedRegion,
}) {
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [startPx,  setStartPx]  = useState(null)
  const [endPx,    setEndPx]    = useState(null)

  const [resizingHandle, setResizingHandle] = useState(null)
  const [resizeStart, setResizeStart] = useState(null)
  const [hoverHandle, setHoverHandle] = useState(null)

  const HANDLE_SIZE = 12

  function getHandles(region, cw, ch, imgW, imgH) {
    if (!region) return []
    const sx = cw / imgW
    const sy = ch / imgH
    const rx = region.x * sx
    const ry = region.y * sy
    const rw = region.w * sx
    const rh = region.h * sy

    return [
      { id: 'nw', x: rx, y: ry, cursor: 'nwse-resize' },
      { id: 'ne', x: rx + rw, y: ry, cursor: 'nesw-resize' },
      { id: 'sw', x: rx, y: ry + rh, cursor: 'nesw-resize' },
      { id: 'se', x: rx + rw, y: ry + rh, cursor: 'nwse-resize' },
      { id: 'n', x: rx + rw/2, y: ry, cursor: 'ns-resize' },
      { id: 's', x: rx + rw/2, y: ry + rh, cursor: 'ns-resize' },
      { id: 'e', x: rx + rw, y: ry + rh/2, cursor: 'ew-resize' },
      { id: 'w', x: rx, y: ry + rh/2, cursor: 'ew-resize' },
    ]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    const { width, height } = img.getBoundingClientRect()
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)

    if (dragging && !resizingHandle && startPx && endPx) {
      drawRect(ctx, startPx, endPx, width, height)
      return
    }

    if (selectedRegion && imageNaturalWidth && imageNaturalHeight) {
      const sx = width  / imageNaturalWidth
      const sy = height / imageNaturalHeight
      const rx = selectedRegion.x * sx
      const ry = selectedRegion.y * sy
      const rw = selectedRegion.w * sx
      const rh = selectedRegion.h * sy

      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, width, ry)
      ctx.fillRect(0, ry + rh, width, height - ry - rh)
      ctx.fillRect(0, ry, rx, rh)
      ctx.fillRect(rx + rw, ry, width - rx - rw, rh)

      ctx.save()
      ctx.strokeStyle = '#f97316'
      ctx.shadowColor = '#f97316'
      ctx.shadowBlur  = 10
      ctx.lineWidth   = 2.5
      ctx.setLineDash([6, 4])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.restore()

      // Draw handles
      const handles = getHandles(selectedRegion, width, height, imageNaturalWidth, imageNaturalHeight)
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 1.5
      for (const h of handles) {
        ctx.fillRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
        ctx.strokeRect(h.x - HANDLE_SIZE/2, h.y - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE)
      }

      ctx.fillStyle = '#f97316'
      ctx.font      = 'bold 11px Inter, sans-serif'
      ctx.fillText('Selected Region', rx + 4, ry > 18 ? ry - 4 : ry + 16)
    }
  }, [dragging, startPx, endPx, selectedRegion, imageNaturalWidth, imageNaturalHeight, resizingHandle])

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
    ctx.strokeRect(x, y, w, h)
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
    
    if (selectedRegion && hoverHandle) {
      setDragging(true)
      setResizingHandle(hoverHandle)
      setResizeStart({ ...selectedRegion })
      setStartPx(pos)
      return
    }

    setDragging(true)
    setResizingHandle(null)
    setStartPx(pos)
    setEndPx(pos)
    onClear()
  }

  function onMouseMove(e) {
    const pos = getCanvasPos(e)

    if (!dragging) {
      if (selectedRegion) {
        const { width, height } = canvasRef.current.getBoundingClientRect()
        const handles = getHandles(selectedRegion, width, height, imageNaturalWidth, imageNaturalHeight)
        const hit = handles.find(h => 
          Math.abs(pos.x - h.x) <= HANDLE_SIZE && Math.abs(pos.y - h.y) <= HANDLE_SIZE
        )
        setHoverHandle(hit ? hit.id : null)
        if (canvasRef.current) {
          canvasRef.current.style.cursor = hit ? hit.cursor : 'crosshair'
        }
      }
      return
    }

    if (resizingHandle && resizeStart) {
      const dx = pos.x - startPx.x
      const dy = pos.y - startPx.y
      
      const canvas = canvasRef.current
      const { width, height } = canvas.getBoundingClientRect()
      const scaleX = imageNaturalWidth / width
      const scaleY = imageNaturalHeight / height
      
      const ndx = Math.round(dx * scaleX)
      const ndy = Math.round(dy * scaleY)

      let { x, y, w, h } = resizeStart
      if (resizingHandle.includes('n')) { y += ndy; h -= ndy }
      if (resizingHandle.includes('s')) { h += ndy }
      if (resizingHandle.includes('w')) { x += ndx; w -= ndx }
      if (resizingHandle.includes('e')) { w += ndx }

      // Keep minimum size 10x10 and prevent negative w/h
      if (w < 10) { w = 10; x = resizingHandle.includes('w') ? resizeStart.x + resizeStart.w - 10 : x }
      if (h < 10) { h = 10; y = resizingHandle.includes('n') ? resizeStart.y + resizeStart.h - 10 : y }

      // Restrict within image bounds
      x = Math.max(0, Math.min(x, imageNaturalWidth - w))
      y = Math.max(0, Math.min(y, imageNaturalHeight - h))

      onRegionSelect({ x, y, w, h })
      return
    }

    setEndPx(pos)
  }

  function onMouseUp(e) {
    if (!dragging) return
    setDragging(false)
    
    if (resizingHandle) {
      setResizingHandle(null)
      return
    }

    const endPos = getCanvasPos(e)
    const canvas = canvasRef.current
    if (!canvas || !imageNaturalWidth) return
    const { width, height } = canvas.getBoundingClientRect()
    const scaleX = imageNaturalWidth  / width
    const scaleY = imageNaturalHeight / height

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
    <div ref={containerRef} style={{
      position: 'relative',
      width: '100%',
    }}>
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
    </div>
  )
}
