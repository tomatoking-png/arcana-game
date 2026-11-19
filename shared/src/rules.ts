import type { Card, CardColor } from './types';

/**
 * Can `card` be played on `top` given the active colour?
 * Wild Draw Four is always *playable* (bluffing is allowed); legality is
 * enforced through the challenge system — see `isWild4Legal`.
 */
export function isPlayable(card: Card, top: Card | null, activeColor: CardColor): boolean {
  if (card.type === 'wild' || card.type === 'wild4') return true;
  if (!top) return true;
  if (card.color === activeColor) return true;
  if (card.type === 'number' && top.type === 'number') return card.value === top.value;
  if (card.type !== 'number' && card.type === top.type) return true;
  return false;
}

/** Official rule: WD4 is legal only when the player holds no card matching the active colour. */
export function isWild4Legal(hand: readonly Card[], playedId: string, activeColor: CardColor): boolean {
  return !hand.some((c) => c.id !== playedId && c.color === activeColor);
}

export function playableCards(hand: readonly Card[], top: Card | null, activeColor: CardColor): Card[] {
  return hand.filter((c) => isPlayable(c, top, activeColor));
}
