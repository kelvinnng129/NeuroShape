'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Brain, Image, Sparkles, Check, X, KeyRound,
} from 'lucide-react';
import { useNS } from './context';
import ThemeToggle from './ThemeToggle';

export default function UploadPage() {
  const {
    dark, t, showPreview, setShowPreview, uploadedImage, setUploadedImage,
    dragOver, setDragOver, handleDrop, handleFileInput,
    tryDemo, startProcessing, fileInputRef, setShowApiKeyModal, customApiKey,
  } = useNS();

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -40 }} transition={{ duration: 0.5 }} className="min-h-screen flex flex-col">
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 py-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <Brain className="w-7 h-7 text-green-400" />
          <span className={`text-lg font-bold tracking-tight ${t.text}`}><span className="text-green-400">Neuro</span>Shape</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowApiKeyModal(true)}
            className={`p-2.5 rounded-xl border ${t.border} ${t.bgCard} transition-all hover:scale-105 ${customApiKey ? 'border-green-400/50' : ''}`}
            title="API key">
            <KeyRound className={`w-4 h-4 ${customApiKey ? 'text-green-400' : t.textSoft}`} />
          </button>
          <ThemeToggle />
        </div>
      </nav>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="text-center mb-10">
          <h1 className={`text-4xl md:text-5xl font-bold ${t.text} mb-4 tracking-tight`}>Shape to <span className="text-green-400">Neural Network</span></h1>
          <p className={`text-base md:text-lg ${t.textSoft} max-w-md mx-auto`}>Upload any image. Our AI isolates the subject and transforms its silhouette into a beautiful neural network diagram.</p>
        </motion.div>

        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {!showPreview ? (
              <motion.div key="drop" exit={{ opacity: 0, scale: 0.95 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`rounded-2xl border-2 border-dashed p-14 text-center transition-all cursor-pointer backdrop-blur-xl ${dragOver ? `${t.accentBorder} ${dark ? 'bg-green-400/10' : 'bg-green-50/90'}` : `${t.border} ${dark ? 'bg-gray-950/60' : 'bg-white/60'} hover:border-green-400`}`}
                >
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}>
                    <div className={`w-16 h-16 rounded-2xl ${t.accentBg} flex items-center justify-center mx-auto mb-5`}>
                      <Upload className="w-7 h-7 text-green-400" />
                    </div>
                  </motion.div>
                  <p className={`text-lg font-semibold ${t.text} mb-1.5`}>Drag & drop your image</p>
                  <p className={`text-sm ${t.textSoft} mb-6`}>PNG, JPG, WEBP — any shape works</p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-green-400 text-gray-900 rounded-xl text-sm font-semibold hover:bg-green-300 transition-all inline-flex items-center gap-2 shadow-lg shadow-green-400/20">
                      <Image className="w-4 h-4" /> Browse Files
                    </button>
                    <button onClick={tryDemo} className={`px-5 py-2.5 rounded-xl text-sm font-medium border ${t.border} ${t.text} hover:border-green-400 transition-all`}>Try Demo</button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border-2 ${t.accentBorder} overflow-hidden backdrop-blur-xl ${dark ? 'bg-gray-950/80' : 'bg-white/80'}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-gray-900" /></div>
                      <span className={`text-sm font-semibold ${t.text}`}>Image Ready</span>
                    </div>
                    <button onClick={() => { setShowPreview(false); setUploadedImage(null); }} className={`text-xs ${t.textSoft} hover:text-red-400 transition flex items-center gap-1`}><X className="w-3 h-3" /> Remove</button>
                  </div>
                  <div className={`rounded-xl overflow-hidden border ${t.border} ${dark ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    <img src={uploadedImage || ''} alt="Preview" className="w-full h-56 object-contain p-3" />
                  </div>
                </div>
                <div className="px-4 pb-4 flex gap-3">
                  <button onClick={() => { setShowPreview(false); setUploadedImage(null); }} className={`flex-1 px-4 py-2.5 rounded-xl border ${t.border} ${t.text} text-sm font-semibold hover:border-red-400 transition`}>Cancel</button>
                  <button onClick={startProcessing} className="flex-1 px-4 py-2.5 bg-green-400 text-gray-900 rounded-xl text-sm font-semibold hover:bg-green-300 transition-all inline-flex items-center justify-center gap-2 shadow-lg shadow-green-400/20">
                    <Sparkles className="w-4 h-4" /> Process Image
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className={`mt-10 flex flex-wrap items-center justify-center gap-8 ${t.textMuted} text-sm`}>
          {['Pyramids', 'Logos', 'Silhouettes', 'Any Object'].map((label, i) => (
            <span key={i} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />{label}</span>
          ))}
        </motion.div>
        <motion.p initial={{ opacity: 0.2 }} animate={{ opacity: 0.5 }} transition={{ delay: 0.9 }} className="mt-4 text-sm text-blue-400 text-center max-w-md mx-auto">
          💡 No API key? No problem — you can still use the service with CLIP-based detection.
        </motion.p>
      </div>

      <footer className={`px-6 py-4 text-center text-xs ${t.textMuted} border-t ${dark ? 'border-gray-800/50' : 'border-gray-200/50'} backdrop-blur-sm relative z-10`}>
        Move mouse to interact · Click to add energy · NeuroShape v1.0 · Press <kbd className="px-1 py-0.5 rounded bg-gray-800/30 text-green-400 font-mono">D</kbd> dark mode
      </footer>
    </motion.div>
  );
}