'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Node3D, Shape3D } from '@/lib/ai3dLayout';
import { useNS } from './context';

/* ═══════════════════════════════════════════
   Props
   ═══════════════════════════════════════════ */

interface NetworkRenderer3DProps {
  nodes: Node3D[][] | null;
  shape: Shape3D;
  nodeColor: string;
  lineColor: string;
  dark: boolean;
}

/* ═══════════════════════════════════════════
   Node Sphere
   ═══════════════════════════════════════════ */

function NodeSphere({
  position,
  color,
  size,
  pulsePhase,
  animating,
}: {
  position: [number, number, number];
  color: string;
  size: number;
  pulsePhase: number;
  animating: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current || !animating) return;
    const t = state.clock.getElapsedTime();
    const pulse = 0.8 + 0.4 * Math.sin(t * 2 + pulsePhase);
    meshRef.current.scale.setScalar(pulse);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2 + pulsePhase);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.4}
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════
   Layered Connections (K-nearest between layers)
   ═══════════════════════════════════════════ */

function LayeredConnections({
  layers,
  color,
  opacity,
}: {
  layers: Node3D[][];
  color: string;
  opacity: number;
}) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];
    const K = 4;

    // Inter-layer connections
    for (let li = 0; li < layers.length - 1; li++) {
      const curr = layers[li];
      const next = layers[li + 1];
      if (!curr || !next) continue;

      for (const node of curr) {
        const sorted = next
          .map((target, idx) => {
            const dx = target.x - node.x;
            const dy = target.y - node.y;
            const dz = target.z - node.z;
            return { idx, dist: Math.sqrt(dx * dx + dy * dy + dz * dz) };
          })
          .sort((a, b) => a.dist - b.dist)
          .slice(0, K);

        for (const s of sorted) {
          const t = next[s.idx];
          if (!t) continue;
          vertices.push(node.x, node.y, node.z);
          vertices.push(t.x, t.y, t.z);
        }
      }
    }

    // Intra-layer connections (adjacent)
    for (const layer of layers) {
      if (!layer) continue;
      for (let i = 0; i < layer.length - 1; i++) {
        const a = layer[i];
        const b = layer[i + 1];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 3) {
          vertices.push(a.x, a.y, a.z);
          vertices.push(b.x, b.y, b.z);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    if (vertices.length > 0) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    }
    return geo;
  }, [layers]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
}

/* ═══════════════════════════════════════════
   Outline Edges
   ═══════════════════════════════════════════ */

function OutlineEdges({
  layers,
  color,
}: {
  layers: Node3D[][];
  color: string;
}) {
  const geometry = useMemo(() => {
    const vertices: number[] = [];

    for (let li = 0; li < layers.length - 1; li++) {
      const curr = layers[li];
      const next = layers[li + 1];
      if (!curr?.length || !next?.length) continue;

      // First nodes
      vertices.push(curr[0].x, curr[0].y, curr[0].z);
      vertices.push(next[0].x, next[0].y, next[0].z);

      // Last nodes
      const cLast = curr[curr.length - 1];
      const nLast = next[next.length - 1];
      vertices.push(cLast.x, cLast.y, cLast.z);
      vertices.push(nLast.x, nLast.y, nLast.z);
    }

    const geo = new THREE.BufferGeometry();
    if (vertices.length > 0) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    }
    return geo;
  }, [layers]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.4} />
    </lineSegments>
  );
}

/* ═══════════════════════════════════════════
   Glow Sprites
   ═══════════════════════════════════════════ */

