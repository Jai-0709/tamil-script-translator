import { useState, useEffect } from 'react'

export default function Navbar({ activePage, setActivePage, theme = 'dark', onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isLanding = activePage === 'landing'

  const navLinks = [
    ['landing',    'Overview'],
    ['tourist',    'Tourist Mode'],
    ['translator', 'Workspace'],
    ['dataset',    'Dataset'],
    ['memory',     'Memory'],
  ]

  const handleNavClick = (key) => {
    setActivePage(key)
    setMobileMenuOpen(false)
  }

  return (
    <>
      <nav
        className={`navbar-container ${scrolled || !isLanding ? 'nav-scrolled' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: isLanding && !scrolled ? 'transparent' : 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--line)',
          transition: `background 200ms ease, border-color 200ms ease`,
        }}
      >
        {/* Brand & Home Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => handleNavClick('landing')}
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.02em' }}>
              Tamil Epigraphy
            </span>
          </button>
        </div>

        {/* Desktop Center Links */}
        <div className="desktop-nav-links" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {navLinks.map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleNavClick(key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 14px',
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

        {/* Desktop Right Actions */}
        <div className="desktop-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--fg)',
                padding: '5px 12px',
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
              onClick={() => handleNavClick('translator')}
              style={{ padding: '6px 14px', fontSize: 13 }}
            >
              Workspace
            </button>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="mobile-hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            color: 'var(--fg)',
            padding: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileMenuOpen ? (
              <path d="M18 6L6 18M6 6l12 12"/>
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16"/>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-menu" style={{
          position: 'fixed',
          top: 52,
          left: 0,
          right: 0,
          zIndex: 199,
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--line-strong)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          animation: 'slideDown 0.2s ease-out',
        }}>
          {navLinks.map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleNavClick(key)}
              style={{
                background: activePage === key ? 'var(--surface-3)' : 'transparent',
                border: '1px solid',
                borderColor: activePage === key ? 'var(--copper-border)' : 'transparent',
                borderRadius: 'var(--r-sm)',
                padding: '12px 16px',
                textAlign: 'left',
                fontSize: 15,
                fontWeight: activePage === key ? 700 : 500,
                color: activePage === key ? 'var(--copper)' : 'var(--fg)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
            {onToggleTheme && (
              <button
                onClick={() => { onToggleTheme(); setMobileMenuOpen(false) }}
                style={{
                  flex: 1,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-sm)',
                  color: 'var(--fg)',
                  padding: '12px',
                  fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            )}

            {activePage !== 'translator' && (
              <button
                className="btn-primary"
                onClick={() => handleNavClick('translator')}
                style={{ flex: 1, padding: '12px', fontSize: 13, textAlign: 'center' }}
              >
                Open Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
