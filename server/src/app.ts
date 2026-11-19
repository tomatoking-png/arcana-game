import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@arcana/shared';
import type { ServerConfig } from './config';
import { RoomManager } from './rooms';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
};

/** Serve the built client when it exists, so one Node process can host everything. */
function staticHandler(dir: string) {
  const enabled = existsSync(path.join(dir, 'index.html'));
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    if (!enabled || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.normalize(path.join(dir, url));
    if (!file.startsWith(dir)) return false;
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': url.startsWith('/assets/') && ext !== '.html' ? 'public, max-age=86400' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
    return true;
  };
}

export function createApp(config: ServerConfig) {
  const serveStatic = staticHandler(config.staticDir);
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
      return;
    }
    if (serveStatic(req, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('ARCANA server is running. Open the client to play.');
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(http, {
    cors: { origin: config.corsOrigins === '*' ? true : config.corsOrigins, credentials: true },
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: undefined,
  });

  const rooms = new RoomManager(config, {
    sendState: (sid, room, events) => io.to(sid).emit('room:state', { room, events }),
    sendClosed: (sid, reason) => io.to(sid).emit('room:closed', { reason }),
  });

  const safe = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => {
    try {
      fn(...args);
    } catch (e) {
      console.error('[socket] handler error', e);
      const ack = args[args.length - 1];
      if (typeof ack === 'function') ack({ ok: false, error: 'Server error' });
    }
  };
  const reply = (ack: unknown, value: unknown) => {
    if (typeof ack === 'function') ack(value);
  };

  io.on('connection', (socket) => {
    socket.on('room:create', safe((p, ack) => reply(ack, rooms.create(socket.id, p?.name, p?.avatar))));
    socket.on('room:join', safe((p, ack) => reply(ack, rooms.join(socket.id, p?.code, p?.name, p?.avatar))));
    socket.on('session:resume', safe((p, ack) => reply(ack, rooms.resume(socket.id, p))));
    socket.on('room:leave', safe((ack) => reply(ack, rooms.leave(socket.id))));
    socket.on('lobby:ready', safe((p, ack) => reply(ack, rooms.setReady(socket.id, !!p?.ready))));
    socket.on('lobby:profile', safe((p, ack) => reply(ack, rooms.setProfile(socket.id, p?.name, p?.avatar))));
    socket.on('lobby:start', safe((ack) => reply(ack, rooms.start(socket.id))));
    socket.on('game:action', safe((p, ack) => reply(ack, rooms.action(socket.id, p?.intentId, p?.action))));
    socket.on('results:rematch', safe((p, ack) => reply(ack, rooms.rematch(socket.id, !!p?.want))));
    socket.on('results:lobby', safe((ack) => reply(ack, rooms.backToLobby(socket.id))));
    socket.on('disconnect', () => rooms.disconnect(socket.id));
  });

  const sweeper = setInterval(() => rooms.sweep(), 5_000);
  sweeper.unref();

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweeper);
        io.close(() => resolve());
      }),
  };
}
