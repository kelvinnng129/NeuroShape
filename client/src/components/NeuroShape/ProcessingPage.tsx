'use client';

import { motion } from 'framer-motion';
import { Brain, Scan, Eye, Layers, Sparkles, Check, Loader2 } from 'lucide-react';
import { useNS } from './context';

export default function ProcessingPage() {
  const { dark, t, processingStep, processingInfo, uploadedImage } = useNS();

  const steps = [
    { icon: Scan, label: 'Analyzing image...', sub: 'Running AI segmentation model' },
    { icon: Eye, label: processingInfo ? `Detected: ${processingInfo.label}` : 'Detecting subject...', sub: processingInfo ? `Coverage: ${(processingInfo.coverage * 100).toFixed(0)}%` : 'Confidence: analyzing...' },
    { icon: Layers, label: 'Generating mask...', sub: 'Isolating subject from background' },
    { icon: Sparkles, label: 'Building neural map', sub: 'Mapping density across layers' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center mb-8">
        <div className="relative inline-block mb-6">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
            className="w-20 h-20 rounded-full border-2 border-green-400/20 border-t-green-400 mx-auto" />
          <Brain className="w-8 h-8 text-green-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className={`text-2xl font-bold ${t.text} mb-2`}>Processing Your Image</h2>
        <p className={`${t.textSoft} text-sm`}>AI is analyzing the subject...</p>
      </motion.div>

      {uploadedImage && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className={`mb-8 rounded-xl overflow-hidden border ${t.border} shadow-lg ${dark ? 'bg-gray-900' : 'bg-white'}`}>
          <img src={uploadedImage} alt="" className="w-36 h-28 object-contain p-2" />
        </motion.div>
      )}

      <div className="w-full max-w-sm space-y-3">
        {steps.map((step, i) => (
          <motion.div key={i} initial={{ x: -30, opacity: 0 }}
            animate={i <= processingStep ? { x: 0, opacity: 1 } : { x: -30, opacity: 0 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            className={`flex items-center gap-4 p-3.5 rounded-xl border backdrop-blur-xl transition-all ${
              i < processingStep ? `${t.accentBg} ${t.accentBorder}`
              : i === processingStep ? `${dark ? 'bg-gray-900/80' : 'bg-white/80'} ${t.border} shadow-lg`
              : `${dark ? 'bg-gray-900/40' : 'bg-gray-50/40'} ${t.border} opacity-40`
            }`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              i < processingStep ? 'bg-green-400' : i === processingStep ? t.accentBg : t.bgSoft
            }`}>
              {i < processingStep ? <Check className="w-4 h-4 text-gray-900" />
              : i === processingStep ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Loader2 className="w-4 h-4 text-green-400" /></motion.div>
              : <step.icon className={`w-4 h-4 ${t.textMuted}`} />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${i <= processingStep ? t.text : t.textMuted}`}>{step.label}</p>
              <p className={`text-xs ${i <= processingStep ? t.textSoft : t.textMuted}`}>{step.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="w-full max-w-sm mt-10">
        <motion.div initial={{ width: '0%' }} animate={{ width: `${((processingStep + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.8 }} className="h-1 bg-green-400 rounded-full" />
      </div>
    </motion.div>
  );
}