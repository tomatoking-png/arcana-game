import { animate, motion } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isPlayable, type Card, type GameView } from '@arcana/shared';
import { CardFace, describeCard } from '../components/Card';
import { anchorRect, anchorRef, snapshotHandCard } from '../lib/anchors';
import { sfx } from '../lib/sfx';

const COLOR_ORDER = { red: 0, yellow: 1, green: 2, blue: 3 } as const;
const TYPE_ORDER = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 } as const;
export const sortHand = (hand: Card[]) =>
  [...hand].sort((a, b) => {
    const ca = a.color ? COLOR_ORDER[a.color] : 9;
    const cb = b.color ? COLOR_ORDER[b.color] : 9;
    return ca - cb || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || (a.value ?? 0) - (b.value ?? 0) || a.id.localeCompare(b.id);
  });

interface Slot {
  x: number;
  y: number;
  rotate: number;
}

/** Compute fan positions. Falls back to a flat scrollable strip when space is tight. */
function layoutHand(n: number, width: number, cardW: number): { slots: Slot[]; scroll: boolean; innerWidth: number } {
  if (n === 0) return { slots: [], scroll: false, innerWidth: width };
  const maxStep = cardW * 0.66;
  const fit = n > 1 ? (width - cardW - 16) / (n - 1) : maxStep;
  const scroll = fit < cardW * 0.3;
  const step = scroll ? cardW * 0.46 : Math.min(maxStep, fit);
  const total = cardW + step * (n - 1);
  const start = scroll ? 12 : (width - total) / 2;
  const mid = (n - 1) / 2;
  const spread = scroll ? 0 : Math.min(3.2, 26 / Math.max(n, 1));
  const slots = Array.from({ length: n }, (_, i) => {
    const d = i - mid;
    return { x: start + i * step, y: scroll ? 10 : Math.abs(d) ** 1.6 * (cardW * 0.018) + 10, rotate: d * spread };
  });
  return { slots, scroll, innerWidth: scroll ? total + 24 : width };
}

