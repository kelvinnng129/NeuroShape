export interface ProcessingInfo {
  label: string;
  time: number;
  coverage: number;
}

export interface SliderState {
  layerCount: number;
  maxNodes: number;
  synapseOpacity: number;
  glowIntensity: number;
  layerSpacing: number;
  nodeSpacing: number;
  nodeColor: string;
  lineColor: string;
  threshold: number;
}

export type SliderKey = keyof SliderState;

export interface Pos {
  x: number;
  y: number;
}

export interface Geometry {
  positions: Pos[][];
  cW: number;
  cH: number;
  px: number;
  spreadW: number;
}

export interface PresetColor {
  name: string;
  c: string;
}

export interface ThemeTokens {
  bg: string;
  bgSoft: string;
  bgCard: string;
  border: string;
  text: string;
  textSoft: string;
  textMuted: string;
  accentBg: string;
  accentBorder: string;
}