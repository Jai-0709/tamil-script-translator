export default function LandingPage({ onLaunchWorkspace }) {
  const steps = [
    {
      n: '01',
      title: 'Upload',
      body: 'Drag or browse to upload any image — stone rubbing, photograph, palm-leaf scan.',
    },
    {
      n: '02',
      title: 'Segment',
      body: 'YOLO Smart-Tiled OCR isolates each Tamil character with sub-pixel bounding boxes.',
    },
    {
      n: '03',
      title: 'Classify',
      body: 'A ResNet classifier matches each glyph to one of 247 modern Tamil character classes.',
    },
    {
      n: '04',
      title: 'Translate',
      body: 'Beam-search NLP assembles the sequence; Gemini AI refines and provides a word-by-word breakdown.',
    },
  ]

  const features = [
    {
      title: 'Smart-tiled YOLO',
      body: 'Divides large inscriptions into overlapping tiles, then merges detections for complete coverage.',
    },
    {
      title: 'Confidence scoring',
      body: 'Every character carries a model confidence score. Low-confidence detections are visually flagged.',
    },
    {
      title: 'Manual correction',
      body: 'Click any bounding box to override the prediction. Corrections propagate to the sentence immediately.',
    },
    {
      title: 'Memory store',
      body: 'Memorised corrections persist across sessions via a local memory store, improving future runs.',
    },
    {
      title: 'Gemini AI refinement',
      body: 'Passes top-50 beam candidates to Gemini for epigraphic context-aware selection and explanation.',
    },
    {
      title: 'Dataset studio',
      body: 'Export corrected segmentations as training data, or import labelled datasets to expand the classifier.',
    },
  ]

  return (
    <main style={{ paddingTop: 52 }}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '60px 32px 60px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background: subtle radial from centre */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(200,134,90,0.06) 0%, transparent 70%)',
        }} />

        {/* Primary headline */}
        <h1 className="display-xl reveal reveal-d1" style={{ maxWidth: 780, margin: '0 auto 6px' }}>
          Unveil Classical<br />
          <span style={{ color: 'var(--copper)' }}>Tamil Epigraphy.</span>
        </h1>

        {/* Tamil script headline underneath */}
        <p
          className="tamil reveal reveal-d1"
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 3rem)',
            fontWeight: 500,
            color: 'var(--fg-2)',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            marginBottom: 28,
            marginTop: 6,
          }}
        >
          பண்டைய கல்வெட்டு ஆய்வகம்
        </p>

        {/* Sub-heading */}
        <p className="body-lg reveal reveal-d2" style={{ maxWidth: 580, margin: '0 auto 44px' }}>
          AI-powered computational epigraphy platform — upload ancient stone inscriptions, 
          palm-leaf manuscripts, or rubbings to extract word-segmented modern Tamil and English historical translations.
        </p>

        {/* CTA group */}
        <div className="reveal reveal-d3" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-primary" onClick={onLaunchWorkspace}>
            Open Workspace
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <a href="#how-it-works" className="btn-secondary" style={{ textDecoration: 'none' }}>
            How it works
          </a>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '72px 32px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <div className="label" style={{ color: 'var(--copper)', marginBottom: 12 }}>Process</div>
          <h2 className="display-md">How it works</h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 1,
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              padding: '28px 24px',
              background: 'var(--surface-1)',
              borderRight: i < steps.length - 1 ? '1px solid var(--line)' : 'none',
            }}>
              <div className="label" style={{ color: 'var(--copper)', marginBottom: 12 }}>
                {step.n}
              </div>
              <h3 style={{
                fontSize: 17, fontWeight: 600, color: 'var(--fg)',
                letterSpacing: '-0.02em', marginBottom: 8,
              }}>
                {step.title}
              </h3>
              <p className="body-sm">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 32px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <div className="label" style={{ color: 'var(--copper)', marginBottom: 12 }}>Capabilities</div>
          <h2 className="display-md">Every detail considered</h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 1,
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          overflow: 'hidden',
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: '24px',
              background: 'var(--surface-1)',
              borderRight: '1px solid var(--line)',
              borderBottom: '1px solid var(--line)',
            }}>
              <h3 style={{
                fontSize: 15, fontWeight: 600, color: 'var(--fg)',
                letterSpacing: '-0.01em', marginBottom: 6,
              }}>
                {f.title}
              </h3>
              <p className="body-sm">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 960,
        margin: '0 auto 72px',
        padding: '52px 48px',
        background: 'var(--surface-1)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        textAlign: 'center',
      }}>
        <div className="label" style={{ color: 'var(--copper)', marginBottom: 16 }}>
          Ready to begin
        </div>
        <h2 className="display-md" style={{ marginBottom: 16 }}>
          Start your first<br />analysis
        </h2>
        <p className="body-lg" style={{ maxWidth: 380, margin: '0 auto 32px' }}>
          No sign-up required. Upload an image and receive a full translation in under 30 seconds.
        </p>
        <button className="btn-primary" onClick={onLaunchWorkspace}>
          Open Workspace
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--line)',
        padding: '24px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        <span className="label" style={{ color: 'var(--fg-4)' }}>
          Tamil Inscription Suite
        </span>
        <span className="label" style={{ color: 'var(--fg-4)' }}>
          AI-Powered · Open Research
        </span>
      </footer>
    </main>
  )
}
