import { useRef, useState } from 'react'

export default function UploadZone({ onFileSelect, onTranslate, imageFile, imageURL, isLoading }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function fmt(bytes) {
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function handle(file) {
    if (file && file.type.startsWith('image/')) onFileSelect(file)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 12, width: '100%' }}>
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
          gap: 12,
          padding: '9px 14px',
          borderRadius: 'var(--r-sm)',
          border: `1px dashed ${dragging ? 'var(--copper)' : 'var(--line-strong)'}`,
          background: dragging ? 'var(--copper-dim)' : 'var(--surface-2)',
          cursor: 'pointer',
          transition: 'border-color var(--dur-fast), background var(--dur-fast)',
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
              width: 34, height: 34,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid var(--line)',
              flexShrink: 0,
            }}
          />
        ) : (
          <div style={{
            width: 34, height: 34, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Upload arrow icon — custom monoline */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--fg-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
        )}

        {/* File info */}
        <div style={{ minWidth: 0, flex: 1 }}>
          {imageFile ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {imageFile.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>
                {fmt(imageFile.size)} · click to replace
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-2)' }}>
                Drop inscription image
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>
                JPEG or PNG · click to browse
              </div>
            </>
          )}
        </div>
      </div>

      {/* Translate button — the ONE primary action */}
      <button
        className="btn-primary"
        onClick={onTranslate}
        disabled={!imageFile || isLoading}
        style={{ whiteSpace: 'nowrap', padding: '0 20px', height: 'auto', alignSelf: 'stretch' }}
      >
        {isLoading ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Analysing…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Analyse
          </>
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
