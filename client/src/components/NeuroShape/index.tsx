'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';

import type { SliderState, ProcessingInfo } from '@/types';
import { DEFAULT_SLIDERS, themeTokens } from '@/lib/constants';
import {
  resampleNetwork, resampleSegments, generateFallback, computeGeometry,
} from '@/lib/network';
import { useHistory } from '@/hooks/useHistory';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import { Ctx } from './context';
import NetworkCanvas from './NetworkCanvas';
import UploadPage from './UploadPage';
import ProcessingPage from './ProcessingPage';
import DesignPage from './DesignPage';
import ApiKeyModal from './ApiKeyModal';

export default function NeuroShape() {
  /* ═══ Page ═══ */
  const [page, setPage] = useState<'upload' | 'processing' | 'design'>('upload');

  /* ═══ Theme ═══ */
  const [dark, setDark] = useState(false);
  const t = useMemo(() => themeTokens(dark), [dark]);

  /* ═══ Upload ═══ */
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ═══ Processing ═══ */
  const [processingStep, setProcessingStep] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [processingInfo, setProcessingInfo] = useState<ProcessingInfo | null>(null);

  /* ═══ API data ═══ */
  const [apiLayers, setApiLayers] = useState<number[] | null>(null);
  const [denseWidths, setDenseWidths] = useState<number[] | null>(null);
  const [denseSegments, setDenseSegments] = useState<number[][][] | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  /* ═══ Sliders (single object) ═══ */
  const [s, setS] = useState<SliderState>(DEFAULT_SLIDERS);
  const set = useCallback(<K extends keyof SliderState>(k: K, v: SliderState[K]) => {
    setS(prev => {
      const next = { ...prev, [k]: v };
      historyRef.current(next);
      return next;
    });
  }, []);

  /* ═══ History (undo/redo) ═══ */
  const { push, undo: histUndo, redo: histRedo, canUndo, canRedo } = useHistory(DEFAULT_SLIDERS);
  const historyRef = useRef(push);
  historyRef.current = push;

  const undo = useCallback(() => { const r = histUndo(); if (r) setS(r); }, [histUndo]);
  const redo = useCallback(() => { const r = histRedo(); if (r) setS(r); }, [histRedo]);

  /* ═══ UI toggles ═══ */
  const [showExport, setShowExport] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [showRefImage, setShowRefImage] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  /* ═══ API key ═══ */
  const [customApiKey, setCustomApiKey] = useState('');
  const [customApiProvider, setCustomApiProvider] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('neuroshape_api_provider') || 'poe';
    return 'poe';
  });
  const [quotaWarning, setQuotaWarning] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState('');
  const [modelUsed, setModelUsed] = useState('');

  /* ═══ Zoom / Pan ═══ */
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const resetView = useCallback(() => { setZoom(1); setPanX(0); setPanY(0); }, []);

  /* ═══ Animation ═══ */
  const [animating, setAnimating] = useState(false);

  /* ═══ Refs ═══ */
  const designFileRef = useRef<HTMLInputElement>(null);
  const nodeColorRef = useRef<HTMLInputElement>(null);
  const lineColorRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ═══ Derived: network + geometry ═══ */
  const layerSegs = useMemo(
    () => denseSegments ? resampleSegments(denseSegments, s.layerCount) : null,
    [denseSegments, s.layerCount],
  );

  const network = useMemo(() => {
    if (layerSegs) {
      return layerSegs.map(segs => {
        if (!segs?.length) return 1;
        const cov = segs.reduce((acc, seg) => acc + (seg[1] - seg[0]), 0);
        return Math.max(1, Math.round(cov * s.maxNodes));
      });
    }
    if (denseWidths) return resampleNetwork(denseWidths, s.layerCount, s.maxNodes);
    return apiLayers || generateFallback(s.layerCount, s.maxNodes);
  }, [layerSegs, denseWidths, apiLayers, s.layerCount, s.maxNodes]);

  const geometry = useMemo(
    () => computeGeometry(network, layerSegs, s.maxNodes, s.nodeSpacing, s.layerSpacing, aspectRatio),
    [network, layerSegs, s.maxNodes, s.nodeSpacing, s.layerSpacing, aspectRatio],
  );

  const modelBadgeText = modelUsed === 'gpt-4o' ? 'GPT-4o' : modelUsed === 'blip' ? 'Basic' : '';

  /* ═══ File handling ═══ */
  const handleFile = useCallback((file: File) => {
    if (!file?.type.startsWith('image/')) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => { setUploadedImage(e.target?.result as string); setShowPreview(true); };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const tryDemo = useCallback(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const cx = c.getContext('2d');
    if (!cx) return;
    cx.fillStyle = dark ? '#111827' : '#f8f9fa'; cx.fillRect(0, 0, 400, 300);
    cx.beginPath(); cx.moveTo(200, 30); cx.lineTo(350, 270); cx.lineTo(50, 270); cx.closePath();
    const g = cx.createLinearGradient(200, 30, 200, 270);
    g.addColorStop(0, '#4ade80'); g.addColorStop(1, '#16a34a');
    cx.fillStyle = g; cx.fill(); cx.strokeStyle = '#22c55e'; cx.lineWidth = 2; cx.stroke();
    const dataUrl = c.toDataURL();
    setUploadedImage(dataUrl);
    const res = await fetch(dataUrl); const blob = await res.blob();
    setUploadedFile(new File([blob], 'demo.png', { type: 'image/png' }));
    setShowPreview(true);
  }, [dark]);

  /* ═══ Processing ═══ */
  const startProcessing = useCallback(async () => {
    setPage('processing'); setProcessingStep(0);
    setApiReady(false); setAnimDone(false);
    setProcessingInfo(null); setQuotaWarning(false); setQuotaMessage(''); setModelUsed('');

    try {
      if (!uploadedFile) { console.error('No file'); return; }
      const fd = new FormData();
      fd.append('file', uploadedFile);
      fd.append('num_layers', s.layerCount.toString());
      fd.append('max_nodes', s.maxNodes.toString());
      fd.append('threshold', s.threshold.toString());
      if (customApiKey) { fd.append('custom_api_key', customApiKey); fd.append('api_provider', customApiProvider); }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kelvinnng129-neuroshape-backend.hf.space';
      const res = await fetch(`${apiUrl}/api/process`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json()).detail || 'fail');

      const data = await res.json();
      setApiLayers(data.layers ?? null);
      if (data.dense_widths) setDenseWidths(data.dense_widths);
      if (data.dense_segments) setDenseSegments(data.dense_segments);
      if (data.aspect_ratio) setAspectRatio(data.aspect_ratio);
      setProcessingInfo({ label: data.label || 'Subject', time: data.processingTime || 0, coverage: data.subjectCoverage || 0 });
      setModelUsed(data.model || '');
      if (data.quota_warning) { setQuotaWarning(true); setQuotaMessage(data.quota_message || 'Quota reached.'); }
      setApiReady(true);
    } catch {
      setApiLayers(null); setDenseWidths(null); setDenseSegments(null); setAspectRatio(null);
      setApiReady(true);
    }
  }, [uploadedFile, s.layerCount, s.maxNodes, s.threshold, customApiKey, customApiProvider]);

  /* processing animation steps */
  useEffect(() => {
    if (page !== 'processing') return;
    if (processingStep < 3) {
      const t = setTimeout(() => setProcessingStep(p => p + 1), 1200);
      return () => clearTimeout(t);
    }
    setAnimDone(true);
  }, [page, processingStep]);

  useEffect(() => {
    if (animDone && apiReady) { const t = setTimeout(() => setPage('design'), 400); return () => clearTimeout(t); }
  }, [animDone, apiReady]);

  /* ═══ Reprocess threshold ═══ */
  const reprocessThreshold = useCallback((newTh: number) => {
    if (!uploadedFile) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const fd = new FormData();
        fd.append('file', uploadedFile); fd.append('num_layers', '200');
        fd.append('max_nodes', s.maxNodes.toString()); fd.append('threshold', newTh.toString());
        if (customApiKey) { fd.append('custom_api_key', customApiKey); fd.append('api_provider', customApiProvider); }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kelvinnng129-neuroshape-backend.hf.space';
        const res = await fetch(`${apiUrl}/api/process`, { method: 'POST', body: fd });
        if (!res.ok) return;
        const data = await res.json();
        if (data.dense_widths) setDenseWidths(data.dense_widths);
        else if (data.layers) { setApiLayers(data.layers); setDenseWidths(null); }
        if (data.dense_segments) setDenseSegments(data.dense_segments);
        if (data.aspect_ratio) setAspectRatio(data.aspect_ratio);
        if (data.model) setModelUsed(data.model);
        if (data.label) setProcessingInfo(prev => prev ? { ...prev, label: data.label } : null);
        if (data.quota_warning) { setQuotaWarning(true); setQuotaMessage(data.quota_message || 'Quota reached.'); }
      } catch (e) { console.error(e); }
    }, 500);
  }, [uploadedFile, s.maxNodes, customApiKey, customApiProvider]);

  /* ═══ Reset ═══ */
  const resetToUpload = useCallback(() => {
    setPage('upload'); setProcessingStep(0); setShowPreview(false);
    setApiLayers(null); setDenseWidths(null); setDenseSegments(null); setAspectRatio(null);
    setUploadedFile(null); setUploadedImage(null); setProcessingInfo(null);
    setS(DEFAULT_SLIDERS); setQuotaWarning(false); setQuotaMessage(''); setModelUsed('');
    resetView();
  }, [resetView]);

  /* ═══ Keyboard shortcuts ═══ */
  useKeyboardShortcuts({
    onUndo: undo,
    onRedo: redo,
    onExport: () => setShowExport(p => !p),
    onControls: () => setControlsOpen(p => !p),
    onDark: () => setDark(p => !p),
    onAnimate: () => setAnimating(p => !p),
    onResetView: resetView,
  }, page === 'design');

  /* ═══ Context value ═══ */
  const ctx = useMemo(() => ({
    page, setPage,
    dark, setDark, t,
    uploadedFile, uploadedImage, setUploadedImage, showPreview, setShowPreview,
    dragOver, setDragOver, handleFile, handleFileInput, handleDrop, tryDemo,
    startProcessing, fileInputRef,
    processingStep, processingInfo,
    s, set,
    showExport, setShowExport, controlsOpen, setControlsOpen,
    showRefImage, setShowRefImage, showApiKeyModal, setShowApiKeyModal,
    customApiKey, setCustomApiKey, customApiProvider, setCustomApiProvider,
    quotaWarning, setQuotaWarning, quotaMessage, modelUsed,
    network, geometry, layerSegs, modelBadgeText,
    zoom, panX, panY, setZoom, setPanX, setPanY, resetView,
    animating, setAnimating,
    undo, redo, canUndo, canRedo,
    designFileRef, nodeColorRef, lineColorRef,
    reprocessThreshold, resetToUpload,
  }), [
    page, dark, t, uploadedFile, uploadedImage, showPreview, dragOver,
    handleFile, handleFileInput, handleDrop, tryDemo, startProcessing,
    processingStep, processingInfo, s, set,
    showExport, controlsOpen, showRefImage, showApiKeyModal,
    customApiKey, customApiProvider, quotaWarning, quotaMessage, modelUsed,
    network, geometry, layerSegs, modelBadgeText,
    zoom, panX, panY, resetView, animating,
    undo, redo, canUndo, canRedo, reprocessThreshold, resetToUpload,
  ]);

  return (
    <Ctx.Provider value={ctx}>
      <div className="relative min-h-screen">
        {page !== 'design' && (
          <div className={`fixed inset-0 z-0 ${t.bg} transition-colors duration-300`}>
            <NetworkCanvas dark={dark} />
          </div>
        )}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {page === 'upload' && <UploadPage key="upload" />}
            {page === 'processing' && <ProcessingPage key="processing" />}
            {page === 'design' && <DesignPage key="design" />}
          </AnimatePresence>
        </div>
        <ApiKeyModal />
      </div>
    </Ctx.Provider>
  );
}
