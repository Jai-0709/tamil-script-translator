import { useState, useEffect, useCallback, useMemo } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

// ─── Quality helpers ──────────────────────────────────────────────────────────
function getQuality(count) {
  if (count >= 50) return { label: 'Excellent', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  tier: 3, pct: 100 }
  if (count >= 30) return { label: 'Good',      color: '#86efac', bg: 'rgba(134,239,172,0.1)', tier: 2, pct: Math.round(count/50*100) }
  if (count >= 10) return { label: 'Fair',      color: '#f97316', bg: 'rgba(249,115,22,0.12)', tier: 1, pct: Math.round(count/50*100) }
  return              { label: 'Low',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  tier: 0, pct: Math.round(count/50*100) }
}

function healthScore(classes) {
  if (!classes.length) return 0
  const avg = classes.reduce((s,c) => s + Math.min(c.count, 50), 0) / classes.length
  return Math.round(avg / 50 * 100)
}

// ─── Micro components ─────────────────────────────────────────────────────────
function Skeleton({ w='100%', h=14, r=6, style={} }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:'rgba(255,255,255,0.06)', animation:'skP 1.4s ease infinite', flexShrink:0, ...style }} />
}

function SkCard() {
  return (
    <div style={{ background:'rgba(255,255,255,0.025)', border:'1px solid var(--border)', borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:12 }}>
        <Skeleton w={44} h={44} r={8} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <Skeleton w="60%" h={13} />
          <Skeleton w="40%" h={10} />
        </div>
      </div>
      <Skeleton h={4} r={4} />
      <div style={{ display:'flex', gap:6 }}>
        {[0,1,2,3].map(i=><Skeleton key={i} w={50} h={42} r={6}/>)}
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ClassDetailModal({ cls, onClose, onDelete }) {
  const q = getQuality(cls.count)
  const [images,    setImages]    = useState([])
  const [loadingImg, setLoadingImg] = useState(true)
  const [deleting,  setDeleting]  = useState(null)
  const [imgError,  setImgError]  = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoadingImg(true)
    setImgError(null)
    const encodedName = encodeURIComponent(cls.class_name)
    fetch(`${BACKEND_URL}/api/dataset/class-images/${encodedName}`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(data => { if (!cancelled) { setImages(data.images || []); setLoadingImg(false) } })
      .catch(e  => { if (!cancelled) { setImgError(String(e)); setLoadingImg(false) } })
    return () => { cancelled = true }
  }, [cls.class_name])

  async function handleDel(img) {
    setDeleting(img.index)
    await onDelete(cls.class_name, img.index)
    setImages(prev => prev.filter(i => i.index !== img.index))
    setDeleting(null)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
        backdropFilter:'blur(8px)', zIndex:999,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:'var(--surface-1)', border:'1px solid var(--line)',
          borderRadius:14, width:'min(820px, 95vw)', maxHeight:'90vh',
          display:'flex', flexDirection:'column',
          boxShadow:'0 24px 60px rgba(0,0,0,0.8)',
          animation:'modalIn 0.2s ease',
          overflow:'hidden',
        }}
      >
        {/* Modal Header */}
        <div style={{ flexShrink:0, padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:54, height:54, borderRadius:10, background:'rgba(249,115,22,0.12)', border:'1px solid rgba(249,115,22,0.25)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden', padding:4 }}>
            <span style={{
              fontFamily:'"Noto Serif Tamil","Noto Sans Tamil",serif',
              color:'#f97316',
              fontSize: cls.class_name.length > 6 ? 10 : cls.class_name.length > 3 ? 13 : cls.class_name.length > 1 ? 18 : 26,
              lineHeight: 1.2,
              textAlign: 'center',
              wordBreak: 'break-all',
              display: 'block',
              maxWidth: '100%',
            }}>{cls.class_name}</span>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', fontFamily:'"Noto Serif Tamil",serif' }}>{cls.class_name}</div>
            <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
              Training Class · <span style={{ color:'#f97316', fontWeight:700 }}>{images.length || cls.count}</span> images
            </div>
          </div>
          <div style={{ padding:'3px 10px', borderRadius:12, background:q.bg, color:q.color, fontSize:11, fontWeight:700 }}>{q.label}</div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:8, width:30, height:30, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
        </div>

        {/* Stats strip */}
        <div style={{ flexShrink:0, display:'flex', borderBottom:'1px solid var(--border)', background:'rgba(0,0,0,0.2)' }}>
          {[
            { label:'Total Images', val: images.length || cls.count, color:'#f97316' },
            { label:'Target',       val:'50+',     color:'#22c55e' },
            { label:'Progress',     val:`${q.pct}%`, color:q.color },
            { label:'Quality',      val:q.label,   color:q.color },
          ].map((s, i) => (
            <div key={s.label} style={{ flex:1, padding:'12px 18px', borderRight: i<3 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ flex:2, padding:'12px 18px', display:'flex', flexDirection:'column', justifyContent:'center', gap:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-secondary)' }}>
              <span>Training readiness</span><span style={{ color:q.color, fontWeight:700 }}>{q.pct}%</span>
            </div>
            <div style={{ height:5, borderRadius:5, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
              <div style={{ width:`${q.pct}%`, height:'100%', borderRadius:5, background:q.color, transition:'width 0.5s' }} />
            </div>
          </div>
        </div>

        {/* Gallery */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
              All Training Images
            </div>
            {!loadingImg && (
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{images.length} images</span>
            )}
          </div>

          {loadingImg && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:8 }}>
              {Array.from({length:Math.min(cls.count, 24)}).map((_,i) => (
                <div key={i} style={{ height:80, borderRadius:8, background:'rgba(255,255,255,0.06)', animation:'skP 1.4s ease infinite', animationDelay:`${i*0.04}s` }} />
              ))}
            </div>
          )}

          {imgError && (
            <div style={{ padding:'14px 16px', borderRadius:8, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:12 }}>
              Failed to load images: {imgError}
            </div>
          )}

          {!loadingImg && !imgError && images.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(90px,1fr))', gap:8 }}>
              {images.map((img) => (
                <div
                  key={img.index}
                  title={img.filename}
                  style={{
                    position:'relative', borderRadius:8,
                    border:'1px solid var(--border)',
                    overflow:'hidden',
                    opacity: deleting === img.index ? 0.3 : 1,
                    transition:'opacity 0.2s',
                  }}
                >
                  <img
                    src={`data:image/jpeg;base64,${img.b64}`}
                    alt={img.filename}
                    style={{ width:'100%', height:80, objectFit:'contain', background:'#f8f4ef', display:'block' }}
                  />
                  <button
                    onClick={() => handleDel(img)}
                    disabled={deleting === img.index}
                    title={`Delete ${img.filename}`}
                    style={{
                      position:'absolute', top:4, right:4,
                      width:20, height:20, borderRadius:4,
                      background:'rgba(239,68,68,0.9)', border:'none',
                      color:'#fff', fontSize:11, fontWeight:700,
                      cursor:'pointer', padding:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity:0, transition:'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity='1'}
                    onMouseLeave={e => e.currentTarget.style.opacity='0'}
                  >✕</button>
                  <div
                    style={{ position:'absolute', inset:0, cursor:'default' }}
                    onMouseEnter={e => { const btn = e.currentTarget.previousSibling; if(btn) btn.style.opacity='1' }}
                    onMouseLeave={e => { const btn = e.currentTarget.previousSibling; if(btn) btn.style.opacity='0' }}
                  />
                </div>
              ))}
            </div>
          )}

          {!loadingImg && !imgError && images.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)', fontSize:13 }}>
              No images found in this class folder.
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div style={{ flexShrink:0, padding:'12px 24px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-secondary)', background:'rgba(0,0,0,0.15)' }}>
          To retrain model with updated dataset, run <code style={{ color:'#f97316', fontSize:10, background:'rgba(249,115,22,0.1)', padding:'2px 6px', borderRadius:4 }}>python scripts/training/retrain_robust.py</code> in terminal.
        </div>
      </div>
    </div>
  )
}

// ─── Class Card ───────────────────────────────────────────────────────────────
function ClassCard({ cls, onDelete, onClick, view }) {
  const [hov, setHov] = useState(false)
  const q = getQuality(cls.count)

  if (view === 'list') {
    return (
      <div
        onClick={onClick}
        onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{
          background: hov ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${hov ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
          borderRadius:8, padding:'10px 16px',
          display:'flex', alignItems:'center', gap:16,
          cursor:'pointer', transition:'all 0.15s',
        }}
      >
        <div style={{ width:38, height:38, borderRadius:7, flexShrink:0, background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:3 }}>
          <span style={{
            fontFamily:'"Noto Serif Tamil","Noto Sans Tamil",serif',
            color:'#f97316',
            fontSize: cls.class_name.length > 6 ? 8 : cls.class_name.length > 3 ? 10 : cls.class_name.length > 1 ? 14 : 18,
            lineHeight:1.2, textAlign:'center', wordBreak:'break-all',
          }}>{cls.class_name}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'"Noto Serif Tamil",serif' }}>{cls.class_name}</div>
        </div>
        <div style={{ width:120, display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
            <div style={{ width:`${q.pct}%`, height:'100%', borderRadius:4, background:q.color }} />
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{cls.count} / 50 images</div>
        </div>
        <div style={{ padding:'2px 8px', borderRadius:10, background:q.bg, color:q.color, fontSize:10, fontWeight:700, flexShrink:0 }}>{q.label}</div>
        <div style={{ display:'flex', gap:4 }}>
          {cls.previews.length > 0 ? cls.previews.map((b64, idx) => (
            <img key={idx} src={`data:image/jpeg;base64,${b64}`} alt="" style={{ width:32, height:28, objectFit:'contain', borderRadius:4, background:'#f8f4ef', border:'1px solid var(--border)' }} />
          )) : null}
        </div>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>→</span>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background: hov ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${hov ? 'rgba(249,115,22,0.35)' : 'var(--border)'}`,
        borderRadius:10, padding:'14px 16px',
        display:'flex', flexDirection:'column', gap:12,
        cursor:'pointer', transition:'all 0.15s ease',
        position:'relative',
      }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:8, flexShrink:0, background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.2)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:4 }}>
          <span style={{
            fontFamily:'"Noto Serif Tamil","Noto Sans Tamil",serif',
            color:'#f97316',
            fontSize: cls.class_name.length > 6 ? 9 : cls.class_name.length > 3 ? 12 : cls.class_name.length > 1 ? 16 : 22,
            lineHeight:1.2, textAlign:'center', wordBreak:'break-all',
            display:'block', maxWidth:'100%',
          }}>{cls.class_name}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', fontFamily:'"Noto Serif Tamil",serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cls.class_name}</div>
          <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{cls.count.toLocaleString()} images</div>
        </div>
        <div style={{ padding:'2px 8px', borderRadius:10, background:q.bg, color:q.color, fontSize:10, fontWeight:700, flexShrink:0 }}>{q.label}</div>
      </div>

      {/* Progress */}
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--text-muted)', marginBottom:4 }}>
          <span>Readiness</span><span style={{ color:q.color, fontWeight:700 }}>{q.pct}%</span>
        </div>
        <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
          <div style={{ width:`${q.pct}%`, height:'100%', borderRadius:4, background:q.color, transition:'width 0.5s' }} />
        </div>
      </div>

      {/* Thumbnails */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {cls.previews.length > 0 ? cls.previews.map((b64, idx) => (
          <img key={idx} src={`data:image/jpeg;base64,${b64}`} alt="" style={{ width:48, height:40, objectFit:'contain', borderRadius:6, background:'#f8f4ef', border:'1px solid var(--border)', display:'block' }} />
        )) : (
          <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic' }}>No previews</div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:6, borderTop:'1px solid var(--border)' }}>
        <div style={{ fontSize:10, color:'var(--text-muted)' }}>
          {cls.count < 10 ? `Add ${10-cls.count} more` : cls.count < 50 ? `${50-cls.count} to excellent` : 'Fully trained'}
        </div>
        <span style={{ fontSize:11, color:'var(--text-secondary)', fontWeight:600 }}>View →</span>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ classes, onFilter, activeFilter }) {
  const tiers = [
    { key:'all',   label:'All Classes',     count: classes.length, color: '#f97316' },
    { key:'low',   label:'Needs Attention', count: classes.filter(c=>c.count<10).length, color: '#ef4444' },
    { key:'fair',  label:'Fair',            count: classes.filter(c=>c.count>=10&&c.count<30).length, color: '#f97316' },
    { key:'good',  label:'Good',            count: classes.filter(c=>c.count>=30&&c.count<50).length, color: '#86efac' },
    { key:'excel', label:'Excellent',       count: classes.filter(c=>c.count>=50).length, color: '#22c55e' },
  ]

  const score = healthScore(classes)

  return (
    <div style={{
      width:220, flexShrink:0,
      background:'rgba(255,255,255,0.015)',
      borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column',
      padding:'18px 12px',
      gap:4,
      overflowY:'auto',
    }}>
      <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6, paddingLeft:6 }}>Quality Filter</div>

      {tiers.map(t => (
        <button key={t.key} onClick={()=>onFilter(t.key)} style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'7px 10px', borderRadius:7, border:'none',
          background: activeFilter===t.key ? 'rgba(249,115,22,0.12)' : 'transparent',
          outline: activeFilter===t.key ? '1px solid rgba(249,115,22,0.25)' : 'none',
          color: activeFilter===t.key ? '#f97316' : 'var(--text-secondary)',
          cursor:'pointer', textAlign:'left', transition:'all 0.12s', width:'100%',
        }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:t.color, display:'inline-block' }} />
          <span style={{ flex:1, fontSize:12, fontWeight:600 }}>{t.label}</span>
          <span style={{ fontSize:11, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'rgba(255,255,255,0.05)', color:'var(--text-secondary)' }}>{t.count}</span>
        </button>
      ))}

      {/* Dataset Health Score */}
      <div style={{ marginTop:'auto', paddingTop:16, borderTop:'1px solid var(--border)' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10, paddingLeft:6 }}>Dataset Health</div>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'8px 0' }}>
          <svg width={80} height={80} viewBox="0 0 90 90">
            <circle cx={45} cy={45} r={36} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}/>
            <circle cx={45} cy={45} r={36} fill="none"
              stroke={score >= 75 ? '#22c55e' : score >= 50 ? '#f97316' : '#ef4444'}
              strokeWidth={7} strokeLinecap="round"
              strokeDasharray={`${Math.PI*72*score/100} ${Math.PI*72*(1-score/100)}`}
              transform="rotate(-90 45 45)"
              style={{ transition:'stroke-dasharray 0.8s ease' }}
            />
            <text x={45} y={49} textAnchor="middle" fill="var(--text-primary)" fontSize={17} fontWeight={800} fontFamily="Inter,sans-serif">{score}%</text>
          </svg>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:11, fontWeight:700, color: score>=75?'#22c55e':score>=50?'#f97316':'#ef4444' }}>
              {score >= 75 ? 'Ready to Train' : score >= 50 ? 'Improving' : 'More Data Needed'}
            </div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>Overall training score</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DatasetStudio({ onBack }) {
  const [classes,      setClasses]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [search,       setSearch]       = useState('')
  const [sortBy,       setSortBy]       = useState('name')
  const [filterTier,   setFilterTier]   = useState('all')
  const [view,         setView]         = useState('grid')
  const [selected,     setSelected]     = useState(null)
  const [toast,        setToast]        = useState(null)
  const [lastSync,     setLastSync]     = useState(null)

  function showToast(msg, ok=true) { setToast({msg,ok}); setTimeout(()=>setToast(null), 3500) }

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/dataset/stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setClasses(data.classes || [])
      setLastSync(new Date())
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ fetchStats() }, [fetchStats])

  async function handleDelete(className, idx) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/dataset/crop-by-index`, {
        method:'DELETE', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({class_name:className, index:idx}),
      })
      if (res.ok) { showToast(`Removed crop from "${className}"`); fetchStats() }
      else showToast('Failed to delete', false)
    } catch { showToast('Connection error', false) }
  }

  const totalImgs    = classes.reduce((s,c)=>s+c.count, 0)
  const totalCls     = classes.length
  const lowCls       = classes.filter(c=>c.count<10).length
  const excellentCls = classes.filter(c=>c.count>=50).length
  const avgPerCls    = totalCls ? Math.round(totalImgs/totalCls) : 0
  const score        = healthScore(classes)

  const filtered = useMemo(() => {
    let list = [...classes]
    if (search) { const q=search.toLowerCase(); list=list.filter(c=>c.class_name.toLowerCase().includes(q)||c.class_name.includes(search)) }
    if (filterTier==='low')   list=list.filter(c=>c.count<10)
    if (filterTier==='fair')  list=list.filter(c=>c.count>=10&&c.count<30)
    if (filterTier==='good')  list=list.filter(c=>c.count>=30&&c.count<50)
    if (filterTier==='excel') list=list.filter(c=>c.count>=50)

    if (sortBy==='count_desc') list.sort((a,b)=>b.count-a.count)
    else if (sortBy==='count_asc') list.sort((a,b)=>a.count-b.count)
    else if (sortBy==='quality') list.sort((a,b)=>a.count-b.count)
    else list.sort((a,b)=>a.class_name.localeCompare(b.class_name))
    return list
  }, [classes, search, sortBy, filterTier])

  const GRID_STYLE = view==='grid'
    ? { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }
    : { display:'flex', flexDirection:'column', gap:8 }

  return (
    <div style={{ height:'100vh', width:'100vw', overflow:'hidden', background:'var(--base)', fontFamily:"'Inter',system-ui,sans-serif", color:'var(--fg)', display:'flex', flexDirection:'column' }}>

      {/* HEADER */}
      <div style={{ flexShrink:0, height:54, background:'var(--surface-1)', borderBottom:'1px solid var(--line)', padding:'0 24px', display:'flex', alignItems:'center', gap:14 }}>

        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--surface-2)', border:'1px solid var(--line)', color:'var(--fg-2)', borderRadius:7, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600, flexShrink:0 }}
          onMouseEnter={e=>{e.currentTarget.style.color='var(--fg)'; e.currentTarget.style.background='var(--surface-3)'}}
          onMouseLeave={e=>{e.currentTarget.style.color='var(--fg-2)'; e.currentTarget.style.background='var(--surface-2)'}}>
          ← Back to Workspace
        </button>

        <div style={{ width:1, height:20, background:'var(--line)' }} />

        <div>
          <div style={{ fontSize:14, fontWeight:700, color:'var(--fg)' }}>Dataset Studio</div>
          <div style={{ fontSize:10, color:'var(--fg-3)' }}>{lastSync ? `Synced ${lastSync.toLocaleTimeString()}` : 'Tamil Training Data Manager'}</div>
        </div>

        <div style={{ flex:1 }} />

        {/* Health indicator */}
        {!loading && !error && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 12px', background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:7 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background: score>=75?'#3da35d':score>=50?'var(--copper)':'#c87474' }} />
            <span style={{ fontSize:11, color:'var(--fg-2)' }}>Health <span style={{ fontWeight:700, color:score>=75?'#3da35d':score>=50?'var(--copper)':'#c87474' }}>{score}%</span></span>
            <span style={{ fontSize:10, color:'var(--fg-4)' }}>·</span>
            <span style={{ fontSize:11, color:'var(--fg-2)' }}><b style={{ color:'var(--copper)' }}>{totalCls}</b> classes · <b style={{ color:'#3da35d' }}>{totalImgs.toLocaleString()}</b> images</span>
          </div>
        )}

        <button onClick={fetchStats} disabled={loading} className="btn-primary" style={{ padding:'5px 14px', fontSize:12 }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* STATS BAR */}
      {!loading && !error && (
        <div style={{ flexShrink:0, padding:'8px 24px', borderBottom:'1px solid var(--line)', display:'flex', gap:10, background:'var(--surface-1)' }}>
          {[
            { label:'Total Classes',   val:totalCls,                   sub:null,                    c:'var(--copper)' },
            { label:'Total Images',    val:totalImgs.toLocaleString(), sub:`avg ${avgPerCls}/class`,c:'#3da35d' },
            { label:'Excellent',        val:excellentCls,               sub:'≥ 50 images',           c:'#3da35d' },
            { label:'Needs Attention', val:lowCls,                     sub:'< 10 images',           c:'#c87474' },
            { label:'Health Score',     val:`${score}%`,                sub:score>=75?'Ready to train':score>=50?'Improving':'More data needed', c:score>=75?'#3da35d':score>=50?'var(--copper)':'#c87474' },
            { label:'Showing',          val:filtered.length,            sub:`of ${totalCls} classes`,c:'var(--fg-2)' },
          ].map(s => (
            <div key={s.label} style={{ flex:'1 1 0', background:'var(--surface-2)', border:'1px solid var(--line)', borderRadius:8, padding:'8px 14px', display:'flex', alignItems:'center', gap:10 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:s.c, lineHeight:1 }}>{s.val}</div>
                <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:3 }}>{s.label}</div>
                {s.sub && <div style={{ fontSize:10, color:s.c, marginTop:2, fontWeight:600 }}>{s.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BODY */}
      <div style={{ flex:1, minHeight:0, display:'flex', overflow:'hidden' }}>
        {!loading && !error && <Sidebar classes={classes} onFilter={setFilterTier} activeFilter={filterTier} />}

        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Toolbar */}
          <div style={{ flexShrink:0, padding:'8px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.01)' }}>
            <div style={{ position:'relative', flex:'0 0 220px' }}>
              <input type="text" placeholder="Search character class…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', color:'var(--text-primary)', fontSize:12, outline:'none' }}
              />
            </div>

            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Sort:</span>
            {[['name','A–Z'],['count_desc','Most ↓'],['count_asc','Least ↑'],['quality','Needs Attention']].map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)} style={{ padding:'4px 9px', borderRadius:6, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', background:sortBy===k?'rgba(249,115,22,0.14)':'rgba(255,255,255,0.04)', color:sortBy===k?'#f97316':'var(--text-secondary)', outline:sortBy===k?'1px solid rgba(249,115,22,0.25)':'none', transition:'all 0.12s' }}>{l}</button>
            ))}

            <div style={{ flex:1 }} />

            {/* View toggle */}
            <div style={{ display:'flex', background:'rgba(255,255,255,0.04)', borderRadius:6, padding:2, border:'1px solid var(--border)', gap:2 }}>
              {[['grid','Grid'],['list','List']].map(([v,label])=>(
                <button key={v} onClick={()=>setView(v)} style={{ padding:'3px 10px', borderRadius:4, border:'none', cursor:'pointer', background:view===v?'#f97316':'transparent', color:view===v?'#fff':'var(--text-secondary)', fontSize:11, fontWeight:600, transition:'all 0.12s' }}>{label}</button>
              ))}
            </div>

            <div style={{ fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{filtered.length} of {totalCls} shown</div>
          </div>

          {/* Grid/List */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 32px' }}>
            {error && (
              <div style={{ padding:'16px 20px', borderRadius:10, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>
                <div style={{ fontWeight:700, marginBottom:4 }}>Error: Failed to load dataset</div>
                <div style={{ fontSize:12 }}>{error}</div>
              </div>
            )}

            {loading && (
              <div style={GRID_STYLE}>
                {Array.from({length:18}).map((_,i)=><SkCard key={i}/>)}
              </div>
            )}

            {!loading && !error && filtered.length===0 && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>
                  {search?`No classes match "${search}"`:filterTier!=='all'?`No classes in this tier`:'No training data found'}
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  {search?'Try a different character or clear the filter.':'Use "Send to Dataset" in the Translator to populate this view.'}
                </div>
              </div>
            )}

            {!loading && !error && filtered.length>0 && (
              <div style={GRID_STYLE}>
                {filtered.map(cls => (
                  <ClassCard key={cls.class_name} cls={cls} view={view}
                    onDelete={handleDelete}
                    onClick={()=>setSelected(cls)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selected && (
        <ClassDetailModal cls={selected} onClose={()=>setSelected(null)} onDelete={async(cn,i)=>{await handleDelete(cn,i); setSelected(null)}} />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#12141f', border:`1px solid ${toast.ok?'rgba(34,197,94,0.4)':'rgba(239,68,68,0.4)'}`, color:toast.ok?'#4ade80':'#f87171', fontWeight:700, fontSize:13, padding:'10px 22px', borderRadius:8, boxShadow:'0 8px 30px rgba(0,0,0,0.6)', zIndex:9999, pointerEvents:'none', animation:'dsT 0.2s ease', whiteSpace:'nowrap' }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes skP { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes dsT { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes modalIn{ from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}
