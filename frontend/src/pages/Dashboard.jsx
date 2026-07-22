import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, Loader2, ArrowRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const canvasRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(t('error'));
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Draw bounding boxes on the original image
  useEffect(() => {
    if (result && result.original_b64 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Draw boxes
        ctx.lineWidth = Math.max(1, Math.floor(img.width / 800));
        
        result.words.forEach(word => {
          // Box
          ctx.strokeStyle = 'rgba(35, 83, 71, 0.8)'; // Temple Teal, slightly transparent
          ctx.strokeRect(word.x, word.y, word.w, word.h);
          
          // Background for text
          const fontSize = Math.max(12, Math.floor(word.h * 0.5));
          ctx.font = `bold ${fontSize}px "Tiro Tamil", serif`;
          const text = word.modern_tamil;
          const textWidth = ctx.measureText(text).width;
          const textHeight = fontSize;
          
          ctx.fillStyle = 'rgba(244, 240, 236, 0.85)'; // Bg color (stone), semi-transparent
          ctx.fillRect(word.x, word.y, textWidth + 6, textHeight + 6);
          
          // Text
          ctx.fillStyle = '#b2533e'; // Terracotta
          ctx.fillText(text, word.x + 3, word.y + textHeight);
        });
      };
      img.src = result.original_b64;
    }
  }, [result]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
        <p className="text-temple-text/70">{t('step_upload_desc')}</p>
      </div>

      {/* Upload Section */}
      <div className="bento-card p-8 border-dashed border-4 border-temple-gold/50 flex flex-col items-center justify-center text-center space-y-4">
        <UploadCloud size={48} className="text-temple-gold" />
        <p className="text-lg font-semibold">{t('upload_prompt')}</p>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange} 
          className="block w-full max-w-sm text-sm text-temple-text file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-temple-gold/20 file:text-temple-gold hover:file:bg-temple-gold/30 cursor-pointer"
        />
        {file && (
          <button 
            onClick={handleUpload} 
            disabled={loading}
            className="primary-btn mt-4 w-full max-w-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : t('upload_btn')}
          </button>
        )}
        {error && <p className="text-red-600 font-bold mt-2">{error}</p>}
      </div>

      {/* Results Section */}
      {loading && (
        <div className="bento-card p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={48} className="animate-spin text-temple-terracotta" />
          <p className="text-xl font-bold">{t('processing')}</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Pipeline stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bento-card p-4 space-y-2">
              <h3 className="font-bold text-lg text-temple-teal">{t('pipeline_step1')}</h3>
              <img src={result.original_b64} alt="Original" className="rounded-xl border border-temple-border w-full object-cover max-h-64" />
            </div>
            <div className="bento-card p-4 space-y-2">
              <h3 className="font-bold text-lg text-temple-terracotta">{t('pipeline_step2')}</h3>
              <img src={result.binarized_b64} alt="Binarized" className="rounded-xl border border-temple-border w-full object-cover max-h-64" />
            </div>
          </div>

          {/* Final Results */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bento-card p-4 space-y-2">
              <h3 className="font-bold text-lg text-temple-gold flex items-center gap-2">
                {t('pipeline_step3')} <ArrowRight size={16} /> {t('final_translation')}
              </h3>
              <div className="overflow-auto border border-temple-border rounded-xl bg-white/50">
                <canvas ref={canvasRef} className="w-full h-auto" />
              </div>
            </div>

            <div className="bento-card p-6 flex flex-col space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-2">{t('final_translation')}</h3>
                <div className={`p-4 bg-white/60 rounded-xl border border-temple-border min-h-[150px] whitespace-pre-wrap break-words break-all leading-loose text-xl ${i18n.language === 'en' ? 'font-tamilMain' : ''}`}>
                  {result.full_sentence}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-temple-bg p-4 rounded-xl border border-temple-border text-center">
                  <p className="text-3xl font-bold text-temple-teal">{result.word_count}</p>
                  <p className="text-sm font-semibold opacity-70">{t('words_detected')}</p>
                </div>
                <div className="bg-temple-bg p-4 rounded-xl border border-temple-border text-center">
                  <p className="text-3xl font-bold text-temple-terracotta">{result.line_count}</p>
                  <p className="text-sm font-semibold opacity-70">{t('lines_detected')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
