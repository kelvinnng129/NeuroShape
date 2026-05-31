'use client';

import React, { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Download, Sparkles, ChevronLeft, SlidersHorizontal,
  RotateCcw, EyeOff, KeyRound, AlertTriangle, X, Minus, Plus,
  Box, Layers,
} from 'lucide-react';
import { useNS } from './context';
import ThemeToggle from './ThemeToggle';
import Sidebar from './Sidebar';
import NetworkRenderer from './NetworkRenderer';
import ExportModal from './ExportModal';
import type { Node3D, Shape3D } from '@/lib/ai3dLayout';

export default function DesignPage() {
  const {
    dark, t, s, network, processingInfo, modelBadgeText, modelUsed,
    showExport, setShowExport, controlsOpen, setControlsOpen,
    showRefImage, setShowRefImage, uploadedImage,
    showApiKeyModal, setShowApiKeyModal, customApiKey,
    quotaWarning, setQuotaWarning, quotaMessage,
    zoom, panX, panY, setZoom, setPanX, setPanY, resetView,
    animating, resetToUpload,
  } = useNS();

  /* ══════ 3D State ══════ */
  const [is3D, setIs3D] = useState(false);
  const [nodes3D, setNodes3D] = useState<Node3D[][] | null>(null);  // ← FIXED: Node3D[][] not Node3D[]
  const [shape3D, setShape3D] = useState<Shape3D>('3d-sphere');
  const [loading3D, setLoading3D] = useState(false);
  const [error3D, setError3D] = useState<string | null>(null);

  // Lazy-load the 3D renderer to avoid SSR issues with Three.js
  const [NetworkRenderer3D, setNetworkRenderer3D] = useState<React.ComponentType<any> | null>(null);

  const hasApiKey = !!customApiKey;

  /* ══════ Build LAYERED positions from network (Pos[][]) ══════ */
  const buildLayeredPositions = useCallback(() => {
    const layers: { x: number; y: number }[][] = [];
    const totalLayers = network.length;
    const layerSpacing = 600 / Math.max(1, totalLayers - 1);

    network.forEach((count, layerIdx) => {
      const layer: { x: number; y: number }[] = [];
      const nodeSpacing = 500 / Math.max(1, count);
      for (let i = 0; i < count; i++) {
        layer.push({
          x: (i - (count - 1) / 2) * nodeSpacing,
          y: layerIdx * layerSpacing - 300,
        });
      }
      layers.push(layer);
    });

    return layers;
  }, [network]);

  /* ══════ Switch to 3D ══════ */
  const switchTo3D = useCallback(async () => {
    if (!customApiKey) return;
    setLoading3D(true);
    setError3D(null);

    try {
      // Lazy load the 3D renderer
      const mod = await import('./NetworkRenderer3D');
      setNetworkRenderer3D(() => mod.default);

      const layeredPositions = buildLayeredPositions();

      // Try AI-powered layout first
      let layout: Node3D[][] | null = null;

      try {
        const { generate3DLayout } = await import('@/lib/ai3dLayout');
        layout = await generate3DLayout(layeredPositions, shape3D, {
          provider: 'openai',
          apiKey: customApiKey,
          model: 'gpt-4o',
        });
      } catch (aiErr) {
        console.warn('AI 3D failed, using local fallback:', aiErr);
        try {
          const { generateLocal3DLayout } = await import('@/lib/ai3dLayout');
          layout = generateLocal3DLayout(layeredPositions, shape3D);
          setError3D('AI unavailable — used local 3D layout');
        } catch (localErr) {
          console.error('Local 3D fallback also failed:', localErr);
          throw new Error('Could not generate 3D layout');
        }
      }

      if (layout && layout.length > 0) {
        setNodes3D(layout);
        setIs3D(true);
      } else {
        throw new Error('Generated layout was empty');
      }
    } catch (err) {
      setError3D(`Failed to load 3D: ${err instanceof Error ? err.message : err}`);
      setIs3D(false);
      setNodes3D(null);
    } finally {
      setLoading3D(false);
    }
  }, [customApiKey, shape3D, buildLayeredPositions]);

  /* ══════ Switch back to 2D ══════ */
  const switchTo2D = useCallback(() => {
    setIs3D(false);
    setNodes3D(null);
    setError3D(null);
  }, []);

  /* ══════ Zoom / Pan (2D only) ══════ */
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (is3D) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { x: panXRef.current, y: panYRef.current };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [is3D]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPanX(panOrigin.current.x + dx / zoomRef.current);
    setPanY(panOrigin.current.y + dy / zoomRef.current);
  }, [setPanX, setPanY]);

  const onPointerUp = useCallback(() => { isPanning.current = false; }, []);

  /* ══════ Determine if 3D should render ══════ */
  const show3D = is3D && nodes3D !== null && nodes3D.length > 0 && NetworkRenderer3D !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
      className={`min-h-screen ${t.bg} flex flex-col transition-colors duration-300`}>

      {/* ── NAVBAR ── */}
      <nav className={`flex items-center justify-between px-5 py-3 border-b ${t.border} shrink-0`}>
        <div className="flex items-center gap-3">
          <button onClick={resetToUpload} className={`p-2 rounded-lg ${t.bgSoft} ${t.textSoft} hover:text-green-400 transition`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <Brain className="w-5 h-5 text-green-400" />
          <span className={`text-sm font-bold ${t.text}`}>
            <span className="text-green-400">Neuro</span>Shape
          </span>
          <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${t.accentBg} ${t.accentBorder} border ml-1`}>
            <Sparkles className="w-3 h-3 text-green-400" />
            <span className="text-green-400 font-semibold">{processingInfo?.label || 'Neural Form'}</span>
          </div>
          {modelBadgeText && (
            <div className={`hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ml-1 ${
              modelUsed === 'gpt-4o'
                ? dark ? 'bg-blue-400/10 text-blue-400 border border-blue-400/30' : 'bg-blue-50 text-blue-600 border border-blue-200'
                : dark ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30' : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {modelUsed === 'gpt-4o' ? <Brain className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
              <span className="font-medium">{modelBadgeText}</span>
            </div>
          )}
          {show3D && (
            <div className={`hidden sm:flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ml-1 ${
              dark ? 'bg-purple-400/10 text-purple-400 border border-purple-400/30'
                   : 'bg-purple-50 text-purple-600 border border-purple-200'
            }`}>
              <Box className="w-3 h-3" />
              <span className="font-medium">3D Mode</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${t.textMuted} font-mono hidden md:inline`}>
            {network.length}L · {network.reduce((a, b) => a + b, 0)}N
          </span>
          <button onClick={() => setShowApiKeyModal(true)}
            className={`p-2 rounded-lg border ${t.border} ${t.bgCard} transition-all hover:scale-105 ${customApiKey ? 'border-green-400/50' : ''}`}>
            <KeyRound className={`w-3.5 h-3.5 ${customApiKey ? 'text-green-400' : t.textSoft}`} />
          </button>
          <ThemeToggle />
          <button onClick={() => setShowExport(true)}
            className="px-4 py-2 bg-green-400 text-gray-900 rounded-xl text-sm font-semibold hover:bg-green-300 transition-all inline-flex items-center gap-2">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </nav>

      {/* ── QUOTA BANNER ── */}
      <AnimatePresence>
        {quotaWarning && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden shrink-0">
            <div className={`px-5 py-3 flex items-center justify-between gap-3 ${dark ? 'bg-amber-400/10 border-b border-amber-400/20' : 'bg-amber-50 border-b border-amber-200'}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-amber-400/20' : 'bg-amber-100'}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <p className={`text-sm ${dark ? 'text-amber-300' : 'text-amber-700'} truncate`}>{quotaMessage}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setShowApiKeyModal(true)} className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${dark ? 'bg-amber-400 text-gray-900 hover:bg-amber-300' : 'bg-amber-500 text-white hover:bg-amber-400'}`}>
                  Enter API Key
                </button>
                <button onClick={() => setQuotaWarning(false)} className={`p-1 rounded-lg transition ${dark ? 'text-amber-400/60 hover:text-amber-400' : 'text-amber-400 hover:text-amber-600'}`}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3D ERROR BANNER ── */}
      <AnimatePresence>
        {error3D && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden shrink-0">
            <div className={`px-5 py-2 flex items-center justify-between ${dark ? 'bg-orange-400/10 border-b border-orange-400/20' : 'bg-orange-50 border-b border-orange-200'}`}>
              <span className={`text-xs ${dark ? 'text-orange-300' : 'text-orange-600'}`}>{error3D}</span>
              <button onClick={() => setError3D(null)} className={`p-1 ${dark ? 'text-orange-400' : 'text-orange-500'}`}>
                <X className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>{controlsOpen && <Sidebar />}</AnimatePresence>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* ── TOOLBAR ── */}
          
          
          <div className={`flex items-center justify-between px-4 py-2 border-b ${t.border} ${t.bgSoft} shrink-0`}>
            <div className="flex items-center gap-2">
              <button onClick={() => setControlsOpen(!controlsOpen)}
                className={`p-1.5 rounded-lg ${dark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'} border ${t.border} hover:text-green-400 transition`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <span className={`text-xs ${t.textMuted} font-mono`}>
                {controlsOpen ? 'Hide' : 'Show'}{' '}
                <kbd className="px-1 py-0.5 rounded bg-gray-800/20 text-green-400">Space</kbd>
              </span>
            </div>

            

            <div className="flex items-center gap-1.5">
              {!show3D && (
                <>
                  <span className={`text-xs font-mono ${t.textMuted} mr-1`}>{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(5, z + 0.25))}
                    className={`p-1.5 rounded-lg ${t.textSoft} hover:text-green-400 transition`}>
                    <Plus className="w-4 h-4" />
                  </button>
                  <button onClick={() => setZoom(z => Math.max(0.2, z - 0.25))}
                    className={`p-1.5 rounded-lg ${t.textSoft} hover:text-green-400 transition`}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <button onClick={resetView} title="Reset view (R)"
                    className={`p-1.5 rounded-lg ${t.textSoft} hover:text-green-400 transition`}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}

              {animating && !show3D && <span className="text-xs text-green-400 animate-pulse ml-1">● LIVE</span>}

              {/*
              {hasApiKey && (
                <>
                  <div className={`w-px h-5 mx-1.5 ${dark ? 'bg-gray-700' : 'bg-gray-300'}`} />

                  {show3D && (
                    <select
                      value={shape3D}
                      onChange={(e) => setShape3D(e.target.value as Shape3D)}
                      className={`p-1 rounded text-xs mr-1 ${dark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-white text-gray-600 border-gray-300'} border`}
                    >
                      <option value="3d-sphere">🌐 Sphere</option>
                      <option value="3d-brain">🧠 Brain</option>
                      <option value="3d-spiral">🌀 Spiral</option>
                      <option value="3d-tower">🏗️ Tower</option>
                    </select>
                  )}


                  
                 
                
                  <button

                 
                    onClick={show3D ? switchTo2D : switchTo3D}
                    disabled={loading3D}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-semibold
                      inline-flex items-center gap-1.5 transition-all
                      ${loading3D ? 'opacity-50 cursor-wait' : 'hover:scale-105'}
                      ${show3D
                        ? dark
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                          : 'bg-purple-50 text-purple-600 border border-purple-300 hover:bg-purple-100'
                        : dark
                          ? 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-purple-500/50 hover:text-purple-400'
                          : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400 hover:text-purple-600'
                      }
                          


                      
                    `}

                    
                  >
                   
                
                    {loading3D ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : show3D ? (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        Switch to 2D
                      </>
                    ) 
                    
                    
                    : 
                    
                  
                    
                    (

                      <>
                      

                    
                        <Box className="w-3.5 h-3.5" />
                       Switch to 3D  
                      </>
                     
                    )
                    
                      
                      
                    
                    }

                    
                  </button>
                  
             
                    
                  {show3D && (
                    <button
                      onClick={switchTo3D}
                      disabled={loading3D}
                      className={`p-1.5 rounded-lg transition ${dark ? 'text-purple-400 hover:bg-purple-500/20' : 'text-purple-600 hover:bg-purple-50'}`}
                      title="Regenerate 3D layout"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )
                  
                  
                  
                  }
                </>

               
              )}
                */}
              

          
            {/*
              {!hasApiKey && (
                <>
                  <div className={`w-px h-5 mx-1.5 ${dark ? 'bg-gray-700' : 'bg-gray-300'}`} />
                  <button
                    onClick={() => setShowApiKeyModal(true)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 transition
                      ${dark ? 'text-gray-500 hover:text-gray-300 border border-gray-800 hover:border-gray-600'
                             : 'text-gray-400 hover:text-gray-600 border border-gray-200 hover:border-gray-300'}`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    3D
                    <KeyRound className="w-3 h-3 opacity-50" />
                  </button>
                </>
              )}

              */}



            </div>



          </div> 

          

          {/* ── CANVAS AREA ── */}
          <div className="flex-1 flex overflow-hidden">
            <div
              ref={canvasRef}
              className={`flex-1 ${dark ? 'bg-gray-950' : 'bg-white'} relative overflow-hidden transition-colors duration-300`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ cursor: !show3D && isPanning.current ? 'grabbing' : 'default', touchAction: show3D ? 'auto' : 'none' }}
            >
              {/* ══════ 3D MODE ══════ */}
              {show3D ? (
                <NetworkRenderer3D
                  nodes={nodes3D}
                  shape={shape3D}
                  nodeColor={s.nodeColor}
                  lineColor={s.lineColor}
                  dark={dark}
                />
              ) : (
                /* ══════ 2D MODE (default) ══════ */
                <>
                  <div className="absolute inset-0" style={{
                    opacity: 0.04,
                    backgroundImage: dark
                      ? 'radial-gradient(circle,#fff 1px,transparent 1px)'
                      : 'radial-gradient(circle,#000 1px,transparent 1px)',
                    backgroundSize: '32px 32px',
                  }} />

                  <div className="w-full h-full flex items-center justify-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.8 }}
                      className="w-full max-w-2xl mx-auto p-6 relative z-10"
                      style={{
                        transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                        transformOrigin: 'center center',
                        willChange: 'transform',
                      }}
                    >
                      <NetworkRenderer />
                    </motion.div>
                  </div>

                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}
                    className="absolute bottom-4 left-0 right-0 text-center z-10 pointer-events-none">
                    <p className={`text-xs uppercase tracking-widest ${dark ? 'text-gray-600' : 'text-gray-400'} mb-0.5`}>NeuroShape</p>
                    <p className="text-sm font-bold" style={{ color: s.nodeColor }}>
                      {processingInfo?.label || 'Neural Form'}
                    </p>
                  </motion.div>

                  <div className={`absolute top-3 right-3 z-10 text-[10px] ${t.textMuted} space-y-0.5 pointer-events-none`}>
                    <div>Alt+drag → pan</div>
                  </div>
                </>
              )}

              {/* 3D Loading overlay */}
              <AnimatePresence>
                {loading3D && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center"
                    style={{ background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)' }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <p className={`text-sm font-medium ${dark ? 'text-purple-300' : 'text-purple-600'}`}>
                        AI is generating 3D layout...
                      </p>
                      <p className={`text-xs ${t.textMuted}`}>Using your API key</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {showRefImage && uploadedImage && !show3D && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className={`border-l ${t.border} ${t.bgCard} flex flex-col overflow-hidden shrink-0`}>
                  <div className={`p-3 border-b ${t.border} flex items-center justify-between shrink-0`}>
                    <span className={`text-xs font-semibold ${t.textSoft} uppercase tracking-wider`}>Reference</span>
                    <button onClick={() => setShowRefImage(false)} className={`p-1 rounded ${t.textMuted} hover:text-green-400 transition`}>
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-4">
                    <img src={uploadedImage} alt="Reference" className="max-w-full max-h-full object-contain rounded-lg" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ExportModal />
    </motion.div>
  );
}