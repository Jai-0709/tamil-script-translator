import { useState } from 'react'
import { SAMPLE_INSCRIPTIONS } from '../data/sampleInscriptions'

export default function LandingPage({ onSelectSample, onLaunchWorkspace }) {
  const [openFaq, setOpenFaq] = useState(null)
  const [activeTab, setActiveTab] = useState('historians')

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'Outfit, Inter, sans-serif',
      overflowX: 'hidden',
    }}>
      
      {/* ── 1. HERO SECTION ────────────────────────────────────────────────── */}
      <section style={{
        position: 'relative',
        paddingTop: '60px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
      }}>
        {/* Ambient Glow Background Accent */}
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(234, 88, 12, 0.18) 0%, rgba(139, 92, 246, 0.08) 60%, transparent 100%)',
          filter: 'blur(90px)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }} />

        <div style={{
          textAlign: 'center',
          maxWidth: '900px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Top Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '100px',
            background: 'rgba(234, 88, 12, 0.12)',
            border: '1px solid rgba(234, 88, 12, 0.3)',
            color: '#f97316',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(234, 88, 12, 0.15)',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
            <span>Next-Gen Epigraphic AI • YOLO v8 + Gemini 3.1</span>
          </div>

          {/* Main Headline */}
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            marginBottom: '24px',
          }}>
            Decode 2,000 Years of <br />
            <span className="gradient-text-terracotta">
              Tamil Inscriptions
            </span> in Seconds
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: '1.15rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '680px',
            margin: '0 auto 40px auto',
          }}>
            An enterprise epigraphy SaaS platform combining smart-tiled computer vision with epigraphic LLMs to decipher ancient Tamil stone carvings, copper plates, and palm-leaf manuscripts.
          </p>

          {/* CTA Buttons Group */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '56px',
          }}>
            <button
              onClick={onLaunchWorkspace}
              style={{
                padding: '16px 36px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 50%, #eab308 100%)',
                color: '#0c0d14',
                fontWeight: 800,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(234, 88, 12, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <span>Translate an Inscription</span>
              <span style={{ fontSize: '18px' }}>→</span>
            </button>

            <a
              href="#interactive-demo"
              style={{
                padding: '16px 32px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-light)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
            >
              <span>Try Live Preset Presets</span>
              <span style={{ color: '#eab308' }}>⚡</span>
            </a>
          </div>

          {/* Hero Visual Before/After Showcase */}
          <div style={{
            position: 'relative',
            margin: '0 auto',
            borderRadius: '20px',
            border: '1px solid var(--border-light)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
            padding: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            maxWidth: '960px',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'relative',
              borderRadius: '14px',
              overflow: 'hidden',
              background: '#090a10',
              border: '1px solid var(--border)',
              aspectRatio: '21/9',
              minHeight: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, #48392c 0%, #2e241c 50%, #0c0d14 100%)',
                opacity: 0.9,
              }} />

              {/* Bounding Box Visual Overlay Effect */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(0deg, #0c0d14 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '4px 12px', borderRadius: '6px',
                    background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
                    <span>YOLO v8 Tiled Boxes: 12 Detected</span>
                  </div>
                  <div style={{
                    padding: '4px 12px', borderRadius: '6px',
                    background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)',
                    color: '#c084fc', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
                  }}>
                    <span>Gemini 3.1 Lite Epigraphic AI</span>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(18, 20, 34, 0.92)',
                  border: '1px solid rgba(234, 88, 12, 0.35)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  textAlign: 'left',
                  backdropFilter: 'blur(12px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Decoded Inscription Script Result
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Later Chola Dynasty (~1010 CE)</span>
                  </div>
                  <div className="tamil-text" style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                    ஸ்ரீ ராஜராஜ தேவர்க்கு யாண்டு ங-வது
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    "In the 3rd regnal year of King Sri Raja Raja Chola I..."
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Stat Counter Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '24px',
            marginTop: '64px',
            paddingTop: '32px',
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>10,000+</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Inscriptions Decoded</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#f97316' }}>98.4%</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>OCR Recognition Accuracy</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#ffffff' }}>4+ Eras</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Brahmi to Chola Tamil</div>
            </div>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: '#34d399' }}>&lt; 0.3s</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>Sub-Second AI Latency</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. LIVE INTERACTIVE DEMO PRESETS ───────────────────────────────── */}
      <section id="interactive-demo" style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 48px auto' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
            Try Sample Inscriptions <span style={{ color: '#f97316' }}>Instantly</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Click any historical sample below to load it into the live AI translator workspace without uploading a file.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
        }}>
          {SAMPLE_INSCRIPTIONS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="glass-card"
              style={{
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px',
              }}
            >
              <div>
                <div style={{
                  position: 'relative',
                  height: '160px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginBottom: '16px',
                  background: '#000',
                }}>
                  <img
                    src={sample.image}
                    alt={sample.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    padding: '3px 8px', borderRadius: '4px',
                    background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(234,88,12,0.4)',
                    color: '#fde047', fontSize: '10px', fontWeight: 700,
                  }}>
                    {sample.era}
                  </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  {sample.title}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {sample.description}
                </p>
              </div>

              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>
                  Test Live AI →
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sample.location}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 56px auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ea580c' }}>
            Simple 3-Step Pipeline
          </span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
            How The AI Translation Engine Works
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {/* Step 1 */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(234, 88, 12, 0.15)', border: '1px solid rgba(234, 88, 12, 0.3)',
              color: '#ea580c', fontWeight: 900, fontSize: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
            }}>
              01
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Capture & Upload</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Upload a photograph of stone temple inscriptions, rock cut caves, copper plates, or palm-leaf manuscripts directly from your smartphone or desktop.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)',
              color: '#eab308', fontWeight: 900, fontSize: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
            }}>
              02
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Smart-Tiled YOLO OCR</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Our YOLO v8 vision model slices high-res images into intelligent tiles, isolating individual characters and generating interactive bounding box coordinates.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
              color: '#a855f7', fontWeight: 900, fontSize: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
            }}>
              03
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Epigraphic AI Reconstruction</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Gemini 3.1 & Beam-Search NLP analyze context, restore weathered or missing characters, and output modern Tamil script with full historical meanings.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES MATRIX ──────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 56px auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#eab308' }}>
            Enterprise Capabilities
          </span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
            Built for Researchers, Students & Heritage Bodies
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
        }}>
          {[
            { icon: '📜', title: 'Multi-Era Recognition', desc: 'Supports Tamil Brahmi (3rd C. BCE), Vatteluttu, Grantha, and Middle/Later Chola & Pandyan epigraphic scripts.' },
            { icon: '✨', title: 'Missing Character Restoration', desc: 'Context-aware LLM detects erosion and stone breaks to automatically reconstruct missing middle characters.' },
            { icon: '🎯', title: 'Interactive Bounding Boxes', desc: 'Click any bounding box on the original image canvas to view alternative readings or manually correct classified characters.' },
            { icon: '🔍', title: 'Top 10 NLP Combinations', desc: 'Ranks the top 10 most probable grammatical variations generated by mathematical bigram beam search.' },
            { icon: '📱', title: 'Mobile Camera Optimized', desc: 'Photograph stone inscriptions directly on-site at temples with responsive mobile upload and region cropping.' },
            { icon: '🧠', title: 'Corrections Memory Engine', desc: 'User corrections are persisted locally and sent to the active backend memory store to continuously improve accuracy.' },
          ].map((feat, i) => (
            <div key={i} className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>{feat.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>{feat.title}</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. USE CASES TABS ───────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ea580c' }}>
            Tailored SaaS Solutions
          </span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
            Who Uses Akshara Epigraphy AI?
          </h2>
        </div>

        {/* Tab Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '40px',
        }}>
          {[
            { id: 'historians', label: 'Historians & Archeologists' },
            { id: 'students', label: 'University Students & Scholars' },
            { id: 'tourists', label: 'Temple Visitors & Enthusiasts' },
            { id: 'museums', label: 'Museums & State Archives' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                border: activeTab === tab.id ? 'none' : '1px solid var(--border)',
                background: activeTab === tab.id ? 'linear-gradient(135deg, #ea580c 0%, #eab308 100%)' : 'rgba(255,255,255,0.04)',
                color: activeTab === tab.id ? '#0c0d14' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Cards */}
        <div className="glass-card" style={{ padding: '36px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          {activeTab === 'historians' && (
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Accelerate Primary Source Research</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Rapidly transcribe high-resolution field photos into modern Tamil script. Export character coordinates, confidence metrics, and historical metadata directly into academic research papers.
              </p>
            </div>
          )}
          {activeTab === 'students' && (
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Learn Ancient Tamil Script Eras</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Compare ancient glyph shapes side-by-side with modern Tamil equivalents. Gain instant grammatical breakdowns and dictionary meanings for classical literature and epigraphy studies.
              </p>
            </div>
          )}
          {activeTab === 'tourists' && (
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Unlock Temple Wall Stories On-Site</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Point your smartphone camera at temple carvings at Tanjore, Madurai, or Kanchipuram to read the centuries-old royal proclamations and donor inscriptions right where you stand.
              </p>
            </div>
          )}
          {activeTab === 'museums' && (
            <div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>Digitize & Archive Artifact Collections</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Automate bulk cataloging of copper plates, stone slabs, and palm-leaf manuscripts with custom dataset studio tools and API integration.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 6. PRICING TIERS ────────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '1280px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 56px auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#eab308' }}>
            Flexible SaaS Pricing
          </span>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff', marginTop: '8px' }}>
            Plans for Every Level of Research
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '32px',
        }}>
          {/* Free Tier */}
          <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Scholar / Community</div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>$0 <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>/ forever</span></div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Ideal for casual users, students & temple tourists.</p>
              
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                <li>✓ 25 AI Inscription Translations / Mo</li>
                <li>✓ YOLO v8 Smart-Tiled OCR</li>
                <li>✓ Top 10 Beam Search Variations</li>
                <li>✓ Mobile Camera Upload Support</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)',
                color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}
            >
              Get Started Free
            </button>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="glass-card" style={{
            padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: '1px solid rgba(234, 88, 12, 0.4)', background: 'linear-gradient(180deg, rgba(234,88,12,0.08) 0%, transparent 100%)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
              padding: '4px 14px', borderRadius: '100px', background: '#ea580c',
              color: '#0c0d14', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Most Popular
            </div>

            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Epigraphist Pro</div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>$29 <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>/ month</span></div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>For historians, researchers & active scholars.</p>
              
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: 'var(--text-primary)', marginBottom: '32px' }}>
                <li style={{ color: '#fde047', fontWeight: 700 }}>✓ Unlimited AI Inscription Decodes</li>
                <li>✓ Gemini 3.1 Epigraphic Restorations</li>
                <li>✓ Word-by-Word Grammatical Analysis</li>
                <li>✓ HD Image Upload & Crop Studio</li>
                <li>✓ Export to PDF, Image & TXT</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)', border: 'none',
                color: '#0c0d14', fontWeight: 900, fontSize: '13px', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(234,88,12,0.3)',
              }}
            >
              Launch Pro Workspace
            </button>
          </div>

          {/* Institutional Tier */}
          <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Institutional & Museum</div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>$149 <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>/ month</span></div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '24px' }}>For universities, archives & state bodies.</p>
              
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                <li>✓ Bulk Archive Batch Uploads</li>
                <li>✓ REST API Key Access</li>
                <li>✓ Custom Dataset Studio & Training</li>
                <li>✓ Multi-User Team Workspaces</li>
                <li>✓ Priority Dedicated Server Processing</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)',
                color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              }}
            >
              Contact Institutional Sales
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ACCORDION ───────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '80px',
        paddingBottom: '80px',
        paddingLeft: '24px',
        paddingRight: '24px',
        maxWidth: '800px',
        margin: '0 auto',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffffff' }}>Frequently Asked Questions</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            {
              q: 'What script eras are currently supported by the AI model?',
              a: 'Akshara Epigraphy AI supports Early Tamil-Brahmi (~3rd C. BCE), Vatteluttu (~6th C. CE), Grantha, and Middle to Later Chola & Pandyan stone inscription scripts (~10th - 13th C. CE).'
            },
            {
              q: 'How does the model handle damaged or weathered stone inscriptions?',
              a: 'Our smart-tiled YOLO v8 vision model detects visible character outlines, while the Gemini 3.1 LLM analyzes sentence context and mathematical bigram probabilities to reconstruct erased or missing middle characters.'
            },
            {
              q: 'Can I use this on my mobile phone while visiting ancient temples?',
              a: 'Yes! The web application is fully responsive. You can take a photo of any wall carving directly with your phone camera, crop the inscription region, and translate it on-site.'
            },
            {
              q: 'Is my correction feedback saved?',
              a: 'Yes. When you click any bounding box to manually correct a character classification, the fix is persisted to your local memory store and sent to the dataset studio for model fine-tuning.'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => toggleFaq(idx)}
              className="glass-card"
              style={{ padding: '20px', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{item.q}</h3>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#f97316' }}>{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && (
                <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        background: '#07080f',
        paddingTop: '48px',
        paddingBottom: '48px',
        paddingLeft: '24px',
        paddingRight: '24px',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '24px',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="tamil-text" style={{ fontSize: '20px', fontWeight: 700, color: '#f97316' }}>அ</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>AKSHARA EPIGRAPHY AI</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Deciphering Tamil Cultural Heritage through Computer Vision & Artificial Intelligence.
            </p>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            FastAPI 0.111 • YOLOv8 • PyTorch • Gemini 3.1
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Akshara AI Epigraphy Engine. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}
