import { useState, useEffect } from 'react'

export default function Navbar({ activePage, setActivePage, theme = 'dark', onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isLanding = activePage === 'landing'

  return (
    <nav
      className={scrolled || !isLanding ? 'nav-scrolled' : ''}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        background: isLanding && !scrolled ? 'transparent' : undefined,
        transition: `background ${200}ms ease, border-color ${200}ms ease, backdrop-filter ${200}ms ease`,
        borderBottom: '1px solid transparent',
      }}
    >
      {/* Home Button */}
      <button
        onClick={() => setActivePage('landing')}
        title="Home"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 0,
          color: 'var(--copper)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </button>

      {/* Center links */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}>
        {[
          ['landing',    'Overview'],
          ['translator', 'Workspace'],
          ['dataset',    'Dataset'],
          ['memory',     'Memory'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActivePage(key)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px 14px',
              borderRadius: 'var(--r-sm)',
              fontSize: 14,
              fontWeight: activePage === key ? 600 : 400,
              color: activePage === key ? 'var(--fg)' : 'var(--fg-3)',
              letterSpacing: '-0.01em',
              transition: 'color var(--dur-fast)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CTA & Theme Switcher */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              color: 'var(--fg)',
              padding: '5px 11px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600,
            }}
          >
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        )}

        {activePage !== 'translator' && (
          <button
            className="btn-primary"
            onClick={() => setActivePage('translator')}
            style={{ padding: '7px 18px', fontSize: 13 }}
          >
            Open Workspace
          </button>
        )}
      </div>
    </nav>
  )
}
