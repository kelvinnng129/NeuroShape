'use client';

import { useEffect, useRef } from 'react';

export default function NetworkCanvas({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkRef = useRef(dark);
  useEffect(() => { darkRef.current = dark; }, [dark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const mouse = { x: null as number | null, y: null as number | null };

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const onLeave = () => { mouse.x = null; mouse.y = null; };
    const onClick = () => particles.forEach(p => { p.vx += (Math.random() - 0.5) * 3; p.vy += (Math.random() - 0.5) * 3; });

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('mousedown', onClick);

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
      particles = [];
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 70);
      for (let i = 0; i < count; i++) {
        particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, size: Math.random() * 2 + 1 });
      }
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const d = darkRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) { const f = (150 - dist) / 150; p.vx -= (dx / dist) * f * 0.04; p.vy -= (dy / dist) * f * 0.04; }
        }
        p.x += p.vx; p.y += p.vy; p.vx *= 0.999; p.vy *= 0.999;
        if (Math.sqrt(p.vx * p.vx + p.vy * p.vy) < 0.12) { p.vx += (Math.random() - 0.5) * 0.06; p.vy += (Math.random() - 0.5) * 0.06; }
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        p.x = Math.max(0, Math.min(canvas.width, p.x));
        p.y = Math.max(0, Math.min(canvas.height, p.y));
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = d ? 'rgba(74,222,128,0.5)' : 'rgba(59,130,246,0.55)'; ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx2 = p.x - q.x, dy2 = p.y - q.y, dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (dist2 < 130) {
            const o = (1 - dist2 / 130) * (d ? 0.18 : 0.16);
            ctx.beginPath(); ctx.strokeStyle = d ? `rgba(74,222,128,${o})` : `rgba(34,197,94,${o})`;
            ctx.lineWidth = 0.8; ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(animate);
    }

    resize(); animate();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseleave', onLeave); window.removeEventListener('mousedown', onClick); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }} />;
}