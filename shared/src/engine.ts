import { cardPoints, createDeck, shuffle, type Rng } from './deck';
import { isPlayable, isWild4Legal } from './rules';
import {
  CARD_COLORS,
  type ActionResult,
  type Card,
  type CardColor,
  type GameAction,
  type GameEvent,
  type GameState,
  type PlayerPrivateState,
} from './types';

export const HAND_SIZE = 7;
export const UNO_PENALTY = 2;

// ─────────────────────────────────────────────────────────────
//  Round setup
// ─────────────────────────────────────────────────────────────

export interface NewRoundResult {
  state: GameState;
  events: GameEvent[];
}

export function createRound(playerIds: string[], rng: Rng, dealerIndex = 0): NewRoundResult {
  if (playerIds.length < 2) throw new Error('Need at least 2 players');
  if (playerIds.length * HAND_SIZE + 1 > 108) throw new Error('Too many players');

  let deck = shuffle(createDeck(), rng);
  const players: PlayerPrivateState[] = playerIds.map((id) => ({ id, hand: [], unoDeclared: false }));
  const n = players.length;
  for (let r = 0; r < HAND_SIZE; r++) {
    for (let i = 0; i < n; i++) players[(dealerIndex + 1 + i) % n].hand.push(deck.pop()!);
  }

  // Flip the first card. A Wild Draw Four goes back into the deck and we flip again.
  let first = deck.pop()!;
  while (first.type === 'wild4') {
    deck.push(first);
    deck = shuffle(deck, rng);
    first = deck.pop()!;
  }

  const state: GameState = {
    players,
    drawPile: deck,
    discardPile: [first],
    activeColor: first.color ?? 'red',
    direction: 1,
    currentIndex: (dealerIndex + 1) % n,
    dealerIndex,
    phase: 'turn',
    drawnCardId: null,
    pendingChallenge: null,
    unoVulnerableId: null,
    winnerId: null,
    version: 1,
  };
  const events: GameEvent[] = [{ kind: 'deal', handSize: HAND_SIZE, firstCard: first }];

  // Apply the effect of the first card.
  const firstPlayer = state.players[state.currentIndex];
  switch (first.type) {
    case 'skip':
      events.push({ kind: 'skip', playerId: firstPlayer.id });
      state.currentIndex = step(state, state.currentIndex, 1);
      break;
    case 'reverse':
      // Dealer plays first and play moves the other way (in 2p this acts like a skip).
      state.direction = -1;
      state.currentIndex = dealerIndex;
      events.push({ kind: 'reverse', direction: -1 });
      break;
    case 'draw2':
      drawInto(state, firstPlayer, 2, events, 'draw2');
      events.push({ kind: 'skip', playerId: firstPlayer.id });
      state.currentIndex = step(state, state.currentIndex, 1);
      break;
    case 'wild':
      state.phase = 'chooseColor';
      break;
    default:
      break;
  }
  events.push({ kind: 'turn', playerId: state.players[state.currentIndex].id });
  return { state, events };
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

export function topCard(state: GameState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

export function currentPlayer(state: GameState): PlayerPrivateState {
  return state.players[state.currentIndex];
}

function step(state: GameState, from: number, steps: number): number {
  const n = state.players.length;
  return (((from + state.direction * steps) % n) + n) % n;
}

function indexOf(state: GameState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

/** Refill the draw pile from the discard pile, keeping the top card. */
function refill(state: GameState, rng: Rng, events: GameEvent[]): void {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile.pop()!;
  const recycled = state.discardPile;
  state.discardPile = [top];
  state.drawPile = shuffle(recycled, rng).concat(state.drawPile);
  events.push({ kind: 'reshuffle', count: recycled.length });
}

let activeRng: Rng = Math.random;

function drawInto(
  state: GameState,
  player: PlayerPrivateState,
  count: number,
  events: GameEvent[],
  reason: Extract<GameEvent, { kind: 'draw' }>['reason'],
): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (state.drawPile.length === 0) refill(state, activeRng, events);
    const card = state.drawPile.pop();
    if (!card) break; // every card is in someone's hand — nothing left to draw
    player.hand.push(card);
    drawn.push(card);
  }
  if (drawn.length > 0) {
    player.unoDeclared = false;
    if (state.unoVulnerableId === player.id) state.unoVulnerableId = null;
    events.push({ kind: 'draw', playerId: player.id, count: drawn.length, reason });
  }
  return drawn;
}

function advance(state: GameState, steps: number, events: GameEvent[]): void {
  state.currentIndex = step(state, state.currentIndex, steps);
  state.phase = 'turn';
  state.drawnCardId = null;
  events.push({ kind: 'turn', playerId: currentPlayer(state).id });
}

function finishRound(state: GameState, winner: PlayerPrivateState, events: GameEvent[]): void {
  const points = state.players.reduce(
    (sum, p) => (p.id === winner.id ? sum : sum + p.hand.reduce((s, c) => s + cardPoints(c), 0)),
    0,
  );
  state.phase = 'roundOver';
  state.winnerId = winner.id;
  state.drawnCardId = null;
  state.pendingChallenge = null;
  state.unoVulnerableId = null;
  events.push({ kind: 'roundOver', winnerId: winner.id, points });
}

export function roundPoints(state: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of state.players) out[p.id] = p.hand.reduce((s, c) => s + cardPoints(c), 0);
  return out;
}

