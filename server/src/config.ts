import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export interface ServerConfig {
  port: number;
  /** Allowed browser origins for CORS / Socket.IO. "*" allows any. */
  corsOrigins: string[] | '*';
  /** Folder with the built client. Served when present (single-service deploy). */
  staticDir: string;
  /** How long to wait for a disconnected player before the server acts for them. */
  disconnectGraceMs: number;
  /** Auto-act for a connected but idle player after this long. 0 disables. */
  turnTimeoutMs: number;
  /** Remove a disconnected player from a running game after this long. */
  dropAfterMs: number;
  /** Remove a disconnected player from a lobby after this long. */
  lobbyDropAfterMs: number;
  /** Destroy rooms with nobody connected after this long. */
  emptyRoomTtlMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origins = (env.CORS_ORIGIN ?? '*').trim();
  return {
    port: num(env.PORT, 3001),
    corsOrigins: origins === '*' ? '*' : origins.split(',').map((s) => s.trim()).filter(Boolean),
    staticDir: env.STATIC_DIR ?? path.resolve(here, '../../client/dist'),
    disconnectGraceMs: num(env.DISCONNECT_GRACE_MS, 15_000),
    turnTimeoutMs: num(env.TURN_TIMEOUT_MS, 60_000),
    dropAfterMs: num(env.DROP_AFTER_MS, 180_000),
    lobbyDropAfterMs: num(env.LOBBY_DROP_AFTER_MS, 60_000),
    emptyRoomTtlMs: num(env.EMPTY_ROOM_TTL_MS, 600_000),
  };
}
