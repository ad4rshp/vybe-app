export function getThemeColorHex(theme: string): string {
  switch (theme) {
    case 'violet':
      return '#8b5cf6';
    case 'cyan':
      return '#06b6d4';
    case 'emerald':
      return '#10b981';
    case 'rose':
    default:
      return '#f43f5e';
  }
}

export function generateDynamicFavicon(themeName: string) {
  if (typeof window === 'undefined') return;

  const colorHex = getThemeColorHex(themeName);
  
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#070a13';
  ctx.fillRect(0, 0, 64, 64);

  // Gradient Rounded Rect
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(1, '#070a13');

  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 48, 48, 12);
  } else {
    ctx.rect(8, 8, 48, 48);
  }
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow filter for V shape
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(22, 24);
  ctx.lineTo(32, 42);
  ctx.lineTo(42, 24);
  ctx.stroke();

  const dataUrl = canvas.toDataURL('image/png');

  // Update link element
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = dataUrl;
  link.type = 'image/png';
}
