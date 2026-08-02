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
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-[var(--border)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div 
          onClick={() => setActivePage('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-yellow-400 p-0.5 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0c0d14] rounded-[10px] flex items-center justify-center">
              <span className="tamil-text text-xl font-black text-amber-400">அ</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-lg tracking-tight text-white group-hover:text-amber-400 transition-colors">
                AKSHARA <span className="text-orange-500 font-medium">EPIGRAPHY</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                AI SaaS
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">
              Tamil Inscription Deciphering Engine
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md">
          <button
            onClick={() => setActivePage('landing')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activePage === 'landing'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Home
          </button>
          
          <button
            onClick={() => setActivePage('translator')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activePage === 'translator'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            AI Workspace
          </button>

          <button
            onClick={() => setActivePage('dataset')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activePage === 'dataset'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Dataset Studio
          </button>

          <button
            onClick={() => setActivePage('memory')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activePage === 'memory'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Memory Studio
          </button>
        </nav>

        {/* Right Actions (API Status + Launch Workspace CTA + Theme Toggle) */}
        <div className="hidden sm:flex items-center gap-3">
          {/* API Health Status Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>FastAPI + YOLO Live</span>
          </div>

          {/* Theme Toggle Button */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}

          {/* Primary CTA Button */}
          {activePage !== 'translator' && (
            <button
              onClick={() => setActivePage('translator')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-slate-950 font-bold text-xs shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Launch Workspace →
            </button>
          )}
        </div>

        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 border-t border-white/10 bg-[#0c0d14]/95 backdrop-blur-xl flex flex-col gap-2">
          <button
            onClick={() => { setActivePage('landing'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold ${
              activePage === 'landing' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-300'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => { setActivePage('translator'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold ${
              activePage === 'translator' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-300'
            }`}
          >
            AI Workspace
          </button>
          <button
            onClick={() => { setActivePage('dataset'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold ${
              activePage === 'dataset' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-300'
            }`}
          >
            Dataset Studio
          </button>
          <button
            onClick={() => { setActivePage('memory'); setMobileMenuOpen(false); }}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold ${
              activePage === 'memory' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-slate-300'
            }`}
          >
            Memory Studio
          </button>
        </div>
      )}
    </header>
  )
}
