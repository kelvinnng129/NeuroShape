'use client';

import type { Pos } from '@/types';

export async function downloadGLTF(
  positions: Pos[][],
  nodeColor: string,
  lineColor: string,
  K = 5,
  filename = 'neuroshape',
): Promise<boolean> {
  try {
    const THREE = await import('three').catch(() => null);
    if (!THREE) {
      alert('Three.js is not installed.\n\nRun: npm install three\nThen restart the dev server.');
      return false;
    }

    let GLTFExporter: any;
    try {
      const mod = await import('three/addons/exporters/GLTFExporter.js');
      GLTFExporter = mod.GLTFExporter;
    } catch {
      try {
        const mod = await import('three/examples/jsm/exporters/GLTFExporter.js' as any);
        GLTFExporter = mod.GLTFExporter;
      } catch {
        alert('GLTFExporter not found.\n\nMake sure three.js is installed:\nnpm install three');
        return false;
      }
    }

    const scene = new THREE.Scene();
    const S = 0.02;

    /* ── Materials ── */
    const nodeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(nodeColor),
      emissive: new THREE.Color(nodeColor),
      emissiveIntensity: 0.4,
      metalness: 0.35,
      roughness: 0.45,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(lineColor),
      emissive: new THREE.Color(lineColor),
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.55,
    });

    const sphereGeo = new THREE.SphereGeometry(0.12, 20, 20);
    const tubeR = 0.018;

    /* ── Center offset ── */
    const allX: number[] = [];
    const allY: number[] = [];
    positions.forEach(layer =>
      layer.forEach(node => {
        allX.push(node.x);
        allY.push(node.y);
      }),
    );

    if (allX.length === 0) {
      alert('No nodes to export. Process an image first.');
      return false;
    }

    const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
    const cy = (Math.min(...allY) + Math.max(...allY)) / 2;

    /* ── Build nodes ── */
const totalLayers = positions.length;
const DEPTH = totalLayers * 0.5; // total Z spread

