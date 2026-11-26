/** Small seeded PRNG (mulberry32). State is a plain number so it can live in match state. */
export interface RandomSource {
  seed: number;
}

export function nextRandom(source: RandomSource): number {
  source.seed = (source.seed + 0x6d2b79f5) | 0;
  let t = source.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomRange(source: RandomSource, min: number, max: number): number {
  return min + (max - min) * nextRandom(source);
}

export function createRandom(seed: number): RandomSource {
  return { seed: seed | 0 };
}
