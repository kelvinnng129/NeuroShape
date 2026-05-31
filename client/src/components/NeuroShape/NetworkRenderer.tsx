'use client';

import React, { useMemo } from 'react';
import { useNS } from './context';

export default function NetworkRenderer() {
  const { geometry, network, s, dark, animating } = useNS();

  const svg = useMemo(() => {
    const { positions, cW, cH, spreadW } = geometry;
    const K = 5;
    const baseOp = s.synapseOpacity / (dark ? 180 : 120);
    const glowR = s.glowIntensity / 6 + 3;
    const nodeR = Math.max(2.2, 4.5 - network.length * 0.035);
    const nCol = s.nodeColor;
    const lCol = s.lineColor;
    const totalLayers = network.length;

    return (
      <svg id="network-svg" viewBox={`0 0 ${cW} ${cH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <style>{`
            @keyframes neuralPulse {
              0%, 100% { opacity: 0.25; }
              50% { opacity: 1; }
            }
          `}</style>
          <radialGradient id="nodeSphere" cx="38%" cy="30%" r="62%" fx="38%" fy="30%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="22%" stopColor={nCol} stopOpacity="0.95" />
            <stop offset="65%" stopColor={nCol} stopOpacity="0.65" />
            <stop offset="100%" stopColor={nCol} stopOpacity="0.18" />
          </radialGradient>
          <radialGradient id="nodeGlow">
            <stop offset="0%" stopColor={nCol} stopOpacity={dark ? 0.38 : 0.28} />
            <stop offset="100%" stopColor={nCol} stopOpacity="0" />
          </radialGradient>
          <filter id="fGlow">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.8" stdDeviation="1.2" floodColor="#000" floodOpacity={dark ? 0.4 : 0.18} />
          </filter>
        </defs>

        {positions.map((layer, li) => {
          if (li >= positions.length - 1 || !layer.length) return null;
          const next = positions[li + 1];
          if (!next.length) return null;
          const op = Math.min(baseOp * 5, 0.6);
          return (
            <g key={`o-${li}`}>
              <line x1={layer[0].x} y1={layer[0].y} x2={next[0].x} y2={next[0].y}
                stroke={lCol} strokeOpacity={op} strokeWidth="0.9" filter="url(#fGlow)" />
              <line x1={layer[layer.length - 1].x} y1={layer[layer.length - 1].y}
                x2={next[next.length - 1].x} y2={next[next.length - 1].y}
                stroke={lCol} strokeOpacity={op} strokeWidth="0.9" filter="url(#fGlow)" />
            </g>
          );
        })}

        {positions.map((layer, li) =>
          layer.length > 1 ? (
            <g key={`intra-${li}`}>
              {layer.map((node, ni) => {
                if (ni >= layer.length - 1) return null;
                const nx = layer[ni + 1];
                const gap = Math.abs(nx.x - node.x);
                const op = Math.max(0, baseOp * 1.8 * (1 - gap / (spreadW * 0.15)));
                if (op < 0.01) return null;
                return <line key={`il-${li}-${ni}`} x1={node.x} y1={node.y} x2={nx.x} y2={nx.y}
                  stroke={lCol} strokeOpacity={op} strokeWidth="0.35" />;
              })}
            </g>
          ) : null
        )}

        {positions.map((layer, li) => {
          if (li >= positions.length - 1) return null;
          const next = positions[li + 1];
          if (!next.length) return null;
          return (
            <g key={`c-${li}`}>
              {layer.map((node, ni) => {
                const sorted = next
                  .map((nx, idx) => ({ ...nx, dist: Math.abs(nx.x - node.x), idx }))
                  .sort((a, b) => a.dist - b.dist);
                return sorted.slice(0, K).map((tgt, ti) => {
                  const distFade = Math.max(0, 1 - tgt.dist / (cW * 0.22));
                  const rankFade = 1 - ti * 0.18;
                  const op = baseOp * distFade * rankFade * 2.5;
                  if (op < 0.008) return null;
                  const mx = (node.x + tgt.x) / 2;
                  const my = (node.y + tgt.y) / 2;
                  const curveOff = (tgt.x - node.x) * 0.12;
                  return (
                    <path key={`p-${li}-${ni}-${ti}`}
                      d={`M ${node.x} ${node.y} Q ${mx + curveOff} ${my} ${tgt.x} ${tgt.y}`}
                      fill="none" stroke={lCol} strokeOpacity={op} strokeWidth="0.45" />
                  );
                });
              })}
            </g>
          );
        })}

        {positions.map((layer, li) =>
          layer.map((node, ni) => {
            const t2 = layer.length > 1 ? ni / (layer.length - 1) : 0.5;
            const edgeness = 2 * Math.abs(t2 - 0.5);
            const scale = 0.82 + edgeness * 0.28;
            const r = nodeR * scale;
            const gr = glowR * scale;
            const animStyle = animating ? {
              animation: 'neuralPulse 3s ease-in-out infinite',
              animationDelay: `${(li / totalLayers) * 3}s`,
            } : undefined;
            return (
              <g key={`n-${li}-${ni}`} style={animStyle}>
                <circle cx={node.x} cy={node.y} r={gr * 1.6} fill="url(#nodeGlow)" />
                <circle cx={node.x} cy={node.y} r={r} fill="url(#nodeSphere)" filter="url(#nShadow)" opacity={dark ? 0.95 : 0.9} />
                <circle cx={node.x - r * 0.22} cy={node.y - r * 0.28} r={r * 0.28} fill="#fff" fillOpacity={dark ? 0.55 : 0.4} />
              </g>
            );
          })
        )}
      </svg>
    );
  }, [geometry, network, s.synapseOpacity, s.glowIntensity, s.nodeColor, s.lineColor, dark, animating]);

  return svg;
}