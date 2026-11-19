import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  isPlayable,
  type ClientToServerEvents,
  type GameEvent,
  type RoomView,
  type ServerToClientEvents,
  type SessionInfo,
} from '@arcana/shared';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

type C = Socket<ServerToClientEvents, ClientToServerEvents>;

const config = { ...loadConfig({}), port: 0, staticDir: '/nonexistent', disconnectGraceMs: 300, turnTimeoutMs: 0 };
const app = createApp(config);
let url = '';

beforeAll(async () => {
  await new Promise<void>((r) => app.http.listen(0, r));
  url = `http://localhost:${(app.http.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await app.close();
  app.http.close();
});

/** A test client that remembers the latest state it received. */
function client() {
  const s: C = connect(url, { transports: ['websocket'], forceNew: true });
  const box = { s, room: null as RoomView | null, events: [] as GameEvent[], raw: [] as string[] };
  s.on('room:state', (p) => {
    box.room = p.room;
    box.events.push(...p.events);
    box.raw.push(JSON.stringify(p));
  });
  return box;
}
type Client = ReturnType<typeof client>;
const emit = <T = any>(c: Client, ev: string, ...args: unknown[]) =>
  new Promise<T>((resolve) => (c.s.emit as any)(ev, ...args, resolve));
const until = async (fn: () => boolean, ms = 2000) => {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 10));
  }
};

async function startTwoPlayerGame() {
  const a = client();
  const b = client();
  const created = await emit<{ ok: true; session: SessionInfo }>(a, 'room:create', { name: 'Ada', avatar: 'witch' });
  expect(created.ok).toBe(true);
  const joined = await emit<{ ok: true; session: SessionInfo }>(b, 'room:join', { code: created.session.code.toLowerCase(), name: 'Bo', avatar: 'witch' });
  expect(joined.ok).toBe(true);
  expect((await emit(b, 'lobby:ready', { ready: true })).ok).toBe(true);
  expect((await emit(a, 'lobby:start')).ok).toBe(true);
  await until(() => a.room?.status === 'playing' && b.room?.status === 'playing');
  return { a, b, sa: created.session, sb: joined.session };
}

describe('room flow', () => {
  it('create → join → ready → start deals 7 each and hides other hands', async () => {
    const { a, b } = await startTwoPlayerGame();
    const ga = a.room!.game!;
    const gb = b.room!.game!;
    // joiner got a different avatar automatically
    expect(new Set(a.room!.players.map((p) => p.avatar)).size).toBe(2);
    // each sees only their own hand
    expect(ga.myHand.length).toBeGreaterThanOrEqual(7);
    expect(gb.myHand.length).toBeGreaterThanOrEqual(7);
    const payloadA = a.raw.join('\n');
    for (const c of gb.myHand) expect(payloadA).not.toContain(`"${c.id}"`);
    const payloadB = b.raw.join('\n');
    for (const c of ga.myHand) expect(payloadB).not.toContain(`"${c.id}"`);
    a.s.close();
    b.s.close();
  });

  it('rejects joining an unknown room and starting without ready players', async () => {
    const a = client();
    expect((await emit(a, 'room:join', { code: 'ZZZZZ', name: 'x', avatar: 'witch' })).ok).toBe(false);
    await emit(a, 'room:create', { name: 'Ada', avatar: 'witch' });
    expect((await emit(a, 'lobby:start')).ok).toBe(false); // alone
    const b = client();
    await emit(b, 'room:join', { code: a.room!.code, name: 'Bo', avatar: 'cleric' });
    expect((await emit(a, 'lobby:start')).ok).toBe(false); // b not ready
    expect((await emit(b, 'lobby:start')).ok).toBe(false); // not host
    a.s.close();
    b.s.close();
  });
});

describe('server-side move rejection', () => {
  it('rejects out-of-turn moves, foreign cards and unknown cards', async () => {
    const { a, b } = await startTwoPlayerGame();
    const g = a.room!.game!;
    const [cur, other] = g.currentPlayerId === a.room!.youId ? [a, b] : [b, a];
    const v0 = cur.room!.game!.version;
    // not your turn
    const r1 = await emit(other, 'game:action', { intentId: 'x1', action: { type: 'draw' } });
    expect(r1.ok).toBe(false);
    // a card that isn't yours (taken from the other player's own view)
    const foreign = other.room!.game!.myHand[0].id;
    const r2 = await emit(cur, 'game:action', { intentId: 'x2', action: { type: 'play', cardId: foreign } });
    expect(r2.ok).toBe(false);
    // forged card
    const r3 = await emit(cur, 'game:action', { intentId: 'x3', action: { type: 'play', cardId: 'wild4-99', chosenColor: 'red' } });
    expect(r3.ok).toBe(false);
    // garbage
    const r4 = await emit(cur, 'game:action', { intentId: 'x4', action: null });
    expect(r4.ok).toBe(false);
    expect(cur.room!.game!.version).toBe(v0);
    a.s.close();
    b.s.close();
  });

  it('ignores a duplicated intent', async () => {
    const { a, b } = await startTwoPlayerGame();
    // Resolve an opening wild if needed.
    const g0 = a.room!.game!;
    const cur = g0.currentPlayerId === a.room!.youId ? a : b;
    if (g0.phase === 'chooseColor') await emit(cur, 'game:action', { intentId: 'cc', action: { type: 'chooseColor', color: 'red' } });
    await until(() => cur.room!.game!.phase === 'turn');
    const before = cur.room!.game!.myHand.length;
    const r1 = await emit(cur, 'game:action', { intentId: 'dup', action: { type: 'draw' } });
    const r2 = await emit(cur, 'game:action', { intentId: 'dup', action: { type: 'draw' } });
    expect(r1.ok && r2.ok).toBe(true);
    await until(() => cur.room!.game!.myHand.length === before + 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(cur.room!.game!.myHand.length).toBe(before + 1);
    a.s.close();
    b.s.close();
  });
});

describe('reconnection', () => {
  it('a player can resume their seat and hand with the session token', async () => {
    const { a, b, sb } = await startTwoPlayerGame();
    const handBefore = b.room!.game!.myHand.map((c) => c.id).sort();
    b.s.close();
    await until(() => a.room!.players.find((p) => p.id === sb.playerId)?.connected === false);

    const b2 = client();
    expect((await emit(b2, 'session:resume', { ...sb, token: 'wrong' })).ok).toBe(false);
    expect((await emit(b2, 'session:resume', sb)).ok).toBe(true);
    await until(() => !!b2.room?.game);
    // Same seat, same cards (we resumed well inside the grace period, so nothing auto-played).
    expect(b2.room!.youId).toBe(sb.playerId);
    expect(b2.room!.game!.myHand.map((c) => c.id).sort()).toEqual(handBefore);
    await until(() => a.room!.players.find((p) => p.id === sb.playerId)?.connected === true);
    a.s.close();
    b2.s.close();
  });

  it('the server plays for a disconnected current player after the grace period', async () => {
    const { a, b, sa, sb } = await startTwoPlayerGame();
    const g = a.room!.game!;
    const [gone, stay, goneId] = g.currentPlayerId === sa.playerId ? [a, b, sa.playerId] : [b, a, sb.playerId];
    const v = stay.room!.game!.version;
    gone.s.close();
    await until(() => stay.room!.game!.version > v && stay.room!.game!.currentPlayerId !== goneId, 3000);
    expect(stay.room!.players.find((p) => p.id === goneId)?.connected).toBe(false);
    stay.s.close();
  });
});

describe('full round over the network', () => {
  it('two clients can play a round to completion and rematch', async () => {
    const { a, b } = await startTwoPlayerGame();
    const clients = [a, b];
    let n = 0;
    while (a.room!.status === 'playing' && n++ < 2000) {
      const g = a.room!.game!;
      const cur = clients.find((c) => c.room!.youId === g.currentPlayerId)!;
      await until(() => cur.room!.game!.version === g.version);
      const cg = cur.room!.game!;
      const id = () => `i${n}-${Math.random()}`;
      let action: any;
      if (cg.phase === 'chooseColor') action = { type: 'chooseColor', color: 'blue' };
      else if (cg.phase === 'challenge') action = { type: n % 2 ? 'challenge' : 'acceptDraw4' };
      else if (cg.phase === 'drawnDecision') action = { type: 'play', cardId: cg.drawnCardId, chosenColor: 'green' };
      else {
        if (cg.myHand.length === 2) await emit(cur, 'game:action', { intentId: id(), action: { type: 'callUno' } });
        const card = cg.myHand.find((c) => isPlayable(c, cg.topCard, cg.activeColor));
        action = card ? { type: 'play', cardId: card.id, chosenColor: 'yellow' } : { type: 'draw' };
      }
      const r = await emit(cur, 'game:action', { intentId: id(), action });
      expect(r).toEqual({ ok: true });
      await until(() => a.room!.game!.version > g.version || a.room!.status !== 'playing');
    }
    expect(a.room!.status).toBe('results');
    expect(a.room!.lastResult?.winnerId).toBeTruthy();
    const winner = a.room!.players.find((p) => p.id === a.room!.lastResult!.winnerId)!;
    expect(winner.score).toBe(a.room!.lastResult!.pointsWon);
    expect(a.events.some((e) => e.kind === 'roundOver')).toBe(true);

    await emit(a, 'results:rematch', { want: true });
    await emit(b, 'results:rematch', { want: true });
    await until(() => a.room!.status === 'playing' && a.room!.round === 2);
    a.s.close();
    b.s.close();
  }, 20_000);
});
