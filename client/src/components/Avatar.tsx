import { motion } from 'motion/react';
import type { AvatarId } from '@arcana/shared';
import { avatarKey } from '../assets/manifest';
import { AssetImage } from './AssetImage';

const RING: Record<AvatarId, string> = {
  witch: '#E97870',
  tinkerer: '#F1B74F',
  cleric: '#89A98B',
  catfolk: '#74A8CB',
};
export const avatarColor = (a: AvatarId) => RING[a];

/** Round portrait with a soft breathing glow when it is this player's turn. */
export function Avatar({
  avatar,
  size = 56,
  active = false,
  dim = false,
  bounceKey,
}: {
  avatar: AvatarId;
  size?: number;
  active?: boolean;
  dim?: boolean;
  /** Changing this value plays a little bounce (e.g. on UNO). */
  bounceKey?: number;
}) {
  const color = RING[avatar];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {active && (
        <motion.div
          className="absolute rounded-full"
          style={{ inset: -size * 0.14, background: `radial-gradient(circle, ${color}cc 0%, ${color}55 45%, transparent 72%)` }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.div
        key={bounceKey}
        className="relative h-full w-full"
        initial={bounceKey ? { scale: 1, y: 0 } : false}
        animate={bounceKey ? { scale: [1, 1.18, 0.94, 1.04, 1], y: [0, -8, 0, -2, 0] } : undefined}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ filter: dim ? 'grayscale(.7) brightness(.7)' : undefined }}
      >
        <AssetImage asset={avatarKey(avatar)} className="h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(10,6,14,.45)]" eager />
      </motion.div>
    </div>
  );
}
