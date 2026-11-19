import { randomBytes, randomInt } from 'node:crypto';
import {
  AVATARS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  autoAction,
  createRng,
  createRound,
  removePlayer,
  roundPoints,
  toGameView,
  type Ack,
  type AvatarId,
  type GameAction,
  type GameEvent,
  type GameState,
  type Rng,
  type RoomStatus,
  type RoomView,
  type RoundResultView,
  type SessionInfo,
} from '@arcana/shared';
import type { ServerConfig } from './config';

// ─────────────────────────────────────────────────────────────
//  Server-side room model. Everything here is authoritative.
//  Stored in memory behind RoomStore so it can move to Redis later.
// ─────────────────────────────────────────────────────────────

export interface ServerPlayer {
  id: string;
  token: string;
  name: string;
  avatar: AvatarId;
  ready: boolean;
  connected: boolean;
  socketId: string | null;
  score: number;
  wantsRematch: boolean;
  disconnectedAt: number | null;
}

export interface Room {
  code: string;
  hostId: string;
  players: ServerPlayer[];
  status: RoomStatus;
  round: number;
  game: GameState | null;
  lastResult: RoundResultView | null;
  rng: Rng;
  recentIntents: Map<string, string[]>;
  autoActAt: number | null;
  timer: NodeJS.Timeout | null;
  lastActivity: number;
}

export interface RoomStore {
  get(code: string): Room | undefined;
  set(room: Room): void;
  delete(code: string): void;
  all(): Iterable<Room>;
}

export class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();
  get(code: string) { return this.rooms.get(code); }
  set(room: Room) { this.rooms.set(room.code, room); }
  delete(code: string) { this.rooms.delete(code); }
  all() { return this.rooms.values(); }
}

/** Transport hooks — implemented by the Socket.IO layer, stubbed in tests. */
export interface RoomTransport {
  sendState(socketId: string, room: RoomView, events: GameEvent[]): void;
  sendClosed(socketId: string, reason: string): void;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_INTENT_MEMORY = 64;

export const cleanName = (raw: unknown): string => {
  const s = typeof raw === 'string' ? raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '';
  return s || 'Apprentice';
};
const cleanAvatar = (raw: unknown): AvatarId => (AVATARS.includes(raw as AvatarId) ? (raw as AvatarId) : 'witch');
export const normalizeCode = (raw: unknown) => (typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : '');

const err = (error: string) => ({ ok: false as const, error });

export class RoomManager {
  /** socketId → { code, playerId } */
  private sockets = new Map<string, { code: string; playerId: string }>();

  constructor(
    private config: ServerConfig,
    private transport: RoomTransport,
    private store: RoomStore = new MemoryRoomStore(),
    private now: () => number = Date.now,
  ) {}

  // ── lifecycle ──────────────────────────────────────────────

  create(socketId: string, name: unknown, avatar: unknown): Ack<{ session: SessionInfo }> {
    this.detachSocket(socketId);
    let code = '';
    do code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    while (this.store.get(code));
    const player = this.newPlayer(socketId, name, avatar);
    const room: Room = {
      code,
      hostId: player.id,
      players: [player],
      status: 'lobby',
      round: 0,
      game: null,
      lastResult: null,
      rng: createRng(randomInt(2 ** 31)),
      recentIntents: new Map(),
      autoActAt: null,
      timer: null,
      lastActivity: this.now(),
    };
    this.store.set(room);
    this.sockets.set(socketId, { code, playerId: player.id });
    this.broadcast(room);
    return { ok: true, session: { code, playerId: player.id, token: player.token } };
  }

