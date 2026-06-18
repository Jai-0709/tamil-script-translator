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
}) {
  const wrapRef   = useRef(null)  // constraining wrapper
  const imgRef    = useRef(null)
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || img.naturalWidth === 0) return

    // Match canvas pixel size to the rendered image size
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
      const color   = wordColor(word.id)
      const hovered = word.id === hoveredWordId

      // Semi-transparent fill
      ctx.globalAlpha = hovered ? 0.32 : 0.12
      ctx.fillStyle   = color
      ctx.fillRect(x, y, w, h)

      // Border
      ctx.globalAlpha = 1
      ctx.strokeStyle  = color
      ctx.lineWidth    = hovered ? 2.5 : 1.5
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

      // ID Badge & Tamil Character Label (positioned above the box to avoid hiding the character)
      const badgeText = `${word.id}: ${word.modern_tamil || '?'}`
      ctx.font = 'bold 11px Inter, "Noto Sans Tamil", sans-serif'
      const tw = ctx.measureText(badgeText).width
      const bw = tw + 8
      const bh = 16
      
      // Position badge above the bounding box. If close to the top, overlay at the top edge inside.
      const badgeY = (y - bh >= 0) ? (y - bh) : y
      
      ctx.globalAlpha = hovered ? 0.95 : 0.8
      ctx.fillStyle = hovered ? '#f97316' : color
      ctx.beginPath()
      ctx.roundRect(x, badgeY, bw, bh, 3)
      ctx.fill()
      
      ctx.globalAlpha = 1
      ctx.fillStyle = '#000000'
      ctx.fillText(badgeText, x + 4, badgeY + 12)
    }
  }, [words, imageWidth, imageHeight, hoveredWordId])

  useEffect(() => { draw() }, [draw])

  // Redraw when container resizes
  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (wrapRef.current) obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [draw])

  function handleMouseMove(e) {
    const canvas = canvasRef.current
    if (!canvas || !words.length || !imageWidth || !imageHeight) return
    const rect   = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const sx = canvas.width  / imageWidth
    const sy = canvas.height / imageHeight

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
    /* Outer wrapper fills the parent cell exactly */
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Inner container sizes to the image */}
      <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
        <img
          ref={imgRef}
          src={imageURL}
          alt="Tamil inscription"
          onLoad={draw}
          style={{
            display: 'block',
            /* Key fix: constrain image to container, never overflow */
            maxWidth:  '100%',
            maxHeight: '100%',
            width:     'auto',
            height:    'auto',
            objectFit: 'contain',
            borderRadius: 10,
            border: '1px solid var(--border)',
          }}
        />
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onWordHover(null)}
          style={{
            position:     'absolute',
            top: 0, left: 0,
            width:  '100%',
            height: '100%',
            cursor:       words.length ? 'crosshair' : 'default',
            borderRadius: 10,
          }}
        />
      </div>
    </div>
  )
}
