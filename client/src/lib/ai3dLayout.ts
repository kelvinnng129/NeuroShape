import type { Pos } from '@/types';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export type Shape3D = '3d-brain' | '3d-spiral' | '3d-sphere' | '3d-tower' | '3d-custom';

export interface Node3D {
  x: number;
  y: number;
  z: number;
}

export interface AI3DConfig {
  provider: 'openai' | 'anthropic';
  apiKey: string;
  model: string;
}

/* ═══════════════════════════════════════════
   AI-Powered 3D Layout (uses user's API key)
   ═══════════════════════════════════════════ */

export async function generate3DLayout(
  positions: Pos[][],
  shape: Shape3D,
  config: AI3DConfig,
  customPrompt?: string,
): Promise<Node3D[][]> {
  const structure = positions.map((layer, i) => ({
    layer: i,
    nodeCount: layer.length,
    samplePositions: layer.slice(0, 5).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    bounds: {
      minX: Math.round(Math.min(...layer.map(n => n.x))),
      maxX: Math.round(Math.max(...layer.map(n => n.x))),
      minY: Math.round(Math.min(...layer.map(n => n.y))),
      maxY: Math.round(Math.max(...layer.map(n => n.y))),
    },
  }));

  const systemPrompt = `You are a 3D layout engine for neural network visualizations.
Given a description of 2D node layers, generate 3D coordinates that form the requested shape.

Rules:
- Output ONLY valid JSON: an array of arrays of {x, y, z} objects
- Each inner array = one layer, preserving the original node count
- Coordinates should be normalized to range [-5, 5] on each axis
- The shape should look beautiful when viewed from any angle in a 3D viewer
- Maintain relative positions within each layer but transform them into the 3D shape
- For "3d-brain": create a brain-like structure with two hemispheres and cortical folds
- For "3d-spiral": arrange layers along a helical/spiral path
- For "3d-sphere": distribute nodes on/near a spherical shell, layers at different latitudes
- For "3d-tower": stack layers as horizontal discs with spacing, like a skyscraper
- For "3d-custom": use the additional instructions to determine shape`;

  const userPrompt = `Neural network structure:
${JSON.stringify(structure, null, 2)}

Requested 3D shape: ${shape}
${customPrompt ? `\nAdditional instructions: ${customPrompt}` : ''}

For each layer, generate exactly the specified nodeCount of 3D points.
Layer node counts: [${positions.map(l => l.length).join(', ')}]

Respond with ONLY the JSON array. No markdown, no explanation.`;

  let responseText: string;

  if (config.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseText = data.choices[0].message.content;

  } else if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    responseText = data.content[0].text;
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  const cleaned = responseText
    .replace(/```json?\n?/g, '')
    .replace(/```/g, '')
    .trim();

  const result: Node3D[][] = JSON.parse(cleaned);

  if (!Array.isArray(result) || result.length !== positions.length) {
    throw new Error(`AI returned ${result?.length} layers, expected ${positions.length}`);
  }

  result.forEach((layer, i) => {
    if (layer.length !== positions[i].length) {
      throw new Error(`Layer ${i}: AI returned ${layer.length} nodes, expected ${positions[i].length}`);
    }
  });

  return result;
}

/* ═══════════════════════════════════════════
   Local Fallback 3D Layout (no API needed)
   Generates deterministic 3D coords using math
   ═══════════════════════════════════════════ */

export function generateLocal3DLayout(
  positions: Pos[][],
  shape: Shape3D,
): Node3D[][] {
  const totalLayers = positions.length;

  return positions.map((layer, li) => {
    const layerT = totalLayers > 1 ? li / (totalLayers - 1) : 0.5; // 0..1

    return layer.map((node, ni) => {
      const nodeT = layer.length > 1 ? ni / (layer.length - 1) : 0.5; // 0..1

      // Normalize the 2D position to [-1, 1] range
      const allX = layer.map(n => n.x);
      const allY = layer.map(n => n.y);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const nx = ((node.x - minX) / rangeX) * 2 - 1; // -1..1
      const ny = ((node.y - minY) / rangeY) * 2 - 1; // -1..1

      let x = 0, y = 0, z = 0;

      switch (shape) {
        case '3d-sphere': {
          // Map each layer to a latitude ring on a sphere
          const phi = Math.PI * layerT;             // 0..π  (top to bottom)
          const theta = Math.PI * 2 * nodeT;        // 0..2π (around)
          const r = 4;
          // Slightly randomize radius based on node position
          const rr = r * (0.85 + 0.3 * Math.abs(nx));
          x = rr * Math.sin(phi) * Math.cos(theta);
          y = rr * Math.cos(phi);
          z = rr * Math.sin(phi) * Math.sin(theta);
          break;
        }

        case '3d-brain': {
          // Two hemisphere lobes with cortical folds
          const hemisphere = nx < 0 ? -1 : 1;
          const foldFreq = 3 + li * 0.5;
          const fold = Math.sin(nodeT * Math.PI * foldFreq) * 0.4;

          x = hemisphere * (1.5 + Math.abs(nx) * 2 + fold * 0.5);
          y = (layerT - 0.5) * 6; // layers spread vertically
          z = ny * 2.5 + Math.cos(nodeT * Math.PI * foldFreq * 0.7) * 0.6;

          // Round the overall shape
          const dist = Math.sqrt(x * x + z * z);
          const maxDist = 4;
          if (dist > maxDist) {
            x *= maxDist / dist;
            z *= maxDist / dist;
          }
          // Slight vertical curvature (brain is oval-shaped)
          const verticalBulge = 1 - Math.pow(layerT - 0.5, 2) * 2;
          x *= verticalBulge * 0.6 + 0.6;
          z *= verticalBulge * 0.6 + 0.6;
          break;
        }

        case '3d-spiral': {
          // Nodes spiral upward in a helix
          const globalIdx = positions.slice(0, li).reduce((sum, l) => sum + l.length, 0) + ni;
          const totalNodes = positions.reduce((sum, l) => sum + l.length, 0);
          const gt = globalIdx / Math.max(1, totalNodes - 1); // 0..1

          const turns = 4;
          const angle = gt * Math.PI * 2 * turns;
          const radius = 2.5 + nodeT * 1.5; // slight variation in radius per node

          x = radius * Math.cos(angle);
          y = (gt - 0.5) * 8; // -4..4 height
          z = radius * Math.sin(angle);
          break;
        }

        case '3d-tower': {
          // Stacked horizontal discs
          const discY = (layerT - 0.5) * 8; // layers are discs
          // Arrange nodes in a circle/grid within each disc
          if (layer.length <= 1) {
            x = 0;
            z = 0;
          } else {
            // Arrange in concentric rings
            const ringAngle = nodeT * Math.PI * 2;
            const rings = Math.ceil(Math.sqrt(layer.length));
            const ringIdx = Math.floor(ni / Math.max(1, Math.ceil(layer.length / rings)));
            const ringRadius = 0.8 + (ringIdx / Math.max(1, rings - 1)) * 2.5;
            x = ringRadius * Math.cos(ringAngle);
            z = ringRadius * Math.sin(ringAngle);
          }
          y = discY;

          // Taper: layers in the middle are wider
          const taper = 0.6 + 0.4 * Math.sin(layerT * Math.PI);
          x *= taper;
          z *= taper;
          break;
        }

        case '3d-custom':
        default: {
          // Default: project 2D layout with slight Z depth per layer
          x = nx * 4;
          y = ny * 4;
          z = (layerT - 0.5) * 6;
          break;
        }
      }

      return {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z: Math.round(z * 100) / 100,
      };
    });
  });
}