// ─────────────────────────────────────────────────────────────
//  Core domain types — shared by server (authoritative) and client (view only)
// ─────────────────────────────────────────────────────────────

export const CARD_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  /** Unique per physical card in the 108-card deck. */
  id: string;
  type: CardType;
  /** null for wild / wild4 — the chosen colour lives in GameState.activeColor. */
  color: CardColor | null;
  /** 0–9 for number cards, undefined otherwise. */
  value?: number;
}

export type TurnDirection = 1 | -1;

/**
 * Phase inside a round.
 *  - turn          : current player must play or draw
 *  - drawnDecision : current player drew a playable card and may play it or pass
 *  - chooseColor   : round opened on a Wild; first player picks the colour
 *  - challenge     : a Wild Draw Four was played; target may challenge or accept
 *  - roundOver     : somebody emptied their hand
 */
export type GamePhase = 'turn' | 'drawnDecision' | 'chooseColor' | 'challenge' | 'roundOver';

export interface PlayerPrivateState {
  id: string;
  hand: Card[];
  /** Declared "UNO" for the hand they are about to have / currently have. */
  unoDeclared: boolean;
}

export interface PendingChallenge {
  attackerId: string;
  targetId: string;
  /** Whether the attacker held a card of the previous active colour. Server only. */
  guilty: boolean;
  previousColor: CardColor;
}

export interface GameState {
  players: PlayerPrivateState[];
  drawPile: Card[];
  discardPile: Card[];
  activeColor: CardColor;
  direction: TurnDirection;
  currentIndex: number;
  dealerIndex: number;
  phase: GamePhase;
  drawnCardId: string | null;
  pendingChallenge: PendingChallenge | null;
  /** Player who reached one card without declaring UNO and can still be caught. */
  unoVulnerableId: string | null;
  winnerId: string | null;
  /** Monotonic counter bumped on every accepted action. */
  version: number;
}

// ── Intents a client may send (server validates every one) ──
export type GameAction =
  | { type: 'play'; cardId: string; chosenColor?: CardColor }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'chooseColor'; color: CardColor }
  | { type: 'callUno' }
  | { type: 'catchUno'; targetId: string }
  | { type: 'challenge' }
  | { type: 'acceptDraw4' };

// ── Events emitted by the engine so clients can animate confirmed state ──
export type GameEvent =
  | { kind: 'deal'; handSize: number; firstCard: Card }
  | { kind: 'play'; playerId: string; card: Card; chosenColor?: CardColor }
  | { kind: 'draw'; playerId: string; count: number; reason: 'turn' | 'draw2' | 'draw4' | 'challenge' | 'unoPenalty' }
  | { kind: 'skip'; playerId: string }
  | { kind: 'reverse'; direction: TurnDirection }
  | { kind: 'colorChosen'; playerId: string; color: CardColor }
  | { kind: 'pass'; playerId: string }
  | { kind: 'uno'; playerId: string }
  | { kind: 'unoCaught'; playerId: string; byId: string }
  | { kind: 'challengeResult'; attackerId: string; targetId: string; success: boolean }
  | { kind: 'reshuffle'; count: number }
  | { kind: 'turn'; playerId: string }
  | { kind: 'roundOver'; winnerId: string; points: number };

export type ActionResult =
  | { ok: true; events: GameEvent[] }
  | { ok: false; error: string };

/** What every player is allowed to know about another player. */
export interface PlayerPublicState {
  id: string;
  cardCount: number;
  unoDeclared: boolean;
}

/** Per-viewer projection of GameState. Never contains other players' cards. */
export interface GameView {
  players: PlayerPublicState[];
  myHand: Card[];
  topCard: Card | null;
  discardCount: number;
  drawCount: number;
  activeColor: CardColor;
  direction: TurnDirection;
  currentPlayerId: string;
  phase: GamePhase;
  /** Only populated for the current player. */
  drawnCardId: string | null;
  pendingChallenge: { attackerId: string; targetId: string } | null;
  unoVulnerableId: string | null;
  winnerId: string | null;
  version: number;
}
