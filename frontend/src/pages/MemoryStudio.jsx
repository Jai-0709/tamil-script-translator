import { useState, useEffect } from 'react'
import axios from 'axios'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function MemoryStudio() {
  const [activeTab, setActiveTab] = useState('vector') // 'vector' | 'layout'
  const [memoryData, setMemoryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const fetchMemorySummary = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/memory-summary`)
      setMemoryData(data)
    } catch (err) {
      console.error("Failed to load memory summary:", err)
      showToast("Error loading memory data", false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMemorySummary()
  }, [])

  const handleDeleteVectorItem = async (index) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/delete-vector-memory/${index}`)
      showToast(`Deleted vector memory item #${index + 1}`)
      fetchMemorySummary()
    } catch (err) {
      console.error("Error deleting vector memory item:", err)
      showToast("Failed to delete memory item", false)
    }
  }

  const handleDeleteLayout = async (filename) => {
    try {
      await axios.post(`${BACKEND_URL}/api/delete-layout-memory`, { filename })
      showToast(`Cleared saved layout for ${filename}`)
      fetchMemorySummary()
    } catch (err) {
      console.error("Error deleting layout memory:", err)
      showToast("Failed to clear layout memory", false)
    }
  }

  const handleClearAllVectorMemory = async () => {
    if (!window.confirm("Are you sure you want to reset all saved character vector memory?")) return
    try {
      await axios.post(`${BACKEND_URL}/api/clear-vector-memory`)
      showToast("Cleared all character vector memories!")
      fetchMemorySummary()
    } catch (err) {
      showToast("Failed to clear vector memory", false)
    }
  }

  const exportMemoryJSON = () => {
    if (!memoryData) return
    const blob = new Blob([JSON.stringify(memoryData, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `tamil_translator_memory_backup_${Date.now()}.json`
    a.click()
  }

  // Filtered vector entries
  const filteredVector = (memoryData?.vector_memories || []).filter(item => 
    !searchTerm || item.modern_tamil.includes(searchTerm)
  )

  // Filtered layout keys
  const layoutEntries = Object.entries(memoryData?.layout_memories || {})
  const filteredLayouts = layoutEntries.filter(([fn]) =>
    !searchTerm || fn.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
      overflowY: 'auto', padding: '24px 32px'
    }}>
      {/* Toast alert */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '12px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: toast.ok ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)', animation: 'fadeIn 0.2s ease'
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
            🧠 Saved Memory & Segmentation Studio
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage learned character feature vectors, custom box adjustments, additions, and saved image layouts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchMemorySummary}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={exportMemoryJSON}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.4)', cursor: 'pointer'
            }}
          >
            📥 Export Backup JSON
          </button>
          <button
            onClick={handleClearAllVectorMemory}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.4)', cursor: 'pointer'
            }}
          >
            ⚠️ Clear All Vector Memory
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Learned Character Embeddings
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>
            {memoryData?.vector_memory_count ?? 0}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Universal Few-Shot Vector Features
          </span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Saved Layout Inscriptions
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#3b82f6', marginTop: 4 }}>
            {memoryData?.layout_memory_count ?? 0}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Image Bounding Box Layouts
          </span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Total Custom Bounding Boxes
          </span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', marginTop: 4 }}>
            {layoutEntries.reduce((acc, [_, boxes]) => acc + boxes.length, 0)}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Manually Added / Adjusted Bounding Boxes
          </span>
        </div>
      </div>

      {/* Tabs & Search */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', gap: 8, background: '#0e1017', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('vector')}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: activeTab === 'vector' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'vector' ? '#000' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            🧠 Vector Character Memory ({memoryData?.vector_memory_count ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('layout')}
            style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: activeTab === 'layout' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'layout' ? '#000' : 'var(--text-secondary)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            📐 Segmentation Layout Memory ({memoryData?.layout_memory_count ?? 0})
          </button>
        </div>

        <input
          type="text"
          placeholder={activeTab === 'vector' ? "Search Tamil character..." : "Search image filename..."}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12, width: 260,
            background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', outline: 'none'
          }}
        />
      </div>

      {/* Content Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          Loading saved memory database...
        </div>
      ) : activeTab === 'vector' ? (
        /* Vector Memory Tab */
        <div>
          {filteredVector.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: 12 }}>
              No character vector memory entries found.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {filteredVector.map((item, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      #{idx + 1}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 700
                    }}>
                      Few-Shot Vector
                    </span>
                  </div>

                  <div style={{ textAlign: 'center', margin: '14px 0' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {item.modern_tamil}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Learned Neural Embedding
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteVectorItem(idx)}
                    style={{
                      width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer'
                    }}
                  >
                    🗑 Remove Memory
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Layout Memory Tab */
        <div>
          {filteredLayouts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: 12 }}>
              No custom segmentation layouts saved on disk.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {filteredLayouts.map(([filename, boxes], idx) => (
                <div key={idx} style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 18
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
                        🖼️ {filename}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {boxes.length} custom saved bounding boxes
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteLayout(filename)}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer'
                      }}
                    >
                      🗑 Clear Image Layout
                    </button>
                  </div>

                  {/* Bounding boxes grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {boxes.map((b, bIdx) => (
                      <div key={bIdx} style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10
                      }}>
                        <span style={{
                          fontSize: 16, fontWeight: 800, color: 'var(--accent)',
                          background: 'rgba(249, 115, 22, 0.15)', padding: '2px 8px', borderRadius: 6
                        }}>
                          {b.modern_tamil || '?'}
                        </span>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column' }}>
                          <span>Box #{bIdx + 1}</span>
                          <span>X: {b.x}, Y: {b.y}</span>
                          <span>W: {b.w}, H: {b.h}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
