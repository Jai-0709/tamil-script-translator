import { useRef, useState } from 'react'

export default function UploadZone({ onFileSelect, onTranslate, imageFile, imageURL, isLoading }) {
  const inputRef          = useRef(null)
  const [dragging, setDragging] = useState(false)

  function fmt(bytes) {
    if (bytes < 1024)         return `${bytes} B`
    if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handle(file) {
    if (file && file.type.startsWith('image/')) onFileSelect(file)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files?.[0]) }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 14px',
          borderRadius: 8,
          border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border-light)'}`,
          background: dragging ? 'var(--accent-muted)' : 'var(--bg-card-2)',
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          minWidth: 0,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files?.[0])}
        />

        {/* Thumbnail or icon */}
        {imageURL ? (
          <img
            src={imageURL}
            alt="preview"
            style={{
              width: 36, height: 36,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: 6, flexShrink: 0,
            background: 'var(--bg-card-3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
          </div>
        )}

        {/* File info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {imageFile ? (
            <>
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {imageFile.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                {fmt(imageFile.size)} · Click to change
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                Drop inscription image here
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                JPEG / PNG · click to browse
              </div>
            </>
          )}
        </div>

        {/* Upload icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>

      {/* Translate button */}
      <button
        onClick={onTranslate}
        disabled={!imageFile || isLoading}
        style={{
          flexShrink: 0,
          height: 40,
          padding: '0 20px',
          borderRadius: 8,
          border: 'none',
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          cursor: (!imageFile || isLoading) ? 'not-allowed' : 'pointer',
          background: (!imageFile || isLoading)
            ? 'var(--bg-card-3)'
            : 'linear-gradient(135deg, #f97316 0%, #ea6a0a 100%)',
          color: (!imageFile || isLoading) ? 'var(--text-muted)' : '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          transition: 'opacity 0.15s, transform 0.1s',
          boxShadow: (!imageFile || isLoading) ? 'none' : '0 2px 12px rgba(249,115,22,0.3)',
        }}
        onMouseEnter={(e) => { if (imageFile && !isLoading) e.currentTarget.style.opacity = '0.88' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {isLoading ? (
          <>
            <svg className="spinner" width="13" height="13" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                       M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            Analysing…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Translate
          </>
        )}
      </button>
    </div>
  )
}