const fail = (error: string): ActionResult => ({ ok: false, error });

// ─────────────────────────────────────────────────────────────
//  The reducer. Validates first, mutates only on success.
// ─────────────────────────────────────────────────────────────

export function applyAction(state: GameState, playerId: string, action: GameAction, rng: Rng): ActionResult {
  activeRng = rng;
  if (state.phase === 'roundOver') return fail('Round is over');
  const actorIndex = indexOf(state, playerId);
  if (actorIndex < 0) return fail('Unknown player');
  const actor = state.players[actorIndex];
  const isCurrent = actorIndex === state.currentIndex;
  const events: GameEvent[] = [];

  const ok = (): ActionResult => {
    state.version++;
    return { ok: true, events };
  };

  /** Any turn-taking action by someone else closes the window to catch a missed UNO. */
  const closeUnoWindow = () => {
    if (state.unoVulnerableId && state.unoVulnerableId !== playerId) state.unoVulnerableId = null;
  };

  switch (action.type) {
    // ── UNO declaration ──
    case 'callUno': {
      const canDeclareBeforePlay = isCurrent && actor.hand.length === 2 && (state.phase === 'turn' || state.phase === 'drawnDecision');
      const canDeclareAfterPlay = state.unoVulnerableId === actor.id && actor.hand.length === 1;
      if (!canDeclareBeforePlay && !canDeclareAfterPlay) return fail('You can only call UNO with two cards on your turn, or right after going to one');
      if (actor.unoDeclared) return fail('Already declared');
      actor.unoDeclared = true;
      if (canDeclareAfterPlay) state.unoVulnerableId = null;
      events.push({ kind: 'uno', playerId: actor.id });
      return ok();
    }

    case 'catchUno': {
      const target = state.players.find((p) => p.id === action.targetId);
      if (!target || target.id === actor.id) return fail('Invalid target');
      if (state.unoVulnerableId !== target.id || target.hand.length !== 1 || target.unoDeclared) return fail('Nothing to catch');
      state.unoVulnerableId = null;
      drawInto(state, target, UNO_PENALTY, events, 'unoPenalty');
      events.push({ kind: 'unoCaught', playerId: target.id, byId: actor.id });
      return ok();
    }

    // ── Opening wild ──
    case 'chooseColor': {
      if (state.phase !== 'chooseColor') return fail('No colour to choose');
      if (!isCurrent) return fail('Not your turn');
      if (!CARD_COLORS.includes(action.color)) return fail('Invalid colour');
      state.activeColor = action.color;
      state.phase = 'turn';
      events.push({ kind: 'colorChosen', playerId: actor.id, color: action.color });
      return ok();
    }

    // ── Wild Draw Four challenge ──
    case 'challenge':
    case 'acceptDraw4': {
      const pc = state.pendingChallenge;
      if (state.phase !== 'challenge' || !pc) return fail('No challenge pending');
      if (pc.targetId !== actor.id) return fail('Only the target can respond');
      closeUnoWindow();
      state.pendingChallenge = null;
      if (action.type === 'acceptDraw4') {
        drawInto(state, actor, 4, events, 'draw4');
        events.push({ kind: 'skip', playerId: actor.id });
        advance(state, 1, events);
        return ok();
      }
      const attacker = state.players[indexOf(state, pc.attackerId)];
      events.push({ kind: 'challengeResult', attackerId: pc.attackerId, targetId: pc.targetId, success: pc.guilty });
      if (pc.guilty) {
        // Attacker draws the four instead; challenger takes a normal turn.
        drawInto(state, attacker, 4, events, 'challenge');
        state.phase = 'turn';
        events.push({ kind: 'turn', playerId: actor.id });
      } else {
        drawInto(state, actor, 6, events, 'challenge');
        events.push({ kind: 'skip', playerId: actor.id });
        advance(state, 1, events);
      }
      return ok();
    }

    // ── Drawing ──
    case 'draw': {
      if (!isCurrent) return fail('Not your turn');
      if (state.phase !== 'turn') return fail('You cannot draw right now');
      closeUnoWindow();
      const [card] = drawInto(state, actor, 1, events, 'turn');
      if (card && isPlayable(card, topCard(state), state.activeColor)) {
        state.phase = 'drawnDecision';
        state.drawnCardId = card.id;
      } else {
        advance(state, 1, events);
      }
      return ok();
    }

    case 'pass': {
      if (!isCurrent) return fail('Not your turn');
      if (state.phase !== 'drawnDecision') return fail('You can only pass after drawing a playable card');
      events.push({ kind: 'pass', playerId: actor.id });
      advance(state, 1, events);
      return ok();
    }

    // ── Playing a card ──
    case 'play': {
      if (!isCurrent) return fail('Not your turn');
      if (state.phase !== 'turn' && state.phase !== 'drawnDecision') return fail('You cannot play right now');
      if (state.phase === 'drawnDecision' && action.cardId !== state.drawnCardId) return fail('You may only play the card you just drew');
      const card = actor.hand.find((c) => c.id === action.cardId);
      if (!card) return fail('Card not in hand');
      if (!isPlayable(card, topCard(state), state.activeColor)) return fail('That card does not match');
      const isWild = card.type === 'wild' || card.type === 'wild4';
      if (isWild && (!action.chosenColor || !CARD_COLORS.includes(action.chosenColor))) return fail('Choose a colour');

      // ── commit ──
      closeUnoWindow();
      const previousColor = state.activeColor;
      const guilty = card.type === 'wild4' && !isWild4Legal(actor.hand, card.id, previousColor);
      actor.hand = actor.hand.filter((c) => c.id !== card.id);
      state.discardPile.push(card);
      state.activeColor = isWild ? action.chosenColor! : (card.color as CardColor);
      state.drawnCardId = null;
      events.push({ kind: 'play', playerId: actor.id, card, chosenColor: isWild ? action.chosenColor : undefined });

      if (actor.hand.length === 1 && !actor.unoDeclared) state.unoVulnerableId = actor.id;
      if (actor.hand.length !== 1) actor.unoDeclared = false;

      const n = state.players.length;
      const nextIdx = step(state, state.currentIndex, 1);
      const next = state.players[nextIdx];

      if (actor.hand.length === 0) {
        // Final card: draw penalties still land (they count toward the score).
        if (card.type === 'draw2') drawInto(state, next, 2, events, 'draw2');
        if (card.type === 'wild4') drawInto(state, next, 4, events, 'draw4');
        finishRound(state, actor, events);
        return ok();
      }

      switch (card.type) {
        case 'number':
        case 'wild':
          if (card.type === 'wild') events.push({ kind: 'colorChosen', playerId: actor.id, color: state.activeColor });
          advance(state, 1, events);
          break;
        case 'skip':
          events.push({ kind: 'skip', playerId: next.id });
          advance(state, 2, events);
          break;
        case 'reverse':
          if (n === 2) {
            events.push({ kind: 'reverse', direction: state.direction });
            events.push({ kind: 'skip', playerId: next.id });
            advance(state, 2, events);
          } else {
            state.direction = state.direction === 1 ? -1 : 1;
            events.push({ kind: 'reverse', direction: state.direction });
            advance(state, 1, events);
          }
          break;
        case 'draw2':
          drawInto(state, next, 2, events, 'draw2');
          events.push({ kind: 'skip', playerId: next.id });
          advance(state, 2, events);
          break;
        case 'wild4':
          events.push({ kind: 'colorChosen', playerId: actor.id, color: state.activeColor });
          state.pendingChallenge = { attackerId: actor.id, targetId: next.id, guilty, previousColor };
          state.phase = 'challenge';
          state.currentIndex = nextIdx;
          events.push({ kind: 'turn', playerId: next.id });
          break;
      }
      return ok();
    }
  }
}

