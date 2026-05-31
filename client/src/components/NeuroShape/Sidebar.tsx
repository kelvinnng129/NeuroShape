'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Palette, Settings2, Move, Crosshair, CircleDot,
  Scan, Image, Upload, EyeOff, Brain, AlertTriangle, Zap,
} from 'lucide-react';
import { PRESET_COLORS } from '@/lib/constants';
import { useNS } from './context';

export default function Sidebar() {
  const {
    dark, t, s, set, processingInfo, modelUsed, modelBadgeText,
    network, uploadedImage, showRefImage, setShowRefImage,
    designFileRef, nodeColorRef, lineColorRef,
    reprocessThreshold, animating, setAnimating,
    canUndo, canRedo, undo, redo,
    s: { lineColor, nodeColor },
  } = useNS();

  /* ── Color picker widget ── */
  const ColorCtrl = ({ label, value, onChange, pickerRef }: {
    label: string; value: string; onChange: (v: string) => void;
    pickerRef: React.RefObject<HTMLInputElement | null>;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm ${t.textSoft}`}>{label}</span>
        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${dark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{value.toUpperCase()}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 rounded-lg overflow-hidden cursor-pointer shrink-0 border" style={{ borderColor: value }}>
          <input ref={pickerRef} type="color" value={value.length === 7 ? value : '#000000'} onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-12 h-12 -top-2 -left-2 cursor-pointer opacity-0" />
          <div className="w-full h-full" style={{ backgroundColor: value }} />
        </div>
        <div className={`flex-1 h-8 rounded-lg border ${t.border} flex items-center px-2 ${dark ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <span className={`text-xs ${t.textMuted} mr-0.5`}>#</span>
          <input type="text" value={value.replace('#', '')}
            onChange={e => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); onChange('#' + v); }}
            className={`w-full bg-transparent text-xs font-mono outline-none ${t.text}`} maxLength={6} />
        </div>
        <button onClick={() => {
          if (typeof window !== 'undefined' && 'EyeDropper' in window) {
            // @ts-ignore
            new window.EyeDropper().open().then((r: any) => onChange(r.sRGBHex)).catch(() => {});
          } else { pickerRef.current?.click(); }
        }} className={`p-1.5 rounded-lg border ${t.border} ${t.textSoft} hover:text-green-400 hover:border-green-400/50 transition shrink-0`} title="Pick color">
          <Crosshair className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  /* ── Slider widget ── */
  const Slider = ({ label, value, onChange, min, max, unit, left, right }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; unit?: string; left?: string; right?: string;
  }) => (
    <div>
      <div className="flex justify-between mb-2">
        <span className={`text-sm ${t.textSoft}`}>{label}</span>
        <span className="text-xs text-green-400 font-mono bg-green-400/10 px-2 py-0.5 rounded">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-green-400"
        style={{ background: dark ? '#1f2937' : '#e5e7eb' }} />
      {left && right && (
        <div className={`flex justify-between text-xs ${t.textMuted} mt-1`}><span>{left}</span><span>{right}</span></div>
      )}
    </div>
  );

  return (
    <motion.aside
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className={`w-72 border-r ${t.border} ${t.bgCard} flex flex-col overflow-y-auto shrink-0`}
    >
      {/* Detection Result */}
      {processingInfo && (
        <div className={`p-5 border-b ${t.border}`}>
          <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-3 flex items-center gap-2`}><Scan className="w-3.5 h-3.5" /> Detection Result</h3>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className={`text-sm font-bold ${t.text}`}>{processingInfo.label}</span>
            {modelBadgeText && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${modelUsed === 'gpt-4o' ? dark ? 'bg-blue-400/10 text-blue-400' : 'bg-blue-50 text-blue-600' : dark ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>via {modelBadgeText}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-lg p-2.5 ${dark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-xs ${t.textMuted} mb-0.5`}>Coverage</p>
              <p className={`text-sm font-bold ${t.text}`}>{(processingInfo.coverage * 100).toFixed(0)}%</p>
            </div>
            <div className={`rounded-lg p-2.5 ${dark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <p className={`text-xs ${t.textMuted} mb-0.5`}>AI Time</p>
              <p className={`text-sm font-bold ${t.text}`}>{processingInfo.time.toFixed(1)}s</p>
            </div>
          </div>
        </div>
      )}

      {/* Animation + Undo/Redo */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-3 flex items-center gap-2`}><Zap className="w-3.5 h-3.5" /> Controls</h3>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm ${t.textSoft}`}>Wave Animation <kbd className="ml-1 text-[10px] px-1 py-0.5 rounded bg-gray-800/30 text-green-400 font-mono">A</kbd></span>
          <button onClick={() => setAnimating(!animating)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${animating ? 'bg-green-400' : dark ? 'bg-gray-700' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${animating ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={undo} disabled={!canUndo}
            className={`flex-1 text-xs py-1.5 rounded-lg border ${t.border} ${canUndo ? `${t.textSoft} hover:text-green-400 hover:border-green-400/50` : `${t.textMuted} opacity-40 cursor-not-allowed`} transition`}>
            ↶ Undo <span className="text-[10px] opacity-60">⌘Z</span>
          </button>
          <button onClick={redo} disabled={!canRedo}
            className={`flex-1 text-xs py-1.5 rounded-lg border ${t.border} ${canRedo ? `${t.textSoft} hover:text-green-400 hover:border-green-400/50` : `${t.textMuted} opacity-40 cursor-not-allowed`} transition`}>
            ↷ Redo <span className="text-[10px] opacity-60">⇧⌘Z</span>
          </button>
        </div>
      </div>

      {/* Geometry */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Layers className="w-3.5 h-3.5" /> Network Geometry</h3>
        <div className="space-y-5">
          <Slider label="Layers" value={s.layerCount} onChange={v => set('layerCount', v)} min={3} max={60} left="Abstract" right="Detailed" />
          <Slider label="Max Nodes" value={s.maxNodes} onChange={v => set('maxNodes', v)} min={3} max={60} left="Sparse" right="Dense" />
        </div>
      </div>

      {/* Spacing */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Move className="w-3.5 h-3.5" /> Spacing</h3>
        <div className="space-y-5">
          <Slider label="Layer Gap" value={s.layerSpacing} onChange={v => set('layerSpacing', v)} min={8} max={60} unit="px" />
          <Slider label="Node Gap" value={s.nodeSpacing} onChange={v => set('nodeSpacing', v)} min={8} max={60} unit="px" />
        </div>
      </div>

      {/* Colors */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Palette className="w-3.5 h-3.5" /> Colors</h3>
        <div className="space-y-5">
          <ColorCtrl label="Node Color" value={s.nodeColor} onChange={v => set('nodeColor', v)} pickerRef={nodeColorRef} />
          <ColorCtrl label="Line Color" value={s.lineColor} onChange={v => set('lineColor', v)} pickerRef={lineColorRef} />
          <div>
            <span className={`text-xs ${t.textMuted} mb-2.5 block`}>Quick Presets <span className="opacity-60">(sets both)</span></span>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((p, i) => (
                <button key={i} onClick={() => { set('nodeColor', p.c); set('lineColor', p.c); }}
                  className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{ backgroundColor: p.c, borderColor: nodeColor === p.c && lineColor === p.c ? (dark ? '#fff' : '#111') : 'transparent' }}
                  title={p.name} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Style */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Settings2 className="w-3.5 h-3.5" /> Visual Style</h3>
        <div className="space-y-5">
          <Slider label="Line Opacity" value={s.synapseOpacity} onChange={v => set('synapseOpacity', v)} min={5} max={100} unit="%" />
          <Slider label="Glow Intensity" value={s.glowIntensity} onChange={v => set('glowIntensity', v)} min={10} max={100} unit="%" />
        </div>
      </div>

      {/* Mask Threshold */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Crosshair className="w-3.5 h-3.5" /> Mask Override</h3>
        <div className="space-y-3">
          <Slider label="Threshold" value={s.threshold} onChange={v => { set('threshold', v); reprocessThreshold(v); }} min={0} max={255} left="More detail" right="Solid only" />
          <p className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'} leading-relaxed`}>Lower = more detail, higher = only solid areas.</p>
        </div>
      </div>

      {/* Reference Image */}
      <div className={`p-5 border-b ${t.border}`}>
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-4 flex items-center gap-2`}><Image className="w-3.5 h-3.5" /> Reference Image</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${t.textSoft}`}>{showRefImage ? 'Visible' : 'Hidden'}</span>
            <button onClick={() => setShowRefImage(!showRefImage)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showRefImage ? 'bg-green-400' : dark ? 'bg-gray-700' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showRefImage ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <button onClick={() => designFileRef.current?.click()}
            className={`w-full text-xs py-2 rounded-lg border ${t.border} ${t.textSoft} hover:text-green-400 hover:border-green-400/50 transition flex items-center justify-center gap-1.5`}>
            <Upload className="w-3 h-3" /> Change Image
          </button>
          <input ref={designFileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { /* handled by parent via context */ }} />
          {uploadedImage && (
            <div className={`rounded-lg overflow-hidden border ${t.border} ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <img src={uploadedImage} alt="" className="w-full h-20 object-contain" />
            </div>
          )}
        </div>
      </div>

      {/* Layer Breakdown */}
      <div className="p-5 flex-1">
        <h3 className={`text-xs uppercase tracking-wider ${t.textMuted} font-semibold mb-3 flex items-center gap-2`}><CircleDot className="w-3.5 h-3.5" /> Layer Breakdown</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {network.map((count, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`${t.textMuted} w-4 text-right font-mono`}>{i + 1}</span>
              <div className={`flex-1 ${dark ? 'bg-gray-800' : 'bg-gray-100'} rounded-full h-1.5 overflow-hidden`}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(count / Math.max(...network)) * 100}%` }}
                  className="h-full rounded-full" style={{ backgroundColor: lineColor, opacity: 0.7 }} />
              </div>
              <span className={`${t.textMuted} w-4 font-mono`}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}