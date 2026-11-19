import { topCard } from './engine';
import type { GameState, GameView } from './types';

/**
 * Project the authoritative state for one viewer.
 * This is the ONLY thing the server sends about a game — other players' hands
 * are reduced to a count, and the challenge's "guilty" flag is never exposed.
 */
export function toGameView(state: GameState, viewerId: string): GameView {
  const me = state.players.find((p) => p.id === viewerId);
  const current = state.players[state.currentIndex];
  return {
    players: state.players.map((p) => ({ id: p.id, cardCount: p.hand.length, unoDeclared: p.unoDeclared })),
    myHand: me ? me.hand.map((c) => ({ ...c })) : [],
    topCard: topCard(state),
    discardCount: state.discardPile.length,
    drawCount: state.drawPile.length,
    activeColor: state.activeColor,
    direction: state.direction,
    currentPlayerId: current?.id ?? '',
    phase: state.phase,
    drawnCardId: current && current.id === viewerId ? state.drawnCardId : null,
    pendingChallenge: state.pendingChallenge
      ? { attackerId: state.pendingChallenge.attackerId, targetId: state.pendingChallenge.targetId }
      : null,
    unoVulnerableId: state.unoVulnerableId,
    winnerId: state.winnerId,
    version: state.version,
  };
}