  join(socketId: string, rawCode: unknown, name: unknown, avatar: unknown): Ack<{ session: SessionInfo }> {
    const code = normalizeCode(rawCode);
    const room = this.store.get(code);
    if (!room) return err('Room not found — check the code');
    if (room.status !== 'lobby') return err('That game has already started');
    if (room.players.length >= MAX_PLAYERS) return err('Room is full');
    this.detachSocket(socketId);
    const player = this.newPlayer(socketId, name, avatar);
    // Prefer an avatar nobody else is using.
    const used = new Set(room.players.map((p) => p.avatar));
    if (used.has(player.avatar)) player.avatar = AVATARS.find((a) => !used.has(a)) ?? player.avatar;
    room.players.push(player);
    this.sockets.set(socketId, { code, playerId: player.id });
    this.touch(room);
    this.broadcast(room);
    return { ok: true, session: { code, playerId: player.id, token: player.token } };
  }

  resume(socketId: string, session: SessionInfo): Ack {
    const room = this.store.get(normalizeCode(session?.code));
    const player = room?.players.find((p) => p.id === session?.playerId);
    if (!room || !player || typeof session.token !== 'string' || player.token !== session.token) return err('Session expired');
    if (player.socketId && player.socketId !== socketId) {
      // Same seat opened elsewhere — the newest connection wins.
      this.transport.sendClosed(player.socketId, 'Opened in another window');
      this.sockets.delete(player.socketId);
    }
    this.detachSocket(socketId);
    player.socketId = socketId;
    player.connected = true;
    player.disconnectedAt = null;
    this.sockets.set(socketId, { code: room.code, playerId: player.id });
    this.touch(room);
    this.schedule(room);
    this.broadcast(room);
    return { ok: true };
  }

  disconnect(socketId: string): void {
    const ref = this.sockets.get(socketId);
    this.sockets.delete(socketId);
    if (!ref) return;
    const room = this.store.get(ref.code);
    const player = room?.players.find((p) => p.id === ref.playerId);
    if (!room || !player || player.socketId !== socketId) return;
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = this.now();
    if (room.hostId === player.id) this.reassignHost(room);
    this.schedule(room);
    this.broadcast(room);
  }

  leave(socketId: string): Ack {
    const ref = this.sockets.get(socketId);
    if (!ref) return err('Not in a room');
    this.sockets.delete(socketId);
    const room = this.store.get(ref.code);
    if (room) this.removeFromRoom(room, ref.playerId);
    return { ok: true };
  }

  // ── lobby ──────────────────────────────────────────────────

  setReady(socketId: string, ready: boolean): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    if (ctx.room.status !== 'lobby') return err('Game already started');
    ctx.player.ready = !!ready;
    this.touch(ctx.room);
    this.broadcast(ctx.room);
    return { ok: true };
  }

