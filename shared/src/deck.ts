import { CARD_COLORS, type Card } from './types';

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) — used for seeded tests and server shuffles. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Classic 108-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of CARD_COLORS) {
    const c = color[0];
    deck.push({ id: `${c}-0`, type: 'number', color, value: 0 });
    for (let v = 1; v <= 9; v++) {
      for (const copy of ['a', 'b']) deck.push({ id: `${c}-${v}${copy}`, type: 'number', color, value: v });
    }
    for (const type of ['skip', 'reverse', 'draw2'] as const) {
      for (const copy of ['a', 'b']) deck.push({ id: `${c}-${type}${copy}`, type, color });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wild-${i}`, type: 'wild', color: null });
    deck.push({ id: `wild4-${i}`, type: 'wild4', color: null });
  }
  return deck;
}

/** Fisher–Yates, returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardPoints(card: Card): number {
  switch (card.type) {
    case 'number':
      return card.value ?? 0;
    case 'skip':
    case 'reverse':
    case 'draw2':
      return 20;
    case 'wild':
    case 'wild4':
      return 50;
  }
}
