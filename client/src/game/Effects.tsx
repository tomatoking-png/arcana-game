import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GameEvent, RoomView } from '@arcana/shared';
import { COLOR_HEX } from '../assets/manifest';
import { CardBack } from '../components/Card';
import { IconReverse, IconSkip, IconSparkle } from '../components/Icons';
import { MagicRing, SparkleBurst } from '../components/Particles';
import { anchorCenter, seatKey } from '../lib/anchors';
import { sfx } from '../lib/sfx';
import { useGame } from '../store';

type Fx = { id: number; node: ReactNode; ttl: number };
let fxId = 1;

/**
 * Turns server-confirmed events into short-lived visual effects.
 * Effects are purely cosmetic — they never touch game state.
 */
export function EffectsLayer({ onUno, onReverse }: { onUno: (playerId: string) => void; onReverse: () => void }) {
  const batches = useGame((s) => s.batches);
  const reduced = useGame((s) => s.settings.reducedMotion);
  const toast = useGame((s) => s.toast);
  const seen = useRef<number>(batches.length ? batches[batches.length - 1].id : 0);
  const [fx, setFx] = useState<Fx[]>([]);

  useEffect(() => {
    const fresh = batches.filter((b) => b.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    const timers: number[] = [];
    const add = (node: ReactNode, delay = 0, ttl = 1100) => {
      timers.push(
        window.setTimeout(() => {
          const id = fxId++;
          setFx((f) => [...f, { id, node, ttl }]);
          window.setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), ttl);
        }, delay),
      );
    };
    for (const b of fresh) runBatch(b.events, b.room, { add, reduced, toast, onUno, onReverse });
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden>
      <AnimatePresence>
        {fx.map((f) => (
          <motion.div key={f.id} initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {f.node}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface Ctx {
  add: (node: ReactNode, delay?: number, ttl?: number) => void;
  reduced: boolean;
  toast: (m: string, tone?: 'info' | 'warn' | 'error' | 'magic') => void;
  onUno: (id: string) => void;
  onReverse: () => void;
}

const where = (room: RoomView, playerId: string) => anchorCenter(playerId === room.youId ? 'me' : seatKey(playerId));
const nameOf = (room: RoomView, id: string) => (id === room.youId ? 'คุณ' : room.players.find((p) => p.id === id)?.name ?? '?');

function runBatch(events: GameEvent[], room: RoomView, ctx: Ctx) {
  const { add, reduced } = ctx;
  let t = 0;
  for (const e of events) {
    switch (e.kind) {
      case 'play': {
        const pile = anchorCenter('discard');
        const special = e.card.type !== 'number';
        sfx(special ? 'special' : 'play');
        if (!pile) break;
        if (e.card.type === 'wild4' && !reduced) {
          // four colours converge on the pile
          add(<Converge x={pile.x} y={pile.y} />, 0, 900);
        }
        add(<SparkleBurst x={pile.x} y={pile.y} count={reduced ? 4 : special ? 14 : 8} radius={special ? 90 : 60} />, 430, 900);
        if (e.chosenColor) {
          const c = COLOR_HEX[e.chosenColor];
          add(<MagicRing x={pile.x} y={pile.y} color={c} size={220} />, e.card.type === 'wild4' ? 700 : 450, 900);
          add(<SparkleBurst x={pile.x} y={pile.y} count={16} radius={130} colors={[c, '#F8E6C9']} size={16} />, e.card.type === 'wild4' ? 700 : 450, 1000);
        }
        t = 350;
        break;
      }
      case 'colorChosen': {
        if (events.some((x) => x.kind === 'play')) break; // already covered by the play burst
        const pile = anchorCenter('discard');
        if (pile) add(<MagicRing x={pile.x} y={pile.y} color={COLOR_HEX[e.color]} size={220} />, 0, 900);
        sfx('special');
        break;
      }
      case 'draw': {
        if (e.playerId !== room.youId) {
          const from = anchorCenter('deck');
          const to = where(room, e.playerId);
          if (from && to) {
            for (let i = 0; i < Math.min(e.count, 6); i++) {
              add(<FlyingBack from={from} to={to} />, t + i * 110, 700);
              window.setTimeout(() => sfx('draw'), t + i * 110);
            }
          }
        }
        if (e.reason === 'unoPenalty') ctx.toast(`${nameOf(room, e.playerId)} ลืมประกาศ UNO! จั่ว +${e.count}`, 'warn');
        break;
      }
      case 'skip': {
        const p = where(room, e.playerId);
        if (p) add(<SkipMark x={p.x} y={p.y} />, t + 150, 1200);
        break;
      }
      case 'reverse': {
        ctx.onReverse();
        const c = anchorCenter('discard');
        if (c && !reduced) add(<ReverseSwirl x={c.x} y={c.y} />, 200, 1100);
        break;
      }
      case 'uno': {
        sfx('uno');
        ctx.onUno(e.playerId);
        const p = where(room, e.playerId);
        if (p) {
          add(<MagicRing x={p.x} y={p.y} color="#F1B74F" size={170} />, 0, 900);
          add(<SparkleBurst x={p.x} y={p.y} count={reduced ? 5 : 18} radius={110} size={18} />, 0, 1000);
          add(<UnoWord x={p.x} y={p.y} />, 0, 1300);
        }
        break;
      }
      case 'challengeResult': {
        const success = e.success;
        ctx.toast(
          success ? `ท้าพิสูจน์สำเร็จ! ${nameOf(room, e.attackerId)} ต้องจั่ว 4 แทน` : `ท้าพิสูจน์พลาด! ${nameOf(room, e.targetId)} จั่ว 6`,
          success ? 'magic' : 'warn',
        );
        break;
      }
      case 'reshuffle':
        ctx.toast('สับกองทิ้งกลับเป็นกองจั่ว', 'info');
        break;
      case 'roundOver':
        sfx('victory');
        break;
      default:
        break;
    }
  }
}

function FlyingBack({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  return (
    <motion.div
      className="fixed left-0 top-0"
      style={{ marginLeft: 'calc(var(--card-w) * -0.43)', marginTop: 'calc(var(--card-h) * -0.5)' }}
      initial={{ x: from.x, y: from.y, rotate: 0, scale: 1, opacity: 1 }}
      animate={{ x: [from.x, (from.x + to.x) / 2, to.x], y: [from.y, Math.min(from.y, to.y) - 60, to.y], rotate: [0, -20, 12], scale: [1, 0.8, 0.35], opacity: [1, 1, 0] }}
      transition={{ duration: 0.62, ease: [0.3, 0.7, 0.4, 1] }}
    >
      <CardBack />
    </motion.div>
  );
}

function SkipMark({ x, y }: { x: number; y: number }) {
  return (
    <motion.div className="fixed text-coral" style={{ left: x - 40, top: y - 40, width: 80, height: 80 }} initial={{ scale: 0, rotate: -40, opacity: 0 }} animate={{ scale: [0, 1.25, 1, 1, 0.6], rotate: [-40, 0, 0, 0, 10], opacity: [0, 1, 1, 1, 0] }} transition={{ duration: 1.15, times: [0, 0.25, 0.4, 0.8, 1] }}>
      <div className="absolute inset-0 rounded-full bg-coral/30 blur-xl" />
      <motion.div className="absolute inset-0 rounded-full" animate={{ boxShadow: ['0 0 0 0 rgba(233,120,112,.6)', '0 0 0 22px rgba(233,120,112,0)'] }} transition={{ duration: 0.7, repeat: 1 }} />
      <IconSkip size={80} style={{ filter: 'drop-shadow(0 0 8px #E97870)', position: 'relative', color: '#F8E6C9', strokeWidth: 3 }} />
    </motion.div>
  );
}

function ReverseSwirl({ x, y }: { x: number; y: number }) {
  return (
    <motion.div className="fixed text-mustard" style={{ left: x - 70, top: y - 70, width: 140, height: 140 }} initial={{ scale: 0.4, rotate: 0, opacity: 0 }} animate={{ scale: [0.4, 1.2, 1.4], rotate: [0, 300, 540], opacity: [0, 1, 0] }} transition={{ duration: 1, ease: 'easeOut' }}>
      <IconReverse size={140} style={{ filter: 'drop-shadow(0 0 12px #F1B74F)' }} />
    </motion.div>
  );
}

function Converge({ x, y }: { x: number; y: number }) {
  const colors = ['#E97870', '#F1B74F', '#89A98B', '#74A8CB'];
  return (
    <>
      {colors.map((c, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <motion.div
            key={c}
            className="fixed rounded-full"
            style={{ left: x - 14, top: y - 14, width: 28, height: 28, background: c, boxShadow: `0 0 24px 8px ${c}` }}
            initial={{ x: Math.cos(a) * 170, y: Math.sin(a) * 170, scale: 0.4, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: [0.4, 1, 0.2], opacity: [0, 1, 0.9] }}
            transition={{ duration: 0.7, ease: [0.5, 0, 0.75, 0] }}
          />
        );
      })}
    </>
  );
}

function UnoWord({ x, y }: { x: number; y: number }) {
  return (
    <motion.div className="font-display fixed flex items-center gap-1 text-4xl font-bold text-mustard" style={{ left: x, top: y - 70, textShadow: '0 0 20px rgba(241,183,79,.8), 0 3px 0 #302638' }} initial={{ x: '-50%', scale: 0, rotate: -15 }} animate={{ scale: [0, 1.3, 1, 1, 0.8], rotate: [-15, 6, -3, 0, 0], y: [0, -10, -14, -20, -40], opacity: [1, 1, 1, 1, 0] }} transition={{ duration: 1.25 }}>
      <IconSparkle size={22} /> UNO! <IconSparkle size={22} />
    </motion.div>
  );
}
