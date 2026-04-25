export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

// Pure mulberry32 step: takes current uint32 state, returns next state and a [0,1) float.
export function rngStep(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    state: s,
  };
}
