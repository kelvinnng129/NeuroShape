// lib/export.ts

export function downloadSVG(filename: string = 'neuroshape') {
  const svgEl = document.getElementById('network-svg');
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true) as SVGElement;
  const viewBox = clone.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 600];

  // Add background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(viewBox[2]));
  bg.setAttribute('height', String(viewBox[3]));
  bg.setAttribute('fill', document.documentElement.classList.contains('dark') ? '#030712' : '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  // Add xmlns if missing
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const svgData = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPNG(filename: string = 'neuroshape', scale: number = 2) {
  const svgEl = document.getElementById('network-svg');
  if (!svgEl) return;

  const clone = svgEl.cloneNode(true) as SVGElement;
  const viewBox = clone.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 600];
  const svgW = viewBox[2];
  const svgH = viewBox[3];

  // Add background rect
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(svgW));
  bg.setAttribute('height', String(svgH));

  // Detect dark mode from the page background
  const pageEl = document.querySelector('[class*="bg-gray-950"]');
  const isDark = !!pageEl;
  bg.setAttribute('fill', isDark ? '#030712' : '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  // Set explicit dimensions for the image conversion
  clone.setAttribute('width', String(svgW));
  clone.setAttribute('height', String(svgH));

  const svgData = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = svgW * scale;
    canvas.height = svgH * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = isDark ? '#030712' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, svgW, svgH);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}-${scale}x.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }, 'image/png');

    URL.revokeObjectURL(url);
  };

  img.onerror = () => {
    console.error('Failed to render SVG to image');
    URL.revokeObjectURL(url);
  };

  img.src = url;
}