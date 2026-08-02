import { useState } from 'react'
import { SAMPLE_INSCRIPTIONS } from '../data/sampleInscriptions'

export default function LandingPage({ onSelectSample, onLaunchWorkspace }) {
  const [openFaq, setOpenFaq] = useState(null)
  const [activeTab, setActiveTab] = useState('historians')

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx)
  }

  return (
    <div className="w-full bg-[#0b0c14] text-slate-100 overflow-x-hidden">
      
      {/* ── 1. HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* Glow ambient background accents */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-amber-600/20 via-orange-500/20 to-purple-600/10 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="text-center max-w-4xl mx-auto relative z-10">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider mb-6 shadow-lg shadow-amber-500/10 fade-up">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Next-Gen Epigraphic AI • YOLO v8 + Gemini 3.1</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold font-heading tracking-tight leading-[1.1] mb-6 text-white">
            Decode 2,000 Years of <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300 bg-clip-text text-transparent">
              Tamil Inscriptions
            </span> in Seconds
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto mb-10">
            An advanced SaaS epigraphy platform combining smart-tiled computer vision with epigraphic LLMs to decipher ancient Tamil stone carvings, copper plates, and palm-leaf manuscripts.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <button
              onClick={onLaunchWorkspace}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-slate-950 font-bold text-base shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <span>Translate an Inscription</span>
              <span className="text-lg">→</span>
            </button>

            <a
              href="#interactive-demo"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/5 border border-white/15 text-slate-200 font-semibold text-base hover:bg-white/10 hover:border-white/30 transition-all flex items-center justify-center gap-2"
            >
              <span>Try Sample Presets</span>
              <span className="text-amber-400">⚡</span>
            </a>
          </div>

          {/* Hero Visual Before/After Card Showcase */}
          <div className="relative mx-auto rounded-2xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-3 sm:p-4 shadow-2xl backdrop-blur-2xl max-w-4xl overflow-hidden group">
            <div className="relative rounded-xl overflow-hidden bg-[#090a10] border border-white/10 aspect-[16/9] sm:aspect-[21/9]">
              
              {/* Background Sample Image */}
              <img
                src="https://images.unsplash.com/photo-1600100397608-f010e423b971?q=80&w=1200&auto=format&fit=crop"
                alt="Brihadisvara Temple Wall Inscription"
                className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
              />

              {/* Bounding Box Visual Overlay Effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d14] via-black/40 to-transparent flex flex-col justify-between p-4 sm:p-6">
                
                {/* Floating AI Status Badges */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-black/70 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>YOLO v8 Tiled Boxes: 12 Detected</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold backdrop-blur-md">
                    <span>Gemini 3.1 Lite Epigraphic AI</span>
                  </div>
                </div>

                {/* Live Translation Output Overlay */}
                <div className="bg-[#121422]/90 border border-amber-500/30 rounded-xl p-4 sm:p-5 backdrop-blur-xl text-left shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Decoded Script Result</span>
                    <span className="text-[10px] text-slate-400 font-semibold">Later Chola Dynasty (~1010 CE)</span>
                  </div>
                  <div className="tamil-text text-xl sm:text-2xl font-bold text-white mb-1">
                    ஸ்ரீ ராஜராஜ தேவர்க்கு யாண்டு ங-வது
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300 italic font-sans">
                    "In the 3rd regnal year of King Sri Raja Raja Chola I..."
                  </div>
                </div>

              </div>

            </div>
          </div>

          {/* Trust Stat Counter Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-8 border-t border-white/10 text-center">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-heading">10,000+</div>
              <div className="text-xs text-slate-400 font-medium">Inscriptions Decoded</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-heading">98.4%</div>
              <div className="text-xs text-slate-400 font-medium">OCR Recognition Accuracy</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-heading">4+ Eras</div>
              <div className="text-xs text-slate-400 font-medium">Brahmi to Chola Tamil</div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-heading">&lt; 0.3s</div>
              <div className="text-xs text-slate-400 font-medium">Sub-Second AI Latency</div>
            </div>
          </div>

        </div>

      </section>

      {/* ── 2. LIVE INTERACTIVE DEMO PRESETS ───────────────────────────────── */}
      <section id="interactive-demo" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white mb-4">
            Try Sample Inscriptions <span className="text-amber-400">Instantly</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Click any historical sample below to load it into the live AI translator workspace without uploading a file.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SAMPLE_INSCRIPTIONS.map((sample) => (
            <div
              key={sample.id}
              onClick={() => onSelectSample(sample)}
              className="glass-card cursor-pointer group overflow-hidden flex flex-col justify-between p-4 hover:border-amber-500/50 transition-all"
            >
              <div>
                <div className="relative h-40 rounded-lg overflow-hidden mb-4 bg-black">
                  <img
                    src={sample.image}
                    alt={sample.title}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                    {sample.era}
                  </div>
                </div>
                <h3 className="font-heading font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-1">
                  {sample.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {sample.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                  Test Live AI →
                </span>
                <span className="text-[10px] text-slate-500">{sample.location}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Simple 3-Step Pipeline</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white mt-2">
            How The AI Translation Engine Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Step 1 */}
          <div className="glass-card p-6 relative">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 font-extrabold font-heading text-xl flex items-center justify-center mb-6">
              01
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-heading">Capture & Upload</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload a photograph of stone temple inscriptions, rock cut caves, copper plates, or palm-leaf manuscripts directly from your smartphone or desktop.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card p-6 relative">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-extrabold font-heading text-xl flex items-center justify-center mb-6">
              02
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-heading">Smart-Tiled YOLO OCR</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Our YOLO v8 vision model slices high-res images into intelligent tiles, isolating individual characters and generating interactive bounding box coordinates.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card p-6 relative">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 font-extrabold font-heading text-xl flex items-center justify-center mb-6">
              03
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-heading">Epigraphic AI Reconstruction</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Gemini 3.1 & Beam-Search NLP analyze context, restore weathered or missing characters, and output modern Tamil script with full historical meanings.
            </p>
          </div>

        </div>
      </section>

      {/* ── 4. FEATURES MATRIX ──────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Enterprise Capabilities</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white mt-2">
            Built for Researchers, Students & Heritage Bodies
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="glass-card p-6">
            <div className="text-2xl mb-3">📜</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Multi-Era Recognition</h3>
            <p className="text-slate-400 text-sm">
              Supports Tamil Brahmi (3rd C. BCE), Vatteluttu, Grantha, and Middle/Later Chola & Pandyan epigraphic scripts.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="text-2xl mb-3">✨</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Missing Character Restoration</h3>
            <p className="text-slate-400 text-sm">
              Context-aware LLM detects erosion and stone breaks to automatically reconstruct missing middle characters.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="text-2xl mb-3">🎯</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Interactive Bounding Boxes</h3>
            <p className="text-slate-400 text-sm">
              Click any bounding box on the original image canvas to view alternative readings or manually correct classified characters.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="text-2xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Top 10 NLP Combinations</h3>
            <p className="text-slate-400 text-sm">
              Ranks the top 10 most probable grammatical variations generated by mathematical bigram beam search.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="text-2xl mb-3">📱</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Mobile Camera Optimized</h3>
            <p className="text-slate-400 text-sm">
              Photograph stone inscriptions directly on-site at temples with responsive mobile upload and region cropping.
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="text-2xl mb-3">🧠</div>
            <h3 className="text-lg font-bold text-white mb-2 font-heading">Corrections Memory Engine</h3>
            <p className="text-slate-400 text-sm">
              User corrections are persisted locally and sent to the active backend memory store to continuously improve accuracy.
            </p>
          </div>

        </div>
      </section>

      {/* ── 5. USE CASES TABS ───────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10 bg-gradient-to-b from-white/[0.01] to-transparent">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Tailored SaaS Solutions</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white mt-2">
            Who Uses Akshara Epigraphy AI?
          </h2>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {[
            { id: 'historians', label: 'Historians & Archeologists' },
            { id: 'students', label: 'University Students & Scholars' },
            { id: 'tourists', label: 'Temple Visitors & Enthusiasts' },
            { id: 'museums', label: 'Museums & State Archives' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 shadow-lg shadow-orange-500/20'
                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Cards */}
        <div className="glass-card p-8 max-w-4xl mx-auto text-center border-amber-500/30">
          {activeTab === 'historians' && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">Accelerate Primary Source Research</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Rapidly transcribe high-resolution field photos into modern Tamil script. Export character coordinates, confidence metrics, and historical metadata directly into academic research papers.
              </p>
            </div>
          )}
          {activeTab === 'students' && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">Learn Ancient Tamil Script Eras</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Compare ancient glyph shapes side-by-side with modern Tamil equivalents. Gain instant grammatical breakdowns and dictionary meanings for classical literature and epigraphy studies.
              </p>
            </div>
          )}
          {activeTab === 'tourists' && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">Unlock Temple Wall Stories On-Site</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Point your smartphone camera at temple carvings at Tanjore, Madurai, or Kanchipuram to read the centuries-old royal proclamations and donor inscriptions right where you stand.
              </p>
            </div>
          )}
          {activeTab === 'museums' && (
            <div>
              <h3 className="text-2xl font-bold text-white mb-3 font-heading">Digitize & Archive Artifact Collections</h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Automate bulk cataloging of copper plates, stone slabs, and palm-leaf manuscripts with custom dataset studio tools and API integration.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 6. PRICING TIERS ────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Flexible SaaS Pricing</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold font-heading text-white mt-2">
            Plans for Every Level of Research
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Free Tier */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Scholar / Community</div>
              <div className="text-4xl font-extrabold text-white font-heading mb-1">$0 <span className="text-xs text-slate-400 font-normal">/ forever</span></div>
              <p className="text-xs text-slate-400 mb-6">Ideal for casual users, students & temple tourists.</p>
              
              <ul className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-2">✓ 25 AI Inscription Translations / Mo</li>
                <li className="flex items-center gap-2">✓ YOLO v8 Smart-Tiled OCR</li>
                <li className="flex items-center gap-2">✓ Top 10 Beam Search Variations</li>
                <li className="flex items-center gap-2">✓ Mobile Camera Upload Support</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              Get Started Free
            </button>
          </div>

          {/* Pro Tier (Featured) */}
          <div className="glass-card p-6 flex flex-col justify-between border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent relative shadow-xl shadow-amber-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider">
              Most Popular
            </div>

            <div>
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Epigraphist Pro</div>
              <div className="text-4xl font-extrabold text-white font-heading mb-1">$29 <span className="text-xs text-slate-400 font-normal">/ month</span></div>
              <p className="text-xs text-slate-400 mb-6">For historians, researchers & active scholars.</p>
              
              <ul className="space-y-3 text-xs text-slate-200 mb-6">
                <li className="flex items-center gap-2 text-amber-300 font-semibold">✓ Unlimited AI Inscription Decodes</li>
                <li className="flex items-center gap-2">✓ Gemini 3.1 Epigraphic Restorations</li>
                <li className="flex items-center gap-2">✓ Word-by-Word Grammatical Analysis</li>
                <li className="flex items-center gap-2">✓ HD Image Upload & Crop Studio</li>
                <li className="flex items-center gap-2">✓ Export to PDF, Image & TXT</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:scale-[1.02] text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-500/20 transition-all"
            >
              Launch Pro Workspace
            </button>
          </div>

          {/* Institutional Tier */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Institutional & Museum</div>
              <div className="text-4xl font-extrabold text-white font-heading mb-1">$149 <span className="text-xs text-slate-400 font-normal">/ month</span></div>
              <p className="text-xs text-slate-400 mb-6">For universities, archives & state bodies.</p>
              
              <ul className="space-y-3 text-xs text-slate-300 mb-6">
                <li className="flex items-center gap-2">✓ Bulk Archive Batch Uploads</li>
                <li className="flex items-center gap-2">✓ REST API Key Access</li>
                <li className="flex items-center gap-2">✓ Custom Dataset Studio & Training</li>
                <li className="flex items-center gap-2">✓ Multi-User Team Workspaces</li>
                <li className="flex items-center gap-2">✓ Priority Dedicated Server Processing</li>
              </ul>
            </div>

            <button
              onClick={onLaunchWorkspace}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
            >
              Contact Institutional Sales
            </button>
          </div>

        </div>
      </section>

      {/* ── 7. FAQ ACCORDION ───────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-white/10">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold font-heading text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
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
              className="glass-card p-5 cursor-pointer hover:border-amber-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-white text-base">{item.q}</h3>
                <span className="text-amber-400 font-bold text-lg">{openFaq === idx ? '−' : '+'}</span>
              </div>
              {openFaq === idx && (
                <p className="mt-3 text-slate-300 text-sm leading-relaxed border-t border-white/10 pt-3">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 8. FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#07080f] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <span className="tamil-text text-xl font-bold text-amber-400">அ</span>
              <span className="font-heading font-bold text-white text-lg">AKSHARA EPIGRAPHY AI</span>
            </div>
            <p className="text-xs text-slate-400">
              Deciphering Tamil Cultural Heritage through Computer Vision & Artificial Intelligence.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">
            <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300 font-mono">
              FastAPI 0.111 • YOLOv8 • PyTorch • Gemini 3.1
            </span>
          </div>

          <div className="text-xs text-slate-500">
            © {new Date().getFullYear()} Akshara AI Epigraphy Engine. All rights reserved.
          </div>

        </div>
      </footer>

    </div>
  )
}
