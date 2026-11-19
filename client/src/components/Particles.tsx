import { motion } from 'motion/react';
import { useMemo } from 'react';
import { IconSparkle } from './Icons';

/** Radial burst of little sparkle stars. Mount it with a fresh key to replay. */
export function SparkleBurst({
  x,
  y,
  count = 10,
  radius = 70,
  colors = ['#F1B74F', '#F8E6C9', '#c7a6d6'],
  size = 14,
  duration = 0.7,
}: {
  x: number;
  y: number;
  count?: number;
  radius?: number;
  colors?: string[];
  size?: number;
  duration?: number;
}) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const r = radius * (0.6 + Math.random() * 0.6);
        return { dx: Math.cos(a) * r, dy: Math.sin(a) * r, color: colors[i % colors.length], s: size * (0.6 + Math.random() * 0.8), rot: Math.random() * 180 };
      }),
    [count, radius, colors, size],
  );
  return (
    <div className="pointer-events-none fixed" style={{ left: x, top: y }} aria-hidden>
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ color: p.color, left: -p.s / 2, top: -p.s / 2 }}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
          animate={{ x: p.dx, y: p.dy, scale: [0.2, 1.2, 0], opacity: [1, 1, 0], rotate: p.rot }}
          transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
        >
          <IconSparkle size={p.s} />
        </motion.span>
      ))}
    </div>
  );
}

/** Expanding soft ring (UNO, reverse, colour change). */
export function MagicRing({ x, y, color = '#F1B74F', size = 160, duration = 0.8, width = 6 }: { x: number; y: number; color?: string; size?: number; duration?: number; width?: number }) {
  return (
    <motion.div
      className="pointer-events-none fixed rounded-full"
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size, boxShadow: `0 0 0 ${width}px ${color}, 0 0 30px 8px ${color}88` }}
      initial={{ scale: 0.2, opacity: 0.9 }}
      animate={{ scale: 1.25, opacity: 0 }}
      transition={{ duration, ease: 'easeOut' }}
      aria-hidden
    />
  );
}
