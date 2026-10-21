/** Mulberry32: the same seed always gives the same sequence. */
export function nextRandom(state: number): readonly [nextState: number, value: number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(next ^ (next >>> 15), next | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return [next, ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296];
}

/** A separate seed for each participant, so adding one does not change the others. */
export function seedFor(seed: number, index: number): number {
  return (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
}
