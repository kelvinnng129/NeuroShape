import type { Pos, Geometry } from '@/types';

/* ── Resample dense_widths to N layers ── */
export function resampleNetwork(dense: number[], layers: number, maxN: number): number[] {
  if (!dense.length) return [1];
  if (layers <= 1) return [Math.max(1, maxN)];
  const step = (dense.length - 1) / (layers - 1);
  const sampled: number[] = [];
  for (let i = 0; i < layers; i++) {
    const idx = Math.min(Math.round(i * step), dense.length - 1);
    sampled.push(dense[idx]);
  }
  const maxW = Math.max(...sampled) || 1;
  return sampled.map(w => Math.max(1, Math.round((w / maxW) * maxN)));
}

/* ── Resample segments to N layers ── */
export function resampleSegments(dense: number[][][], layers: number): number[][][] {
  if (!dense.length) return [[[0.3, 0.7]]];
  const result: number[][][] = [];
  const step = (dense.length - 1) / Math.max(1, layers - 1);
  for (let i = 0; i < layers; i++) {
    const idx = Math.min(Math.round(i * step), dense.length - 1);
    result.push(dense[idx]);
  }
  return result;
}

/* ── Fallback bottle-like silhouette ── */
export function generateFallback(layerCount: number, maxNodes: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < layerCount; i++) {
    const t = layerCount > 1 ? i / (layerCount - 1) : 0.5;
    let w: number;
    if (t < 0.08) w = maxNodes * 0.15;
    else if (t < 0.25) w = maxNodes * 0.18;
    else if (t < 0.35) { const s = (t - 0.25) / 0.1; w = maxNodes * (0.18 + s * 0.62); }
    else if (t < 0.85) w = maxNodes * (0.78 + Math.sin((t - 0.35) * Math.PI / 0.5) * 0.22);
    else w = maxNodes * 0.85;
    result.push(Math.max(1, Math.round(w)));
  }
  return result;
}

/* ── Compute x/y positions for every node ── */
export function computeGeometry(
  network: number[],
  layerSegs: number[][][] | null,
  maxNodes: number,
  nodeSpacing: number,
  layerSpacing: number,
  aspectRatio: number | null,
): Geometry {
  const py = 28, px = 28;
  const spreadW = maxNodes * nodeSpacing;
  const cW = Math.max(200, px * 2 + spreadW + 20);

  let eff = layerSpacing;
  if (aspectRatio && network.length > 1 && spreadW > 0) {
    const ideal = spreadW * aspectRatio;
    const base = ideal / (network.length - 1);
    eff = Math.max(4, base * (layerSpacing / 28));
  }

  const cH = py * 2 + Math.max(0, network.length - 1) * eff;

  const positions: Pos[][] = network.map((count, li) => {
    const y = py + li * eff;

    if (layerSegs?.[li]?.length) {
      const segs = layerSegs[li];
      const totalCov = segs.reduce((s, seg) => s + (seg[1] - seg[0]), 0);
      if (totalCov <= 0) return [{ x: cW / 2, y }];
      const totalN = Math.max(1, Math.round(totalCov * maxNodes));
      const nodes: Pos[] = [];
      for (const seg of segs) {
        const segW = seg[1] - seg[0];
        const segN = Math.max(1, Math.round((segW / totalCov) * totalN));
        for (let j = 0; j < segN; j++) {
          const t = segN > 1 ? j / (segN - 1) : 0.5;
          nodes.push({ x: px + (seg[0] + t * segW) * spreadW, y });
        }
      }
      return nodes;
    }

    const tw = (count - 1) * nodeSpacing;
    const sx = cW / 2 - tw / 2;
    return Array.from({ length: count }, (_, ni) => ({
      x: count > 1 ? sx + ni * nodeSpacing : cW / 2,
      y,
    }));
  });

  return { positions, cW, cH, px, spreadW };
}