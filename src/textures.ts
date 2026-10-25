// Canvas textures: gate labels, tunnel numbers, road, wall, water. Numbers are drawn LTR.
import * as THREE from 'three';

export type Theme = 'sea' | 'ice';

const FONT = "'Rubik', system-ui, sans-serif";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.direction = 'ltr';
  return [c, ctx];
}

function tex(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 900) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > 20) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
}

/** Holographic gate panel: the operation label in Workbook notation, as big as it fits. */
export function gateTexture(label: string, theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 320);
  const edge = theme === 'ice' ? '#8fd8ff' : '#3cf2ff';
  const glow = theme === 'ice' ? '#d8f4ff' : '#ff2fb3';
  ctx.fillStyle = theme === 'ice' ? 'rgba(8,40,80,0.9)' : 'rgba(10,6,40,0.9)';
  roundRect(ctx, 10, 10, 492, 240, 34);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = edge;
  ctx.shadowColor = edge;
  ctx.shadowBlur = 20;
  roundRect(ctx, 10, 10, 492, 240, 34);
  ctx.stroke();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, label, 450, 176);
  ctx.fillText(label, 256, 138);
  ctx.strokeStyle = theme === 'ice' ? '#bfeaff' : '#ff6fd0';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (const y of [292, 316]) {
    ctx.beginPath();
    ctx.moveTo(220, y);
    ctx.lineTo(256, y - 20);
    ctx.lineTo(292, y);
    ctx.stroke();
  }
  return tex(c);
}

/** Big number painted on the tunnel wall: +3, −8, or +7°C on the ice level. */
export function tunnelLabelTexture(text: string, theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 256);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = theme === 'ice' ? '#8fd8ff' : '#ff2fb3';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  fitText(ctx, text, 480, 200);
  ctx.fillText(text, 256, 132);
  return tex(c);
}

/** Small badge for ghost previews. */
export function badgeTexture(text: string, good: boolean): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 128);
  ctx.fillStyle = good ? 'rgba(20,90,70,0.85)' : 'rgba(40,20,70,0.85)';
  roundRect(ctx, 6, 6, 244, 116, 30);
  ctx.fill();
  ctx.strokeStyle = good ? '#7dff9a' : '#c9a6ff';
  ctx.lineWidth = 6;
  roundRect(ctx, 6, 6, 244, 116, 30);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitText(ctx, text, 220, 84, 800);
  ctx.fillText(text, 128, 68);
  return tex(c);
}

/** Road surface: dark glass, three lanes, neon dividers. Repeats along its length. */
export function roadTexture(theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  if (theme === 'ice') {
    g.addColorStop(0, '#1b3f66'); g.addColorStop(0.5, '#244f7c'); g.addColorStop(1, '#1b3f66');
  } else {
    g.addColorStop(0, '#120a2e'); g.addColorStop(0.5, '#1d1145'); g.addColorStop(1, '#120a2e');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  // fine grid
  ctx.strokeStyle = theme === 'ice' ? 'rgba(200,240,255,0.10)' : 'rgba(140,90,255,0.12)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 512; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  // lane dividers (dashed) at 1/3 and 2/3
  const lane = theme === 'ice' ? '#bfeaff' : '#ff2fb3';
  ctx.shadowColor = lane;
  ctx.shadowBlur = 14;
  ctx.fillStyle = lane;
  for (const x of [512 / 3, (2 * 512) / 3]) {
    for (let y = 0; y < 512; y += 128) ctx.fillRect(x - 5, y + 10, 10, 80);
  }
  // edges
  ctx.fillStyle = theme === 'ice' ? '#8fd8ff' : '#3cf2ff';
  ctx.shadowColor = ctx.fillStyle;
  ctx.fillRect(0, 0, 10, 512);
  ctx.fillRect(502, 0, 10, 512);
  const t = tex(c, true);
  return t;
}

/** Tunnel wall panels: dark tiles with a faint grid. */
export function wallTexture(theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = theme === 'ice' ? '#5d8fb8' : '#2a1d4a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = theme === 'ice' ? 'rgba(230,248,255,0.5)' : 'rgba(150,110,255,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 252);
  ctx.strokeStyle = theme === 'ice' ? 'rgba(230,248,255,0.25)' : 'rgba(150,110,255,0.18)';
  ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 256); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
  return tex(c, true);
}

/** Water / ice surface: glowing hex caustics. */
export function surfaceTexture(theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = theme === 'ice' ? '#cfeeff' : '#04263f';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = theme === 'ice' ? 'rgba(90,160,210,0.7)' : 'rgba(60,242,255,0.85)';
  ctx.shadowColor = theme === 'ice' ? '#ffffff' : '#3cf2ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = theme === 'ice' ? 2 : 3;
  const r = 32;
  const h = Math.sqrt(3) * r;
  for (let row = -1; row < 512 / h + 1; row++) {
    for (let col = -1; col < 512 / (1.5 * r) + 1; col++) {
      const cx = col * 1.5 * r;
      const cy = row * h + (col % 2 ? h / 2 : 0);
      const jitter = theme === 'ice' ? 6 : 3;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (Math.PI / 3) * k;
        const x = cx + r * Math.cos(a) + (Math.sin(cx * 7 + k) * jitter);
        const y = cy + r * Math.sin(a) + (Math.cos(cy * 5 + k) * jitter);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  return tex(c, true);
}

export function seabedTexture(theme: Theme): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = theme === 'ice' ? '#2a5f8f' : '#03152e';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 512, y = rnd() * 512, s = 1 + rnd() * 4;
    const col = theme === 'ice' ? '#bfeaff' : ['#7dff9a', '#ff2fb3', '#3cf2ff', '#00d1b2'][i % 4];
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = 0.4 + rnd() * 0.6;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return tex(c, true);
}