function GlowSprites({
  flatNodes,
  color,
  glowSize,
}: {
  flatNodes: Node3D[];
  color: string;
  glowSize: number;
}) {
  const texture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <>
      {flatNodes.map((node, i) => (
        <sprite key={`glow-${i}`} position={[node.x, node.y, node.z]} scale={[glowSize, glowSize, 1]}>
          <spriteMaterial
            map={texture}
            color={color}
            transparent
            opacity={0.35}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════
   Auto-rotating group
   ═══════════════════════════════════════════ */

function AutoRotateGroup({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.08;
  });
  return <group ref={ref}>{children}</group>;
}

/* ═══════════════════════════════════════════
   Camera auto-fit
   ═══════════════════════════════════════════ */

function CameraFit({ flatNodes }: { flatNodes: Node3D[] }) {
  const { camera } = useThree();

  useMemo(() => {
    if (flatNodes.length === 0) return;
    let maxDist = 0;
    for (const n of flatNodes) {
      const d = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
      if (d > maxDist) maxDist = d;
    }
    const distance = Math.max(maxDist * 2.5, 8);
    camera.position.set(distance * 0.6, distance * 0.4, distance * 0.8);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [flatNodes, camera]);

  return null;
}

/* ═══════════════════════════════════════════
   Scene (inside Canvas)
   ═══════════════════════════════════════════ */

function Scene({
  layers,
  flatNodes,
  nodeColor,
  lineColor,
  dark,
  animating,
  glowIntensity,
  synapseOpacity,
}: {
  layers: Node3D[][];
  flatNodes: Node3D[];
  nodeColor: string;
  lineColor: string;
  dark: boolean;
  animating: boolean;
  glowIntensity: number;
  synapseOpacity: number;
}) {
  const totalNodes = flatNodes.length;
  const nodeSize = Math.max(0.04, 0.12 - totalNodes * 0.00015);
  const lineOpacity = Math.min(synapseOpacity / 100, 0.4);
  const glowSize = 0.15 + glowIntensity / 300;

  return (
    <>
      <CameraFit flatNodes={flatNodes} />

      <ambientLight intensity={dark ? 0.3 : 0.5} />
      <pointLight position={[10, 10, 10]} intensity={dark ? 1.2 : 0.8} />
      <pointLight position={[-8, -5, -8]} intensity={0.4} color={nodeColor} />
      <pointLight position={[0, 8, -5]} intensity={0.3} color={lineColor} />

      <AutoRotateGroup>
        <LayeredConnections layers={layers} color={lineColor} opacity={lineOpacity} />
        <OutlineEdges layers={layers} color={lineColor} />

        {glowIntensity > 5 && (
          <GlowSprites flatNodes={flatNodes} color={nodeColor} glowSize={glowSize} />
        )}

        {flatNodes.map((node, i) => (
          <NodeSphere
            key={`n-${i}`}
            position={[node.x, node.y, node.z]}
            color={nodeColor}
            size={nodeSize}
            pulsePhase={(i / Math.max(1, totalNodes)) * Math.PI * 2}
            animating={animating}
          />
        ))}
      </AutoRotateGroup>

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        enableZoom
        enablePan
        minDistance={3}
        maxDistance={60}
      />
    </>
  );
}

/* ═══════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════ */

export default function NetworkRenderer3D({
  nodes,
  shape,
  nodeColor,
  lineColor,
  dark,
}: NetworkRenderer3DProps) {
  const { s, animating, network } = useNS();

  // ── Safety: if nodes is null/empty, show fallback ──
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">🌐</span>
          <p className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            No 3D data available
          </p>
        </div>
      </div>
    );
  }

  // ── Flatten for node rendering, keep layers for connections ──
  const layers: Node3D[][] = nodes;
  const flatNodes: Node3D[] = nodes.flat();
  const totalNodes = flatNodes.length;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [8, 5, 8], fov: 45, near: 0.1, far: 200 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <Scene
          layers={layers}
          flatNodes={flatNodes}
          nodeColor={nodeColor || s.nodeColor}
          lineColor={lineColor || s.lineColor}
          dark={dark}
          animating={animating}
          glowIntensity={s.glowIntensity}
          synapseOpacity={s.synapseOpacity}
        />
      </Canvas>

      {/* Bottom-left badge */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className={`px-3 py-1.5 rounded-lg text-xs font-mono backdrop-blur-sm ${
          dark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
               : 'bg-purple-50/80 text-purple-600 border border-purple-200'
        }`}>
          🌐 3D · {network.length} layers · {totalNodes} nodes
        </div>
      </div>

      {/* Bottom-right hints */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
        <div className={`px-3 py-1.5 rounded-lg text-[10px] font-mono backdrop-blur-sm space-y-0.5 ${
          dark ? 'bg-gray-900/60 text-gray-500 border border-gray-800'
               : 'bg-white/60 text-gray-400 border border-gray-200'
        }`}>
          <div>🖱️ Drag → rotate</div>
          <div>⚡ Scroll → zoom</div>
          <div>🤚 Right-drag → pan</div>
        </div>
      </div>

      {/* Shape badge */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
          dark ? 'bg-gray-900/60 text-green-400 border border-green-500/20'
               : 'bg-white/60 text-green-600 border border-green-200'
        }`}>
          {shape === '3d-sphere' && '🌐 Sphere'}
          {shape === '3d-brain' && '🧠 Brain'}
          {shape === '3d-spiral' && '🌀 Spiral'}
          {shape === '3d-tower' && '🏗️ Tower'}
          {shape === '3d-custom' && '✨ Custom'}
        </div>
      </div>
    </div>
  );
}