export function Hand({
  game,
  selectedId,
  onSelect,
  onPlay,
  myTurn,
}: {
  game: GameView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPlay: (card: Card) => void;
  myTurn: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState<{ w: number; cardW: number } | null>(null);
  const known = useRef<Set<string> | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const measure = () => setDims({ w: host.clientWidth, cardW: probeRef.current!.getBoundingClientRect().width });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const cards = useMemo(() => sortHand(game.myHand), [game.myHand]);
  const layout = useMemo(() => (dims ? layoutHand(cards.length, dims.w, dims.cardW) : null), [cards.length, dims]);

  // Work out where the deck is relative to this hand so new cards fly in from it.
  const deckOrigin = (() => {
    const deck = anchorRect('deck');
    const host = hostRef.current?.getBoundingClientRect();
    if (!deck || !host) return null;
    return { x: deck.left - host.left + (hostRef.current?.scrollLeft ?? 0), y: deck.top - host.top };
  })();

  // Which cards are new since last render (drawn or dealt)?
  const newIds: string[] = [];
  if (layout) {
    if (!known.current) known.current = new Set();
    for (const c of cards) if (!known.current.has(c.id)) newIds.push(c.id);
  }
  useEffect(() => {
    if (layout) known.current = new Set(cards.map((c) => c.id));
  });
  useEffect(() => {
    if (newIds.length) newIds.forEach((_, i) => setTimeout(() => sfx('draw'), i * 90));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newIds.join(',')]);

  const top = game.topCard;
  const drawnOnly = game.phase === 'drawnDecision' ? game.drawnCardId : null;

  // Keep the selected card scrolled into view on narrow screens.
  useEffect(() => {
    if (!layout?.scroll || !selectedId) return;
    const i = cards.findIndex((c) => c.id === selectedId);
    const host = hostRef.current;
    if (host && i >= 0) host.scrollTo({ left: layout.slots[i].x - host.clientWidth / 2 + (dims?.cardW ?? 0) / 2, behavior: 'smooth' });
  }, [selectedId, layout, cards, dims]);

  return (
    <div
      ref={hostRef}
      className={`relative w-full ${layout?.scroll ? 'overflow-x-auto overflow-y-hidden no-scrollbar' : 'overflow-visible'}`}
      style={{ height: 'calc(var(--card-h) + 34px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div ref={probeRef} className="pointer-events-none invisible absolute" style={{ width: 'var(--card-w)', height: 1 }} />
      <div className="relative h-full" style={{ width: layout?.innerWidth ?? '100%' }}>
        {layout &&
          cards.map((card, i) => {
            const playable = myTurn && (game.phase === 'turn' || game.phase === 'drawnDecision') && (!drawnOnly || drawnOnly === card.id) && isPlayable(card, top, game.activeColor);
            const newIndex = newIds.indexOf(card.id);
            return (
              <HandCard
                key={card.id}
                card={card}
                slot={layout.slots[i]}
                z={i}
                from={newIndex >= 0 && deckOrigin ? { ...deckOrigin, delay: newIndex * 0.085 } : null}
                selected={selectedId === card.id}
                playable={playable}
                dimmed={myTurn && !playable}
                highlight={drawnOnly === card.id}
                onSelect={onSelect}
                onPlay={onPlay}
              />
            );
          })}
      </div>
    </div>
  );
}

const HandCard = memo(function HandCard({
  card,
  slot,
  z,
  from,
  selected,
  playable,
  dimmed,
  highlight,
  onSelect,
  onPlay,
}: {
  card: Card;
  slot: Slot;
  z: number;
  from: { x: number; y: number; delay: number } | null;
  selected: boolean;
  playable: boolean;
  dimmed: boolean;
  highlight: boolean;
  onSelect: (id: string | null) => void;
  onPlay: (card: Card) => void;
}) {
  const [hover, setHover] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const lift = selected ? -30 : hover ? -18 : highlight ? -14 : 0;

  const shake = () => {
    if (btnRef.current) void animate(btnRef.current, { x: [0, -7, 7, -5, 5, 0] }, { duration: 0.35 });
  };

  const click = () => {
    if (selected) {
      if (playable) {
        snapshotHandCard(card.id, slot.rotate);
        onPlay(card);
      } else {
        shake();
        sfx('error');
      }
      return;
    }
    onSelect(card.id);
    if (playable) sfx('select');
    else shake();
  };

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ zIndex: selected ? 200 : hover ? 150 : z }}
      initial={from ? { x: from.x, y: from.y, rotate: -25, scale: 0.85, opacity: 0.4 } : false}
      animate={{ x: slot.x, y: slot.y, rotate: slot.rotate, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.9, delay: from?.delay ?? 0 }}
    >
      <motion.button
        ref={(el) => {
          btnRef.current = el;
          anchorRef(`hand:${card.id}`)(el);
        }}
        type="button"
        data-card={card.id}
        aria-label={`${describeCard(card)} · ${playable ? 'ลงได้' : 'ลงไม่ได้'}`}
        aria-pressed={selected}
        className="relative block rounded-[12%] focus-visible:outline-none"
        animate={{ y: lift, scale: selected ? 1.08 : hover ? 1.05 : 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        onHoverStart={() => {
          if (window.matchMedia('(hover: hover)').matches) {
            setHover(true);
            sfx('hover');
          }
        }}
        onHoverEnd={() => setHover(false)}
        onClick={click}
        onDoubleClick={() => {
          if (playable) {
            snapshotHandCard(card.id, slot.rotate);
            onPlay(card);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && playable) {
            e.preventDefault();
            snapshotHandCard(card.id, slot.rotate);
            onPlay(card);
          }
        }}
      >
        {/* soft shadow that grows as the card lifts */}
        <motion.div
          className="absolute inset-x-[8%] -bottom-2 h-5 rounded-full bg-black/50 blur-md"
          animate={{ opacity: lift ? 0.55 : 0.3, scaleX: lift ? 0.9 : 1, y: -lift * 0.35 }}
        />
        {/* magical selection glow */}
        {(selected || highlight || (playable && hover)) && (
          <motion.div
            layoutId={undefined}
            className="absolute -inset-2 rounded-[18%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              background: selected && !playable ? 'radial-gradient(circle, rgb(233 120 112 / .55), transparent 70%)' : 'radial-gradient(circle, rgb(241 183 79 / .65), transparent 70%)',
              filter: 'blur(6px)',
            }}
          />
        )}
        <CardFace card={card} className="relative" style={{ filter: dimmed && !selected ? 'brightness(.62) saturate(.7)' : undefined, transition: 'filter .25s' }} />
        {playable && !selected && (
          <motion.span
            className="absolute -top-1 left-1/2 h-1.5 w-1/2 -translate-x-1/2 rounded-full bg-mustard"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            style={{ boxShadow: '0 0 10px #F1B74F' }}
          />
        )}
      </motion.button>
    </motion.div>
  );
});
