import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@arcana/shared';

export type ArcanaSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function serverUrl(): string | undefined {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  // Dev: talk to the server on the same host (works for phones on your LAN).
  if (import.meta.env.DEV) return `${location.protocol}//${location.hostname}:3001`;
  return undefined; // production default: same origin
}

export const socket: ArcanaSocket = io(serverUrl() ?? '', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
});

/** Emit with an acknowledgement, resolved as a Promise with a timeout. */
export function request<T = {}>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<Ack<T>> {
  return new Promise((resolve) => {
    if (!socket.connected) return resolve({ ok: false, error: 'offline' });
    const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), 8000);
    (socket.emit as (...a: unknown[]) => void)(event, ...args, (res: Ack<T>) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

let counter = 0;
export const newIntentId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Translate server errors into friendly Thai. */
const ERRORS: Record<string, string> = {
  offline: 'ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์',
  timeout: 'เซิร์ฟเวอร์ตอบช้า ลองอีกครั้ง',
  'Room not found — check the code': 'ไม่พบห้องนี้ ลองตรวจรหัสอีกครั้ง',
  'That game has already started': 'ห้องนี้เริ่มเกมไปแล้ว',
  'Room is full': 'ห้องเต็มแล้ว',
  'Session expired': 'เซสชันหมดอายุ',
  'Only the host can start': 'เฉพาะหัวห้องเท่านั้นที่เริ่มเกมได้',
  'Need at least 2 players': 'ต้องมีผู้เล่นอย่างน้อย 2 คน',
  'Everyone must be ready': 'รอให้ทุกคนกดพร้อมก่อน',
  'Waiting for a disconnected player': 'รอผู้เล่นที่หลุดการเชื่อมต่อ',
  'Not your turn': 'ยังไม่ถึงตาคุณ',
  'That card does not match': 'การ์ดใบนี้ลงไม่ได้',
  'You may only play the card you just drew': 'ลงได้เฉพาะใบที่เพิ่งจั่ว',
  'Choose a colour': 'เลือกสีก่อน',
  'You cannot draw right now': 'ตอนนี้จั่วไม่ได้',
  'Nothing to catch': 'ไม่มีใครให้จับ',
  'Already declared': 'ประกาศไปแล้ว',
  'You can only call UNO with two cards on your turn, or right after going to one': 'ประกาศ UNO ได้เมื่อเหลือ 2 ใบในตาตัวเอง หรือทันทีหลังเหลือ 1 ใบ',
  'Only the host can do that': 'เฉพาะหัวห้องเท่านั้น',
};
export const friendlyError = (e: string) => ERRORS[e] ?? e;
