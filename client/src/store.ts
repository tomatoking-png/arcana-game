import { create } from 'zustand';
import type { AvatarId, GameAction, GameEvent, RoomView, SessionInfo } from '@arcana/shared';
import { friendlyError, newIntentId, request, socket } from './lib/net';
import { setSoundEnabled, sfx } from './lib/sfx';

export type Connection = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface Toast {
  id: number;
  tone: 'info' | 'warn' | 'error' | 'magic';
  message: string;
}

interface Settings {
  sound: boolean;
  reducedMotion: boolean;
}

interface Store {
  connection: Connection;
  session: SessionInfo | null;
  profile: { name: string; avatar: AvatarId };
  settings: Settings;
  room: RoomView | null;
  /** Batches of server-confirmed events, consumed by the effects layer. */
  batches: { id: number; events: GameEvent[]; room: RoomView }[];
  toasts: Toast[];
  busy: boolean;
  /** An intent is in flight — prevents double-sends from rapid taps. */
  pending: boolean;

  init(): void;
  setProfile(p: Partial<Store['profile']>): void;
  setSettings(s: Partial<Settings>): void;
  toast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;

  createRoom(): Promise<boolean>;
  joinRoom(code: string): Promise<boolean>;
  leaveRoom(): Promise<void>;
  setReady(ready: boolean): Promise<void>;
  startGame(): Promise<void>;
  act(action: GameAction): Promise<boolean>;
  rematch(want: boolean): Promise<void>;
  backToLobby(): Promise<void>;
}

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode etc. */
    }
  },
};

// Session is per tab (sessionStorage) so two windows on one machine can be two players,
// with a localStorage copy so closing & reopening the tab can still rejoin.
const loadSession = (): SessionInfo | null => {
  try {
    const s = sessionStorage.getItem('arcana.session');
    if (s) return JSON.parse(s);
  } catch {
    /* ignore */
  }
  return LS.get<SessionInfo | null>('arcana.session', null);
};
const saveSession = (s: SessionInfo | null) => {
  try {
    if (s) sessionStorage.setItem('arcana.session', JSON.stringify(s));
    else sessionStorage.removeItem('arcana.session');
  } catch {
    /* ignore */
  }
  LS.set('arcana.session', s);
};

const randomName = () => {
  const a = ['Moon', 'Ember', 'Sage', 'Hazel', 'Nyx', 'Willow', 'Pip', 'Juniper', 'Rune', 'Clover'];
  return `${a[Math.floor(Math.random() * a.length)]}${Math.floor(Math.random() * 90 + 10)}`;
};

let toastId = 1;
let batchId = 1;

export const useGame = create<Store>((set, get) => ({
  connection: 'connecting',
  session: loadSession(),
  profile: LS.get('arcana.profile', { name: randomName(), avatar: 'witch' as AvatarId }),
  settings: LS.get('arcana.settings', { sound: true, reducedMotion: false }),
  room: null,
  batches: [],
  toasts: [],
  busy: false,
  pending: false,

  init() {
    setSoundEnabled(get().settings.sound);
    const resume = async () => {
      const s = get().session;
      if (!s) return;
      const r = await request('session:resume', s);
      if (!r.ok) {
        saveSession(null);
        set({ session: null, room: null });
      }
    };
    socket.on('connect', () => {
      set({ connection: 'online' });
      void resume();
    });
    socket.on('disconnect', () => set({ connection: 'reconnecting', pending: false }));
    socket.io.on('reconnect_attempt', () => set({ connection: 'reconnecting' }));
    socket.on('connect_error', () => set({ connection: get().room || get().session ? 'reconnecting' : 'offline' }));
    socket.on('room:state', ({ room, events }) => {
      const prev = get().room;
      set((s) => ({
        room,
        batches: events.length ? [...s.batches.slice(-12), { id: batchId++, events, room }] : s.batches,
      }));
      if (prev?.game && room.game && prev.game.currentPlayerId !== room.youId && room.game.currentPlayerId === room.youId && room.game.phase !== 'roundOver') {
        sfx('turn');
      }
    });
    socket.on('room:closed', ({ reason }) => {
      saveSession(null);
      set({ session: null, room: null });
      get().toast(reason === 'Opened in another window' ? 'เปิดเกมนี้ในหน้าต่างอื่นแล้ว' : 'ห้องถูกปิดแล้ว', 'warn');
    });
    socket.on('toast', ({ tone, message }) => get().toast(message, tone));
    socket.connect();
  },

  setProfile(p) {
    const profile = { ...get().profile, ...p };
    LS.set('arcana.profile', profile);
    set({ profile });
    if (get().room?.status === 'lobby') void request('lobby:profile', p);
  },

  setSettings(s) {
    const settings = { ...get().settings, ...s };
    LS.set('arcana.settings', settings);
    setSoundEnabled(settings.sound);
    set({ settings });
  },

  toast(message, tone = 'info') {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 3200 : 2600);
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  async createRoom() {
    set({ busy: true });
    const { name, avatar } = get().profile;
    const r = await request<{ session: SessionInfo }>('room:create', { name, avatar });
    set({ busy: false });
    if (!r.ok) {
      get().toast(friendlyError(r.error), 'error');
      return false;
    }
    saveSession(r.session);
    set({ session: r.session });
    return true;
  },

  async joinRoom(code) {
    set({ busy: true });
    const { name, avatar } = get().profile;
    const r = await request<{ session: SessionInfo }>('room:join', { code, name, avatar });
    set({ busy: false });
    if (!r.ok) {
      get().toast(friendlyError(r.error), 'error');
      sfx('error');
      return false;
    }
    saveSession(r.session);
    set({ session: r.session });
    return true;
  },

  async leaveRoom() {
    await request('room:leave');
    saveSession(null);
    set({ session: null, room: null, batches: [] });
  },

  async setReady(ready) {
    const r = await request('lobby:ready', { ready });
    if (!r.ok) get().toast(friendlyError(r.error), 'error');
  },

  async startGame() {
    const r = await request('lobby:start');
    if (!r.ok) {
      get().toast(friendlyError(r.error), 'warn');
      sfx('error');
    }
  },

  async act(action) {
    if (get().pending) return false;
    set({ pending: true });
    const r = await request('game:action', { intentId: newIntentId(), action });
    set({ pending: false });
    if (!r.ok) {
      get().toast(friendlyError(r.error), 'warn');
      sfx('error');
      return false;
    }
    return true;
  },

  async rematch(want) {
    const r = await request('results:rematch', { want });
    if (!r.ok) get().toast(friendlyError(r.error), 'warn');
  },

  async backToLobby() {
    const r = await request('results:lobby');
    if (!r.ok) get().toast(friendlyError(r.error), 'warn');
  },
}));
