import { useState } from 'react'

export default function Navbar({
  activePage = 'landing',
  setActivePage,
  theme = 'dark',
  toggleTheme,
  apiStatus = 'online'
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      width: '100%',
      height: '64px',
      background: 'rgba(12, 13, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        
        {/* Brand Logo & Title */}
        <div 
          onClick={() => setActivePage('landing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #eab308 100%)',
            padding: '2px',
            boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#0c0d14',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span className="tamil-text" style={{ fontSize: '18px', fontWeight: 900, color: '#fde047' }}>அ</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: '16px',
                letterSpacing: '-0.02em',
                color: '#ffffff',
              }}>
                AKSHARA <span style={{ color: '#f97316', fontWeight: 600 }}>EPIGRAPHY</span>
              </span>
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(234, 88, 12, 0.15)',
                color: '#f97316',
                border: '1px solid rgba(234, 88, 12, 0.3)',
              }}>
                AI SaaS
              </span>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '-2px' }}>
              Tamil Inscription Deciphering Engine
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links (Nav Pills) */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border)',
          padding: '4px',
          borderRadius: '100px',
        }}>
          {[
            ['landing', 'Home'],
            ['translator', 'AI Workspace'],
            ['dataset', 'Dataset Studio'],
            ['memory', 'Memory Studio'],
          ].map(([pageKey, label]) => (
            <button
              key={pageKey}
              onClick={() => setActivePage(pageKey)}
              style={{
                padding: '6px 16px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: activePage === pageKey ? 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' : 'transparent',
                color: activePage === pageKey ? '#0c0d14' : 'var(--text-secondary)',
                boxShadow: activePage === pageKey ? '0 4px 12px rgba(234, 88, 12, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right Actions (API Status + Launch Workspace CTA) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* API Health Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '100px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#34d399',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
            <span>FastAPI + YOLO Live</span>
          </div>

          {/* Launch Workspace CTA */}
          {activePage !== 'translator' && (
            <button
              onClick={() => setActivePage('translator')}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                color: '#0c0d14',
                fontWeight: 900,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              Launch Workspace →
            </button>
          )}
        </div>

      </div>
    </header>
  )
}
