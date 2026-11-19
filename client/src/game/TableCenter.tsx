import { AnimatePresence, animate, motion } from 'motion/react';
import { memo, useLayoutEffect, useRef } from 'react';
import type { Card, GameEvent, GameView } from '@arcana/shared';
import { COLOR_HEX, COLOR_NAME_TH } from '../assets/manifest';
import { AssetImage } from '../components/AssetImage';
import { CardBack, CardFace } from '../components/Card';
import { anchorRect, anchorRef, seatKey, takeHandSnapshot } from '../lib/anchors';
import { sfx } from '../lib/sfx';

/** Deterministic little tilt per card so the pile looks hand-tossed. */
const tilt = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h % 21) - 10) * 1.1;
};

export const TableCenter = memo(function TableCenter({
  game,
  canDraw,
  onDraw,
  lastEvents,
  reverseKey,
}: {
  game: GameView;
  canDraw: boolean;
  onDraw: () => void;
  lastEvents: GameEvent[];
  reverseKey: number;
}) {
  const color = COLOR_HEX[game.activeColor];
  return (
    <div className="relative flex w-full items-center justify-center" style={{ height: 'calc(var(--card-h) * 1.55)' }}>
      {/* the magical table */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[38%]" style={{ width: 'min(96%, calc(var(--card-w) * 6.6))' }}>
        <AssetImage asset="bg.table" className="w-full drop-shadow-[0_30px_40px_rgba(10,6,14,.6)]" eager />
      </div>

      {/* active colour aura */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 'calc(var(--card-w) * 4.2)', height: 'calc(var(--card-w) * 2.6)', filter: 'blur(26px)' }}
        animate={{ backgroundColor: color, opacity: [0.32, 0.5, 0.32] }}
        transition={{ backgroundColor: { duration: 0.6 }, opacity: { duration: 3, repeat: Infinity } }}
      />

      {/* direction ring */}
      <DirectionRing direction={game.direction} reverseKey={reverseKey} color={color} />

      <div className="relative z-10 flex items-center gap-[calc(var(--card-w)*0.45)]">
        <DrawPile count={game.drawCount} canDraw={canDraw} onDraw={onDraw} />
        <div className="relative">
          <DiscardPile top={game.topCard} lastEvents={lastEvents} />
          {/* active colour chip */}
          <motion.div
            className="font-display absolute -bottom-9 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shadow-lg"
            animate={{ backgroundColor: color }}
            style={{ color: game.activeColor === 'yellow' ? '#302638' : '#F8E6C9' }}
          >
            <span className="h-2 w-2 rounded-full bg-current opacity-80" />
            {COLOR_NAME_TH[game.activeColor]}
          </motion.div>
        </div>
      </div>
    </div>
  );
});

