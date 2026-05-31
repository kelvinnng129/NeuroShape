'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, FileDown, Share2 } from 'lucide-react';
import { downloadSVG, downloadPNG } from '@/lib/export';
import { downloadGLTF } from '@/lib/exportGLTF';
import { useNS } from './context';

export default function ExportModal() {
  const { showExport, setShowExport, t, geometry, s } = useNS();

  const btn = (label: string, sub: string, Icon: typeof FileDown, onClick: () => void) => (
    <button onClick={() => { onClick(); setShowExport(false); }}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border ${t.border} ${t.bgSoft} hover:border-green-400/40 transition-all text-left`}>
      <div className={`w-10 h-10 rounded-lg ${t.accentBg} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-green-400" />
      </div>
      <div>
        <p className={`text-sm font-semibold ${t.text}`}>{label}</p>
        <p className={`text-xs ${t.textMuted}`}>{sub}</p>
      </div>
    </button>
  );

  return (
    <AnimatePresence>
      {showExport && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowExport(false)}>
          <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className={`${t.bgCard} border ${t.border} rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-bold ${t.text}`}>Export Artwork</h3>
              <button onClick={() => setShowExport(false)} className={`p-1.5 ${t.textSoft} hover:text-green-400 transition`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5">
              {btn('PNG (High-Res)', '2× Resolution · Share-ready', FileDown, () => downloadPNG('neuroshape', 2))}
              {btn('SVG (Vector)', 'Scalable · Editable in Figma', FileDown, () => downloadSVG('neuroshape'))}
              {btn('PNG (Ultra-Res)', '4× Resolution · Print quality', Share2, () => downloadPNG('neuroshape', 4))}
              
              {btn('GLTF (3D Model)', 'Open in Blender · Three.js · AR', FileDown, async () => {
  const ok = await downloadGLTF(
    geometry.positions, s.nodeColor, s.lineColor, 5, 'neuroshape',
  );
  if (!ok) setShowExport(true); // keep modal open if failed
})}



            </div>
            <p className={`text-xs ${t.textMuted} mt-4 text-center`}>
              Press <kbd className="px-1 py-0.5 rounded bg-gray-800/30 text-green-400 font-mono">E</kbd> to toggle this panel
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}