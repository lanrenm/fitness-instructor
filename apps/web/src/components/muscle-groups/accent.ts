export interface AccentPalette {
  bg: string;
  fg: string;
}

const PALETTES: AccentPalette[] = [
  { bg: '#FFE8E1', fg: '#FF6B35' },
  { bg: '#E5F0FF', fg: '#3B91F5' },
  { bg: '#E3F4EC', fg: '#35B87A' },
  { bg: '#EFE5FA', fg: '#8B5CF6' },
  { bg: '#FFE7EC', fg: '#FF5A67' },
];

export function accentFor(seed: string): AccentPalette {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTES[h % PALETTES.length];
}