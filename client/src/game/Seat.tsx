import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { PlayerPublicState, RoomPlayerView } from '@arcana/shared';
import { Avatar } from '../components/Avatar';
import { CardBack } from '../components/Card';
import { IconCrown, IconWifiOff } from '../components/Icons';
import { anchorRef, seatKey } from '../lib/anchors';

export function useCountdown(until: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
}

/** An opponent around the table: avatar, name, card count, fanned backs and status. */
export function OpponentSeat({
  player,
  pub,
  active,
  compact,
  bounceKey,
  canCatch,
  onCatch,
  autoActAt,
}: {
  player: RoomPlayerView;
  pub: PlayerPublicState;
  active: boolean;
  compact: boolean;
  bounceKey: number;
  canCatch: boolean;
  onCatch: () => void;
  autoActAt: number | null;
}) {
  const shown = Math.min(pub.cardCount, compact ? 5 : 8);
  const seconds = useCountdown(active && !player.connected ? autoActAt : null);
  const size = compact ? 46 : 64;

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: active ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* fanned card backs */}
      <div className="relative mb-[-10px]" style={{ height: compact ? 34 : 48, width: compact ? 70 : 104 }} aria-hidden>
        {Array.from({ length: shown }).map((_, i) => {
          const mid = (shown - 1) / 2;
          return (
            <motion.div
              key={i}
              className="absolute bottom-0 left-1/2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: Math.abs(i - mid) * 1.5, x: `calc(-50% + ${(i - mid) * (compact ? 8 : 11)}px)`, rotate: (i - mid) * 7 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{ transformOrigin: '50% 100%' }}
            >
              <CardBack scale={compact ? 0.3 : 0.42} />
            </motion.div>
          );
        })}
      </div>

      <div ref={anchorRef(seatKey(player.id))} className="relative">
        <Avatar avatar={player.avatar} size={size} active={active} dim={!player.connected} bounceKey={bounceKey} />
        {/* card count */}
        <motion.span
          key={pub.cardCount}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className="font-display absolute -bottom-1 -right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-cream px-1.5 text-sm font-bold text-plum shadow-md"
          aria-label={`${pub.cardCount} ใบ`}
        >
          {pub.cardCount}
        </motion.span>
        {player.isHost && (
          <span className="absolute -left-1 -top-1 rounded-full bg-mustard p-1 text-plum shadow" aria-label="หัวห้อง">
            <IconCrown size={11} />
          </span>
        )}
        {!player.connected && (
          <span className="absolute -right-2 -top-1 rounded-full bg-coral p-1 text-cream shadow" aria-label="หลุดการเชื่อมต่อ">
            <IconWifiOff size={12} />
          </span>
        )}
        <AnimatePresence>
          {pub.unoDeclared && pub.cardCount === 1 && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: -8 }}
              exit={{ scale: 0 }}
              className="font-display absolute -left-5 top-1/2 rounded-full bg-coral px-2 py-0.5 text-xs font-bold text-cream shadow-lg"
            >
              UNO!
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        className="font-display mt-2 max-w-[110px] truncate rounded-full px-3 py-0.5 text-xs sm:text-sm"
        style={{ background: active ? '#F8E6C9' : 'rgb(0 0 0 / .25)', color: active ? '#302638' : '#F8E6C9', transition: 'all .3s' }}
      >
        {player.name}
      </div>
      {seconds !== null && <span className="mt-1 text-[11px] text-mustard">รอกลับมา {seconds}s</span>}

      <AnimatePresence>
        {canCatch && (
          <motion.button
            type="button"
            onClick={onCatch}
            initial={{ scale: 0, y: -6 }}
            animate={{ scale: [1, 1.1, 1], y: 0 }}
            exit={{ scale: 0 }}
            transition={{ scale: { duration: 0.8, repeat: Infinity } }}
            className="font-display mt-1 rounded-full bg-mustard px-3 py-1 text-xs font-bold text-plum shadow-lg"
          >
            จับได้! +2
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
