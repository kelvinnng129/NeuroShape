import type { PresetColor, SliderState } from '@/types';

export const PRESET_COLORS: PresetColor[] = [
  { name: 'Spring', c: '#4ade80' },
  { name: 'Cyan',   c: '#22d3ee' },
  { name: 'Violet', c: '#a78bfa' },
  { name: 'Amber',  c: '#fbbf24' },
  { name: 'Rose',   c: '#fb7185' },
  { name: 'Blue',   c: '#60a5fa' },
];

export const DEFAULT_SLIDERS: SliderState = {
  layerCount: 22,
  maxNodes: 30,
  synapseOpacity: 50,
  glowIntensity: 60,
  layerSpacing: 28,
  nodeSpacing: 30,
  nodeColor: '#4ade80',
  lineColor: '#4ade80',
  threshold: 128,
};

export function themeTokens(dark: boolean) {
  return {
    bg:           dark ? 'bg-gray-950'          : 'bg-white',
    bgSoft:       dark ? 'bg-gray-900'          : 'bg-gray-50',
    bgCard:       dark ? 'bg-gray-900'          : 'bg-white',
    border:       dark ? 'border-gray-800'      : 'border-gray-200',
    text:         dark ? 'text-white'           : 'text-gray-900',
    textSoft:     dark ? 'text-gray-400'        : 'text-gray-500',
    textMuted:    dark ? 'text-gray-600'        : 'text-gray-300',
    accentBg:     dark ? 'bg-green-400/10'      : 'bg-green-50',
    accentBorder: dark ? 'border-green-400/30'  : 'border-green-300',
  };
}