function DirectionRing({ direction, reverseKey, color }: { direction: 1 | -1; reverseKey: number; color: string }) {
  return (
    <motion.div
      key={reverseKey}
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ width: 'calc(var(--card-w) * 3.9)', height: 'calc(var(--card-w) * 3.9)', marginLeft: 'calc(var(--card-w) * -1.95)', marginTop: 'calc(var(--card-w) * -1.95)' }}
      initial={reverseKey ? { scale: 1.25, opacity: 0 } : false}
      animate={{ scale: [1.25, 1], opacity: 1, rotate: direction * 360 }}
      transition={{ rotate: { duration: 26, repeat: Infinity, ease: 'linear' }, scale: { type: 'spring', stiffness: 160, damping: 12 }, opacity: { duration: 0.4 } }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="h-full w-full" style={{ transform: direction === -1 ? 'scaleX(-1)' : undefined }}>
        <ellipse cx="100" cy="100" rx="94" ry="94" fill="none" stroke={color} strokeOpacity=".28" strokeWidth="2" strokeDasharray="2 10" strokeLinecap="round" />
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a} 100 100)`}>
            <path d="M98 1 l8 5 -8 5" fill="none" stroke="#F8E6C9" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
    </motion.div>
  );
}

function DrawPile({ count, canDraw, onDraw }: { count: number; canDraw: boolean; onDraw: () => void }) {
  const layers = Math.min(4, Math.max(1, Math.ceil(count / 15)));
  return (
    <motion.button
      type="button"
      ref={anchorRef('deck') as unknown as React.Ref<HTMLButtonElement>}
      onClick={() => canDraw && onDraw()}
      disabled={!canDraw}
      aria-label={`กองจั่ว (${count} ใบ)`}
      className="relative"
      whileHover={canDraw ? { y: -6, rotate: -2 } : undefined}
      whileTap={canDraw ? { scale: 0.94 } : undefined}
      onPointerEnter={() => canDraw && sfx('hover')}
    >
      {Array.from({ length: layers }).map((_, i) => (
        <div key={i} className="absolute left-0 top-0" style={{ transform: `translate(${-i * 2}px, ${i * 2.5}px)` }}>
          <CardBack style={{ filter: `brightness(${1 - i * 0.12})` }} />
        </div>
      ))}
      <CardBack className="relative" />
      {canDraw && (
        <motion.div
          className="absolute -inset-2 rounded-[16%]"
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ boxShadow: '0 0 0 3px rgb(241 183 79 / .7), 0 0 24px 6px rgb(241 183 79 / .45)' }}
        />
      )}
      <span className="font-display absolute -bottom-2 -right-2 rounded-full bg-plum/90 px-2 py-0.5 text-[11px] text-cream/80 shadow">{count}</span>
    </motion.button>
  );
}

function DiscardPile({ top, lastEvents }: { top: Card | null; lastEvents: GameEvent[] }) {
  // Keep a short visual history so the pile has depth.
  const history = useRef<Card[]>([]);
  const firstRender = useRef(true);
  if (top && history.current[history.current.length - 1]?.id !== top.id) {
    history.current = [...history.current.filter((c) => c.id !== top.id), top].slice(-5);
  }
  const visible = history.current;
  const animateIn = !firstRender.current;
  useLayoutEffect(() => {
    firstRender.current = false;
  }, []);

  return (
    <div ref={anchorRef('discard')} className="relative" style={{ width: 'var(--card-w)', height: 'var(--card-h)' }} aria-label="กองทิ้ง">
      {visible.map((card, i) => (
        <PileCard key={card.id} card={card} isTop={i === visible.length - 1} depth={visible.length - 1 - i} animateIn={animateIn && i === visible.length - 1} lastEvents={lastEvents} />
      ))}
    </div>
  );
}

function PileCard({ card, isTop, depth, animateIn, lastEvents }: { card: Card; isTop: boolean; depth: number; animateIn: boolean; lastEvents: GameEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const rot = tilt(card.id);

  // FLIP: start the card exactly where it was (hand card, opponent seat or deck) and fly it here.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !animateIn) return;
    const target = el.getBoundingClientRect();
    const tcx = target.left + target.width / 2;
    const tcy = target.top + target.height / 2;
    let src: { cx: number; cy: number; scale: number; rotate: number } | null = null;

    const mine = takeHandSnapshot(card.id);
    if (mine) {
      src = { cx: mine.rect.left + mine.rect.width / 2, cy: mine.rect.top + mine.rect.height / 2, scale: mine.rect.width / target.width, rotate: mine.rotate };
    } else {
      const play = lastEvents.find((e) => e.kind === 'play' && e.card.id === card.id) as Extract<GameEvent, { kind: 'play' }> | undefined;
      const r = play ? anchorRect(seatKey(play.playerId)) : anchorRect('deck');
      if (r) src = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, scale: 0.45, rotate: -40 };
    }
    if (!src) return;
    const dx = src.cx - tcx;
    const dy = src.cy - tcy;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${src.rotate}deg) scale(${src.scale})`;
    const flight = animate(
      el,
      { x: [dx, dx * 0.15, 0], y: [dy, dy * 0.15 - 30, 0], rotate: [src.rotate, rot + 14, rot], scale: [src.scale, 1.18, 1] },
      { duration: 0.5, ease: [0.22, 1, 0.36, 1], times: [0, 0.7, 1] },
    );
    flight.then(() => {
      if (!ref.current) return;
      // soft landing squash
      void animate(ref.current, { scaleY: [1, 0.92, 1.03, 1], scaleX: [1, 1.05, 0.98, 1] }, { duration: 0.32 });
    });
    return () => flight.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-0"
      style={{ transform: `rotate(${rot}deg)`, zIndex: 10 - depth, filter: isTop ? 'drop-shadow(0 10px 14px rgba(10,6,14,.55))' : `brightness(${0.85 - depth * 0.06})` }}
    >
      <CardFace card={card} />
    </div>
  );
}

/** "Your turn" / "X's turn" banner above the table. */
export function TurnBanner({ text, mine }: { text: string; mine: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ y: -14, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24 }}
        className="font-display whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg sm:text-base"
        style={{ background: mine ? '#F1B74F' : 'rgb(48 38 56 / .8)', color: mine ? '#302638' : '#F8E6C9' }}
        role="status"
      >
        {text}
      </motion.div>
    </AnimatePresence>
  );
}