/**
 * Pick a safe automatic action for the player whose input the server is waiting on.
 * Used when that player is disconnected or their turn timer runs out.
 */
export function autoAction(state: GameState): { playerId: string; action: GameAction } | null {
  if (state.phase === 'roundOver') return null;
  const p = currentPlayer(state);
  switch (state.phase) {
    case 'chooseColor': {
      const counts = CARD_COLORS.map((c) => p.hand.filter((x) => x.color === c).length);
      return { playerId: p.id, action: { type: 'chooseColor', color: CARD_COLORS[counts.indexOf(Math.max(...counts))] } };
    }
    case 'challenge':
      return { playerId: p.id, action: { type: 'acceptDraw4' } };
    case 'drawnDecision':
      return { playerId: p.id, action: { type: 'pass' } };
    case 'turn':
      return { playerId: p.id, action: { type: 'draw' } };
  }
}

/** Remove a player mid-round (they left). Their cards go to the bottom of the draw pile. */
export function removePlayer(state: GameState, playerId: string): GameEvent[] {
  const idx = indexOf(state, playerId);
  if (idx < 0) return [];
  const events: GameEvent[] = [];
  const [gone] = state.players.splice(idx, 1);
  state.drawPile = gone.hand.concat(state.drawPile);
  if (state.unoVulnerableId === playerId) state.unoVulnerableId = null;
  if (state.phase === 'roundOver') return events;

  if (state.players.length === 1) {
    finishRound(state, state.players[0], events);
    state.version++;
    return events;
  }
  const pc = state.pendingChallenge;
  if (pc && (pc.attackerId === playerId || pc.targetId === playerId)) {
    state.pendingChallenge = null;
    state.phase = 'turn';
  }
  if (idx < state.currentIndex) state.currentIndex--;
  else if (idx === state.currentIndex) {
    // The seat that slid into this index — or wrap — becomes current, respecting direction.
    if (state.direction === 1) state.currentIndex = state.currentIndex % state.players.length;
    else state.currentIndex = (state.currentIndex - 1 + state.players.length) % state.players.length;
    state.phase = state.phase === 'chooseColor' ? 'chooseColor' : 'turn';
    state.drawnCardId = null;
    events.push({ kind: 'turn', playerId: currentPlayer(state).id });
  }
  if (state.dealerIndex >= state.players.length) state.dealerIndex = 0;
  state.version++;
  return events;
}
