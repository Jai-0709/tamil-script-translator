// Pre-loaded historical Tamil inscription samples for 1-click live demo testing

// Helper to generate a valid stone carving sample JPEG data URI in browser environment
function generateStoneInscriptionImage(sampleText, bgGradient = ['#2a221b', '#3d3228', '#1a1410']) {
  if (typeof document === 'undefined') return ''
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 320
  const ctx = canvas.getContext('2d')

  // Sandstone texture background
  const grad = ctx.createLinearGradient(0, 0, 900, 320)
  grad.addColorStop(0, bgGradient[0])
  grad.addColorStop(0.5, bgGradient[1])
  grad.addColorStop(1, bgGradient[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 900, 320)

  // Stone carving grain noise
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 900; i += 15) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + (Math.random() * 30 - 15), 320)
    ctx.stroke()
  }

  // Chiseled Inscription Text (Carved Stone Glyph Effect)
  ctx.font = '700 44px "Catamaran", "Noto Sans Tamil", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Chisel Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
  ctx.fillText(sampleText, 453, 163)

  // Chisel Highlight
  ctx.fillStyle = '#fde047'
  ctx.fillText(sampleText, 450, 160)

  return canvas.toDataURL('image/jpeg', 0.95)
}

export const SAMPLE_INSCRIPTIONS = [
  {
    id: 'chola-stone-1',
    title: 'Thanjavur Brihadisvara Temple Wall Inscription',
    era: 'Later Chola Dynasty (~1010 CE)',
    scriptType: 'Chola Tamil Inscription Script',
    location: 'Thanjavur, Tamil Nadu',
    image: 'https://images.unsplash.com/photo-1600100397608-f010e423b971?q=80&w=1000&auto=format&fit=crop',
    rawSampleText: 'ஸ்ரீ ராஜராஜ தேவர்க்கு யாண்டு ங-வது',
    englishMeaning: 'In the 3rd regnal year of King Sri Raja Raja Chola I...',
    description: 'Carved on the southern stone wall of the Great Temple, recording royal land grants and gold donations.',
    getStoneDataURI: () => generateStoneInscriptionImage('ஸ்ரீ ராஜராஜ தேவர்க்கு யாண்டு ங-வது', ['#2e241c', '#48392c', '#1f1711'])
  },
  {
    id: 'brahmi-cave-2',
    title: 'Mangulam Tamil Brahmi Cave Inscription',
    era: 'Early Pandyan Period (~3rd Century BCE)',
    scriptType: 'Tamil-Brahmi (Tamili)',
    location: 'Madurai District',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=1000&auto=format&fit=crop',
    rawSampleText: 'கணியன் நந்தாஸிரிகியேன் பிணஅவ்',
    englishMeaning: 'Given by Kanian Nanthasiriyen as a holy bed for Jain monks.',
    description: 'One of the oldest surviving written records in South India, cut into rock beds of Jain ascetic caverns.',
    getStoneDataURI: () => generateStoneInscriptionImage('கணியன் நந்தாஸிரிகியேன் பிணஅவ்', ['#1c242c', '#2c3948', '#11171f'])
  },
  {
    id: 'vatteluttu-copper-3',
    title: 'Velvikudi Copper Plate Grant',
    era: 'Middle Pandyan Dynasty (~770 CE)',
    scriptType: 'Vatteluttu Script',
    location: 'Madurai Museum Archive',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1000&auto=format&fit=crop',
    rawSampleText: 'கோமாறன் சடையற்கு யாண்டு ங-வது',
    englishMeaning: 'In the third year of King Maran Sadaiyan restoring land rights to Vedic scholars.',
    description: 'Famous bilingual copper plate inscription recording the restoration of a village confiscated during Kalabhra rule.',
    getStoneDataURI: () => generateStoneInscriptionImage('கோமாறன் சடையற்கு யாண்டு ங-வது', ['#2c241c', '#48382c', '#1f1611'])
  },
  {
    id: 'grantha-pallava-4',
    title: 'Kanchipuram Kailasanathar Inscription',
    era: 'Pallava Period (~720 CE)',
    scriptType: 'Grantha & Pallava Tamil',
    location: 'Kanchipuram',
    image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1000&auto=format&fit=crop',
    rawSampleText: 'ஸ்ரீ நரசிம்மவர்ம பல்லவேஸ்வரம்',
    englishMeaning: 'Dedicated to the sacred temple of King Narasimhavarman II (Rajasimha).',
    description: 'Sophisticated calligraphic script carved around sandstone shrine foundation tiers.',
    getStoneDataURI: () => generateStoneInscriptionImage('ஸ்ரீ நரசிம்மவர்ம பல்லவேஸ்வரம்', ['#2c1c24', '#482c39', '#1f1117'])
  }
]
