import type { GameAction, GameEvent, GameView } from './types';

// ─────────────────────────────────────────────────────────────
//  Room / network protocol shared by client and server
// ─────────────────────────────────────────────────────────────

export const MIN_PLAYERS = 2;
/** Current room size. Layout + engine support up to 10. */
export const MAX_PLAYERS = 4;
export const MAX_PLAYERS_SUPPORTED = 10;

export const AVATARS = ['witch', 'tinkerer', 'cleric', 'catfolk'] as const;
export type AvatarId = (typeof AVATARS)[number];

export type RoomStatus = 'lobby' | 'playing' | 'results';

export interface RoomPlayerView {
  id: string;
  name: string;
  avatar: AvatarId;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  score: number;
  wantsRematch: boolean;
}

export interface RoundResultView {
  round: number;
  winnerId: string;
  pointsWon: number;
  /** Points left in each player's hand at the end of the round. */
  handPoints: Record<string, number>;
  cardsLeft: Record<string, number>;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: string;
  youId: string;
  players: RoomPlayerView[];
  round: number;
  game: GameView | null;
  lastResult: RoundResultView | null;
  /** Epoch ms when the server will auto-act for a disconnected current player. */
  autoActAt: number | null;
}

export interface SessionInfo {
  code: string;
  playerId: string;
  token: string;
}

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServerEvents {
  'room:create': (p: { name: string; avatar: AvatarId }, ack: (r: Ack<{ session: SessionInfo }>) => void) => void;
  'room:join': (p: { code: string; name: string; avatar: AvatarId }, ack: (r: Ack<{ session: SessionInfo }>) => void) => void;
  'session:resume': (p: SessionInfo, ack: (r: Ack) => void) => void;
  'room:leave': (ack?: (r: Ack) => void) => void;
  'lobby:ready': (p: { ready: boolean }, ack?: (r: Ack) => void) => void;
  'lobby:profile': (p: { name?: string; avatar?: AvatarId }, ack?: (r: Ack) => void) => void;
  'lobby:start': (ack?: (r: Ack) => void) => void;
  'game:action': (p: { intentId: string; action: GameAction }, ack?: (r: Ack) => void) => void;
  'results:rematch': (p: { want: boolean }, ack?: (r: Ack) => void) => void;
  'results:lobby': (ack?: (r: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (p: { room: RoomView; events: GameEvent[] }) => void;
  'room:closed': (p: { reason: string }) => void;
  'toast': (p: { tone: 'info' | 'warn' | 'error'; message: string }) => void;
}
