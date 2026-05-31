'use client';

import React, { createContext, useContext } from 'react';
import type {
  SliderState, ProcessingInfo, Geometry, ThemeTokens, Pos,
} from '@/types';

export interface NeuroCtx {
  /* page */
  page: 'upload' | 'processing' | 'design';
  setPage: (p: 'upload' | 'processing' | 'design') => void;

  /* theme */
  dark: boolean;
  setDark: React.Dispatch<React.SetStateAction<boolean>>;
  t: ThemeTokens;

  /* upload */
  uploadedFile: File | null;
  uploadedImage: string | null;
  setUploadedImage: (v: string | null) => void;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleFile: (f: File) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  tryDemo: () => void;
  startProcessing: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  /* processing */
  processingStep: number;
  processingInfo: ProcessingInfo | null;

  /* sliders */
  s: SliderState;
  set: <K extends keyof SliderState>(k: K, v: SliderState[K]) => void;

  /* modals / panels */
  showExport: boolean;       setShowExport: (v: boolean) => void;
  controlsOpen: boolean;     setControlsOpen: (v: boolean) => void;
  showRefImage: boolean;     setShowRefImage: (v: boolean) => void;
  showApiKeyModal: boolean;  setShowApiKeyModal: (v: boolean) => void;

  /* API */
  customApiKey: string;        setCustomApiKey: (v: string) => void;
  customApiProvider: string;   setCustomApiProvider: (v: string) => void;
  quotaWarning: boolean;       setQuotaWarning: (v: boolean) => void;
  quotaMessage: string;
  modelUsed: string;

  /* derived */
  network: number[];
  geometry: Geometry;
  layerSegs: number[][][] | null;
  modelBadgeText: string;

  /* zoom / pan */
  zoom: number;
  panX: number;
  panY: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPanX: React.Dispatch<React.SetStateAction<number>>;
  setPanY: React.Dispatch<React.SetStateAction<number>>;
  resetView: () => void;

  /* animation */
  animating: boolean;
  setAnimating: React.Dispatch<React.SetStateAction<boolean>>;

  /* undo / redo */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /* refs */
  designFileRef: React.RefObject<HTMLInputElement | null>;
  nodeColorRef: React.RefObject<HTMLInputElement | null>;
  lineColorRef: React.RefObject<HTMLInputElement | null>;

  /* misc */
  reprocessThreshold: (t: number) => void;
  resetToUpload: () => void;
}

export const Ctx = createContext<NeuroCtx | null>(null);

export function useNS(): NeuroCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNS must be inside NeuroShapeProvider');
  return c;
}