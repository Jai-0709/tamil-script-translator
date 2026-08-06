import { useRef, useState, useEffect, useCallback } from 'react'

export default function RegionSelector({
  imageURL,
  imageSrc,
  onConfirmCrop,
  onRegionSelect,
  onCancel,
  selectedRegion: propSelectedRegion,
}) {
  const src = imageURL || imageSrc
  const containerRef = useRef(null)
  const imgRef       = useRef(null)
  const canvasRef    = useRef(null)

  const [regionPct, setRegionPct]           = useState(propSelectedRegion || null)
  const [dragging, setDragging]             = useState(false)
  const [dragStart, setDragStart]           = useState(null)
  const [activeHandle, setActiveHandle]     = useState(null)
  const [resizeStartRegion, setResizeStartRegion] = useState(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img) return

    const rect = img.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return

    canvas.width  = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (!regionPct) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.fillRect(0, 0, rect.width, rect.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '500 13px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Click and drag across the image to crop a region for analysis', rect.width / 2, rect.height / 2)
      return
    }

    const rx = (regionPct.x / 100) * rect.width
    const ry = (regionPct.y / 100) * rect.height
    const rw = (regionPct.w / 100) * rect.width
    const rh = (regionPct.h / 100) * rect.height

    // Darken background outside crop box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.fillRect(0, 0, rect.width, ry)
    ctx.fillRect(0, ry + rh, rect.width, rect.height - ry - rh)
    ctx.fillRect(0, ry, rx, rh)
    ctx.fillRect(rx + rw, ry, rect.width - rx - rw, rh)

    // Highlight border around region
    ctx.strokeStyle = '#c8865a'
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.setLineDash([])

    // Handles
    const handles = [
      { id: 'nw', x: rx, y: ry },
      { id: 'ne', x: rx + rw, y: ry },
      { id: 'sw', x: rx, y: ry + rh },
      { id: 'se', x: rx + rw, y: ry + rh },
      { id: 'n',  x: rx + rw / 2, y: ry },
      { id: 's',  x: rx + rw / 2, y: ry + rh },
      { id: 'w',  x: rx, y: ry + rh / 2 },
      { id: 'e',  x: rx + rw, y: ry + rh / 2 },
    ]

    ctx.fillStyle   = '#ffffff'
    ctx.strokeStyle = '#c8865a'
    ctx.lineWidth   = 1.5
    const hw = 8
    handles.forEach((h) => {
      ctx.fillRect(h.x - hw / 2, h.y - hw / 2, hw, hw)
      ctx.strokeRect(h.x - hw / 2, h.y - hw / 2, hw, hw)
    })

    // Label tag
    ctx.fillStyle = '#c8865a'
    ctx.font = '600 11px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Selected Crop Area', rx + 6, ry > 22 ? ry - 6 : ry + 16)
  }, [regionPct])

  useEffect(() => { draw() }, [draw])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [draw])

  function getHitHandle(px, py) {
    if (!regionPct || !canvasRef.current) return null
    const rect = canvasRef.current.getBoundingClientRect()
    const rx = (regionPct.x / 100) * rect.width
    const ry = (regionPct.y / 100) * rect.height
    const rw = (regionPct.w / 100) * rect.width
    const rh = (regionPct.h / 100) * rect.height

    const handles = [
      { id: 'nw', x: rx, y: ry, cursor: 'nwse-resize' },
      { id: 'ne', x: rx + rw, y: ry, cursor: 'nesw-resize' },
      { id: 'sw', x: rx, y: ry + rh, cursor: 'nesw-resize' },
      { id: 'se', x: rx + rw, y: ry + rh, cursor: 'nwse-resize' },
      { id: 'n',  x: rx + rw / 2, y: ry, cursor: 'ns-resize' },
      { id: 's',  x: rx + rw / 2, y: ry + rh, cursor: 'ns-resize' },
      { id: 'w',  x: rx, y: ry + rh / 2, cursor: 'ew-resize' },
      { id: 'e',  x: rx + rw, y: ry + rh / 2, cursor: 'ew-resize' },
    ]

    const tol = 12
    return handles.find((h) => Math.abs(px - h.x) <= tol && Math.abs(py - h.y) <= tol) || null
  }

  function handlePointerDown(e) {
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    const hit = getHitHandle(px, py)
    if (hit) {
      setActiveHandle(hit.id)
      setResizeStartRegion({ ...regionPct })
      setDragStart({ x: px, y: py })
      setDragging(true)
      return
    }

    setDragging(true)
    setActiveHandle(null)
    setDragStart({ x: px, y: py })
    const startXpct = Math.max(0, Math.min(100, (px / rect.width) * 100))
    const startYpct = Math.max(0, Math.min(100, (py / rect.height) * 100))
    setRegionPct({ x: startXpct, y: startYpct, w: 0, h: 0 })
  }

  function handlePointerMove(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top

    if (!dragging) {
      const hit = getHitHandle(px, py)
      canvas.style.cursor = hit ? hit.cursor : 'crosshair'
      return
    }

    if (activeHandle && resizeStartRegion && dragStart) {
      const dxPct = ((px - dragStart.x) / rect.width) * 100
      const dyPct = ((py - dragStart.y) / rect.height) * 100

      let { x, y, w, h } = resizeStartRegion
      if (activeHandle.includes('n')) { y += dyPct; h -= dyPct }
      if (activeHandle.includes('s')) { h += dyPct }
      if (activeHandle.includes('w')) { x += dxPct; w -= dxPct }
      if (activeHandle.includes('e')) { w += dxPct }

      if (w > 2 && h > 2) {
        x = Math.max(0, Math.min(100 - w, x))
        y = Math.max(0, Math.min(100 - h, y))
        setRegionPct({ x, y, w, h })
      }
      return
    }

    if (dragStart) {
      const x1 = Math.min(dragStart.x, px)
      const y1 = Math.min(dragStart.y, py)
      const wPx = Math.abs(px - dragStart.x)
      const hPx = Math.abs(py - dragStart.y)

      const x = Math.max(0, Math.min(100, (x1 / rect.width) * 100))
      const y = Math.max(0, Math.min(100, (y1 / rect.height) * 100))
      const w = Math.min(100 - x, (wPx / rect.width) * 100)
      const h = Math.min(100 - y, (hPx / rect.height) * 100)

      setRegionPct({ x, y, w, h })
    }
  }

  function handlePointerUp() {
    setDragging(false)
    setActiveHandle(null)
    setDragStart(null)
  }

  function handleConfirm() {
    if (!regionPct || regionPct.w < 2 || regionPct.h < 2) return
    const callback = onConfirmCrop || onRegionSelect
    if (callback) {
      callback(regionPct)
    }
  }

  function handleReset() {
    setRegionPct(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Top action bar for region selection */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--line)',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="label" style={{ color: 'var(--copper)' }}>Region Crop Mode</span>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            Drag on image to select target region
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: window.innerWidth <= 480 ? '100%' : 'auto', justifyContent: 'flex-end' }}>
          {regionPct && (
            <button className="btn-ghost" onClick={handleReset} style={{ fontSize: 12 }}>
              Reset crop
            </button>
          )}
          <button className="btn-secondary" onClick={onCancel} style={{ padding: '6px 14px', fontSize: 12 }}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!regionPct || regionPct.w < 2 || regionPct.h < 2}
            onClick={handleConfirm}
            style={{ padding: '6px 18px', fontSize: 12 }}
          >
            Analyse Crop Region
          </button>
        </div>
      </div>

      {/* Interactive Canvas container */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: 16,
          background: 'var(--base)',
        }}
      >
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '72vh' }}>
          <img
            ref={imgRef}
            src={src}
            alt="Region selection"
            onLoad={draw}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '72vh',
              width: 'auto',
              height: 'auto',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: 'var(--r-sm)',
              touchAction: 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