const meshLayers: THREE.Vector3[][] = [];
positions.forEach((layer, layerIndex) => {
  const vecs: THREE.Vector3[] = [];
  // Spread layers evenly along Z
  const zPos = totalLayers > 1
    ? ((layerIndex / (totalLayers - 1)) - 0.5) * DEPTH
    : 0;

  layer.forEach(node => {
    const v = new THREE.Vector3(
      (node.x - cx) * S,
      -(node.y - cy) * S,
      zPos,               // ← now each layer sits at a different depth
    );
    vecs.push(v);
    const m = new THREE.Mesh(sphereGeo, nodeMat);
    m.position.copy(v);
    scene.add(m);
  });
  meshLayers.push(vecs);
});

    /* ── Build connections ── */
    meshLayers.forEach((layer, li) => {
      if (li >= meshLayers.length - 1) return;
      const next = meshLayers[li + 1];
      layer.forEach(pos => {
        const sorted = [...next].sort(
          (a, b) => pos.distanceTo(a) - pos.distanceTo(b),
        );
        sorted.slice(0, K).forEach(target => {
          const dir = new THREE.Vector3().subVectors(target, pos);
          const len = dir.length();
          if (len < 0.001) return;
          const mid = new THREE.Vector3()
            .addVectors(pos, target)
            .multiplyScalar(0.5);
          const geo = new THREE.CylinderGeometry(tubeR, tubeR, len, 6, 1);
          const tube = new THREE.Mesh(geo, lineMat);
          tube.position.copy(mid);
          tube.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.clone().normalize(),
          );
          scene.add(tube);
        });
      });
    });

    /* ── Lights (GLTF-compatible only) ── */
    const dl1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dl1.position.set(3, 5, 4);
    const target1 = new THREE.Object3D();
    target1.position.set(0, 0, -1);          // ← was (0,0,0) — must be (0,0,-1)
    dl1.add(target1);
    dl1.target = target1;
    scene.add(dl1);

    const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dl2.position.set(-3, -2, -4);
    const target2 = new THREE.Object3D();
    target2.position.set(0, 0, -1);          // ← same fix
    dl2.add(target2);
    dl2.target = target2;
    scene.add(dl2);

    /* ── Export ── */
    const exporter = new GLTFExporter();

    return new Promise<boolean>((resolve) => {
      exporter.parse(
        scene,
        (gltf: any) => {
          const output =
            gltf instanceof ArrayBuffer
              ? new Blob([gltf], { type: 'application/octet-stream' })
              : new Blob([JSON.stringify(gltf)], { type: 'application/json' });

          const ext = gltf instanceof ArrayBuffer ? 'glb' : 'gltf';
          const url = URL.createObjectURL(output);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          console.log(`✅ GLTF exported: ${filename}.${ext}`);
          resolve(true);
        },
        (err: unknown) => {
          console.error('GLTF export failed:', err);
          alert('GLTF export failed. Check console for details.');
          resolve(false);
        },
        { binary: false },
      );
    });

  } catch (err) {
    console.error('GLTF export error:', err);
    alert(`GLTF export failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}


export async function downloadGLTF3D(
  positions3D: { x: number; y: number; z: number }[][],
  nodeColor: string,
  lineColor: string,
  K = 5,
  filename = 'neuroshape-3d',
): Promise<boolean> {
  try {
    const THREE = await import('three').catch(() => null);
    if (!THREE) {
      alert('Three.js is not installed.');
      return false;
    }

    let GLTFExporter: any;
    try {
      const mod = await import('three/addons/exporters/GLTFExporter.js');
      GLTFExporter = mod.GLTFExporter;
    } catch {
      const mod = await import('three/examples/jsm/exporters/GLTFExporter.js' as any);
      GLTFExporter = mod.GLTFExporter;
    }

    const scene = new THREE.Scene();

    const nodeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(nodeColor),
      emissive: new THREE.Color(nodeColor),
      emissiveIntensity: 0.4,
      metalness: 0.35,
      roughness: 0.45,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(lineColor),
      emissive: new THREE.Color(lineColor),
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.55,
    });

    const sphereGeo = new THREE.SphereGeometry(0.12, 20, 20);
    const tubeR = 0.018;

    // Positions are already in 3D — just use them directly
    const meshLayers: THREE.Vector3[][] = [];
    positions3D.forEach(layer => {
      const vecs: THREE.Vector3[] = [];
      layer.forEach(node => {
        const v = new THREE.Vector3(node.x, node.y, node.z);
        vecs.push(v);
        const m = new THREE.Mesh(sphereGeo, nodeMat);
        m.position.copy(v);
        scene.add(m);
      });
      meshLayers.push(vecs);
    });

    // Connections
    meshLayers.forEach((layer, li) => {
      if (li >= meshLayers.length - 1) return;
      const next = meshLayers[li + 1];
      layer.forEach(pos => {
        const sorted = [...next].sort(
          (a, b) => pos.distanceTo(a) - pos.distanceTo(b),
        );
        sorted.slice(0, K).forEach(target => {
          const dir = new THREE.Vector3().subVectors(target, pos);
          const len = dir.length();
          if (len < 0.001) return;
          const mid = new THREE.Vector3().addVectors(pos, target).multiplyScalar(0.5);
          const geo = new THREE.CylinderGeometry(tubeR, tubeR, len, 6, 1);
          const tube = new THREE.Mesh(geo, lineMat);
          tube.position.copy(mid);
          tube.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.clone().normalize(),
          );
          scene.add(tube);
        });
      });
    });

    // Lights
    const dl1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dl1.position.set(3, 5, 4);
    const t1 = new THREE.Object3D();
    t1.position.set(0, 0, -1);
    dl1.add(t1);
    dl1.target = t1;
    scene.add(dl1);

    const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dl2.position.set(-3, -2, -4);
    const t2 = new THREE.Object3D();
    t2.position.set(0, 0, -1);
    dl2.add(t2);
    dl2.target = t2;
    scene.add(dl2);

    const exporter = new GLTFExporter();
    return new Promise<boolean>((resolve) => {
      exporter.parse(
        scene,
        (gltf: any) => {
          const output = gltf instanceof ArrayBuffer
            ? new Blob([gltf], { type: 'application/octet-stream' })
            : new Blob([JSON.stringify(gltf)], { type: 'application/json' });
          const ext = gltf instanceof ArrayBuffer ? 'glb' : 'gltf';
          const url = URL.createObjectURL(output);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${filename}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve(true);
        },
        (err: unknown) => {
          console.error('3D GLTF export failed:', err);
          resolve(false);
        },
        { binary: false },
      );
    });
  } catch (err) {
    console.error('3D export error:', err);
    return false;
  }
}