  setProfile(socketId: string, name?: unknown, avatar?: unknown): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    if (name !== undefined) ctx.player.name = cleanName(name);
    if (avatar !== undefined) ctx.player.avatar = cleanAvatar(avatar);
    this.broadcast(ctx.room);
    return { ok: true };
  }

  start(socketId: string): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    const { room, player } = ctx;
    if (room.hostId !== player.id) return err('Only the host can start');
    if (room.status !== 'lobby') return err('Already started');
    if (room.players.length < MIN_PLAYERS) return err(`Need at least ${MIN_PLAYERS} players`);
    if (!room.players.every((p) => p.ready || p.id === room.hostId)) return err('Everyone must be ready');
    if (!room.players.every((p) => p.connected)) return err('Waiting for a disconnected player');
    this.startRound(room, 0);
    return { ok: true };
  }

  // ── gameplay ───────────────────────────────────────────────

  action(socketId: string, intentId: unknown, action: GameAction): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    const { room, player } = ctx;
    if (room.status !== 'playing' || !room.game) return err('No game in progress');
    if (!action || typeof action !== 'object' || typeof (action as GameAction).type !== 'string') return err('Bad action');

    // Duplicate-intent guard (double clicks, retransmits after reconnect).
    if (typeof intentId === 'string' && intentId.length <= 64) {
      const seen = room.recentIntents.get(player.id) ?? [];
      if (seen.includes(intentId)) return { ok: true };
      seen.push(intentId);
      if (seen.length > MAX_INTENT_MEMORY) seen.shift();
      room.recentIntents.set(player.id, seen);
    }
    return this.apply(room, player.id, action);
  }

  rematch(socketId: string, want: boolean): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    const { room, player } = ctx;
    if (room.status !== 'results') return err('Round is not over');
    player.wantsRematch = !!want;
    const active = room.players.filter((p) => p.connected);
    if (active.length >= MIN_PLAYERS && active.every((p) => p.wantsRematch)) {
      // Drop seats that never came back, then deal the next round with the dealer rotated.
      for (const p of room.players.filter((p) => !p.connected)) this.dropPlayer(room, p.id);
      this.startRound(room, room.round % room.players.length);
    } else {
      this.broadcast(room);
    }
    return { ok: true };
  }

  backToLobby(socketId: string): Ack {
    const ctx = this.ctx(socketId);
    if (!ctx) return err('Not in a room');
    const { room, player } = ctx;
    if (room.hostId !== player.id) return err('Only the host can do that');
    if (room.status === 'lobby') return { ok: true };
    this.clearTimer(room);
    for (const p of room.players.filter((p) => !p.connected)) this.dropPlayer(room, p.id);
    room.status = 'lobby';
    room.game = null;
    room.round = 0;
    room.lastResult = null;
    for (const p of room.players) Object.assign(p, { ready: false, wantsRematch: false, score: 0 });
    this.broadcast(room);
    return { ok: true };
  }

  // ── timers / maintenance ───────────────────────────────────

  /** Periodic sweep: drop long-gone players and destroy empty rooms. */
  sweep(): void {
    const t = this.now();
    for (const room of [...this.store.all()]) {
      for (const p of [...room.players]) {
        if (p.connected || p.disconnectedAt === null) continue;
        const limit = room.status === 'lobby' ? this.config.lobbyDropAfterMs : this.config.dropAfterMs;
        if (t - p.disconnectedAt > limit) this.removeFromRoom(room, p.id);
      }
      if (this.store.get(room.code) && !room.players.some((p) => p.connected) && t - room.lastActivity > this.config.emptyRoomTtlMs) {
        this.destroy(room);
      }
    }
  }

  /** Run the scheduled auto action now (used by timers and tests). */
  runAuto(code: string): void {
    const room = this.store.get(code);
    if (!room || room.status !== 'playing' || !room.game) return;
    room.timer = null;
    room.autoActAt = null;
    const auto = autoAction(room.game);
    if (!auto) return;
    this.apply(room, auto.playerId, auto.action);
    // A forced draw that turned up a playable card leaves a pass decision — finish the turn.
    const g = room.game;
    if (g && room.status === 'playing' && g.phase === 'drawnDecision' && g.players[g.currentIndex].id === auto.playerId) {
      this.apply(room, auto.playerId, { type: 'pass' });
    }
  }

  getRoom(code: string) { return this.store.get(code); }

  // ── internals ──────────────────────────────────────────────

  private newPlayer(socketId: string, name: unknown, avatar: unknown): ServerPlayer {
    return {
      id: randomBytes(6).toString('hex'),
      token: randomBytes(18).toString('base64url'),
      name: cleanName(name),
      avatar: cleanAvatar(avatar),
      ready: false,
      connected: true,
      socketId,
      score: 0,
      wantsRematch: false,
      disconnectedAt: null,
    };
  }

  private ctx(socketId: string) {
    const ref = this.sockets.get(socketId);
    if (!ref) return null;
    const room = this.store.get(ref.code);
    const player = room?.players.find((p) => p.id === ref.playerId);
    if (!room || !player || player.socketId !== socketId) return null;
    return { room, player };
  }

  private detachSocket(socketId: string) {
    if (this.sockets.has(socketId)) this.leave(socketId);
  }

  private touch(room: Room) { room.lastActivity = this.now(); }

  private reassignHost(room: Room) {
    const next = room.players.find((p) => p.connected && p.id !== room.hostId) ?? room.players.find((p) => p.id !== room.hostId);
    if (next) room.hostId = next.id;
  }

  private startRound(room: Room, dealerIndex: number) {
    const { state, events } = createRound(room.players.map((p) => p.id), room.rng, dealerIndex);
    room.game = state;
    room.status = 'playing';
    room.round += 1;
    room.recentIntents.clear();
    for (const p of room.players) p.wantsRematch = false;
    this.touch(room);
    this.schedule(room);
    this.broadcast(room, events);
  }

  private apply(room: Room, playerId: string, action: GameAction): Ack {
    const game = room.game!;
    const result = applyAction(game, playerId, action, room.rng);
    if (!result.ok) return result;
    this.touch(room);
    if (game.phase === 'roundOver') this.endRound(room);
    else this.schedule(room);
    this.broadcast(room, result.events);
    return { ok: true };
  }

  private endRound(room: Room) {
    const game = room.game!;
    const hand = roundPoints(game);
    const winnerId = game.winnerId!;
    const pointsWon = Object.entries(hand).reduce((s, [id, v]) => (id === winnerId ? s : s + v), 0);
    const winner = room.players.find((p) => p.id === winnerId);
    if (winner) winner.score += pointsWon;
    room.lastResult = {
      round: room.round,
      winnerId,
      pointsWon,
      handPoints: hand,
      cardsLeft: Object.fromEntries(game.players.map((p) => [p.id, p.hand.length])),
    };
    room.status = 'results';
    this.clearTimer(room);
  }

  /** Decide whose input we are waiting for and arm the auto-act timer if needed. */
  private schedule(room: Room) {
    this.clearTimer(room);
    if (room.status !== 'playing' || !room.game) return;
    const g = room.game;
    const waitingOn = room.players.find((p) => p.id === g.players[g.currentIndex]?.id);
    if (!waitingOn) return;
    const delay = waitingOn.connected ? this.config.turnTimeoutMs : this.config.disconnectGraceMs;
    if (!delay) return;
    room.autoActAt = this.now() + delay;
    room.timer = setTimeout(() => this.runAuto(room.code), delay);
    room.timer.unref?.();
  }

  private clearTimer(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    room.autoActAt = null;
  }

  /** Remove a seat from the room (and the running game, if any) without broadcasting. */
  private dropPlayer(room: Room, playerId: string): GameEvent[] {
    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return [];
    const [gone] = room.players.splice(idx, 1);
    if (gone.socketId) this.sockets.delete(gone.socketId);
    room.recentIntents.delete(playerId);
    if (room.hostId === playerId && room.players.length) this.reassignHost(room);
    if (room.game && room.game.players.some((p) => p.id === playerId)) return removePlayer(room.game, playerId);
    return [];
  }

  private removeFromRoom(room: Room, playerId: string) {
    const events = this.dropPlayer(room, playerId);
    if (room.players.length === 0) return this.destroy(room);
    if (room.status === 'playing' && room.game) {
      if (room.game.phase === 'roundOver') this.endRound(room);
      else this.schedule(room);
    }
    if (room.status === 'results' && room.players.length < MIN_PLAYERS) {
      // Not enough people for a rematch; send survivors back to the lobby.
      room.status = 'lobby';
      room.game = null;
      for (const p of room.players) Object.assign(p, { ready: false, wantsRematch: false });
    }
    this.touch(room);
    this.broadcast(room, events);
  }

  private destroy(room: Room) {
    this.clearTimer(room);
    for (const p of room.players) if (p.socketId) {
      this.sockets.delete(p.socketId);
      this.transport.sendClosed(p.socketId, 'Room closed');
    }
    this.store.delete(room.code);
  }

  viewFor(room: Room, playerId: string): RoomView {
    return {
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      youId: playerId,
      round: room.round,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.id === room.hostId,
        ready: p.ready,
        connected: p.connected,
        score: p.score,
        wantsRematch: p.wantsRematch,
      })),
      game: room.game ? toGameView(room.game, playerId) : null,
      lastResult: room.lastResult,
      autoActAt: room.autoActAt,
    };
  }

  private broadcast(room: Room, events: GameEvent[] = []) {
    for (const p of room.players) {
      if (p.socketId) this.transport.sendState(p.socketId, this.viewFor(room, p.id), events);
    }
  }
}
