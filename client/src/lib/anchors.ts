/**
 * Anchor registry: named DOM elements (deck, discard pile, seats, hand cards)
 * so animations can fly cards between their *real* on-screen positions (FLIP).
 */
const anchors = new Map<string, HTMLElement>();
/** Last measured rect + rotation of a hand card, captured right before it is played. */
const handSnapshots = new Map<string, { rect: DOMRect; rotate: number }>();

export function anchorRef(key: string) {
  return (el: HTMLElement | null) => {
    if (el) anchors.set(key, el);
    else if (anchors.get(key) && !anchors.get(key)!.isConnected) anchors.delete(key);
  };
}

export function anchorRect(key: string): DOMRect | null {
  const el = anchors.get(key);
  return el && el.isConnected ? el.getBoundingClientRect() : null;
}

export function anchorCenter(key: string): { x: number; y: number } | null {
  const r = anchorRect(key);
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

export function snapshotHandCard(cardId: string, rotate: number) {
  const r = anchorRect(`hand:${cardId}`);
  if (r) handSnapshots.set(cardId, { rect: r, rotate });
}

export function takeHandSnapshot(cardId: string) {
  const s = handSnapshots.get(cardId);
  handSnapshots.delete(cardId);
  return s ?? null;
}

export const seatKey = (playerId: string) => `seat:${playerId}`;
