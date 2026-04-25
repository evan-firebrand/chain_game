// Deep Crystal palette — dark navy backgrounds with neon-bright glyph colors.
// Each higher power-of-2 steps through the spectrum: blue → cyan → green → yellow
// → orange → red → magenta → purple. Lower-value tiles read "cool," higher-value
// tiles read "hot," creating an intuitive mental map of board danger.
const palette: Record<number, { bg: string; fg: string }> = {
  2:    { bg: "#111a38", fg: "#6090e0" },
  4:    { bg: "#0c1f34", fg: "#38c8e8" },
  8:    { bg: "#0c2220", fg: "#30e090" },
  16:   { bg: "#1f2308", fg: "#c0d820" },
  32:   { bg: "#261a06", fg: "#f0b020" },
  64:   { bg: "#281406", fg: "#f06820" },
  128:  { bg: "#280810", fg: "#f03858" },
  256:  { bg: "#220a26", fg: "#d840d8" },
  512:  { bg: "#10082e", fg: "#9050f8" },
  1024: { bg: "#0a0830", fg: "#6070ff" },
  2048: { bg: "#081030", fg: "#40a0ff" },
  4096: { bg: "#04182a", fg: "#40e8ff" },
  8192: { bg: "#0a2816", fg: "#70ffa0" },
};

export function tileColors(value: number): { bg: string; fg: string } {
  return palette[value] ?? { bg: "#0a0a1a", fg: "#b8cae8" };
}
