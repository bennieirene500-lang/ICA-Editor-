const PALETTES = [
  { name: 'ember', accent: '#e85d30', backdrop: '#141d2b' },
  { name: 'teal', accent: '#2dd4bf', backdrop: '#12201f' },
  { name: 'gold', accent: '#e8b04b', backdrop: '#241a2e' },
  { name: 'rose', accent: '#f0607e', backdrop: '#1c1420' },
  { name: 'sky', accent: '#4ea8de', backdrop: '#141b24' },
  { name: 'lime', accent: '#a3e635', backdrop: '#151f16' },
  { name: 'violet', accent: '#a78bfa', backdrop: '#1a1626' },
  { name: 'coral', accent: '#fb7185', backdrop: '#221417' }
];

export function pickPalette(seed) {
  const raw = PALETTES[Math.abs(hash(seed)) % PALETTES.length];

  return {
    name: raw.name,
    accentHex: raw.accent,
    backdropHex: raw.backdrop,
    accentAss: rgbToAss(raw.accent),
    accentSoftAss: rgbToAss(mix(raw.accent, '#ffffff', 0.35)),
    backdropColorSource: `0x${raw.backdrop.replace('#', '')}`
  };
}

function rgbToAss(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `&H00${toHex(b)}${toHex(g)}${toHex(r)}&`;
}

function mix(hexA, hexB, ratio) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const channel = (x, y) => Math.round(x + (y - x) * ratio);
  return `#${toHex(channel(a.r, b.r))}${toHex(channel(a.g, b.g))}${toHex(channel(a.b, b.b))}`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function toHex(value) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0').toUpperCase();
}

function hash(value) {
  let result = 0;
  for (const character of String(value || '')) {
    result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  }
  return result;
}
