import { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import { AssetImage } from './AssetImage';
import { IconSparkle } from './Icons';

/**
 * The magical city at dusk: gradient sky, twinkling stars, a drifting airship,
 * distant rooftops and the reference skyline. Pure decoration, pointer-events off.
 */
export const Backdrop = memo(function Backdrop({ variant = 'menu' }: { variant?: 'menu' | 'game' }) {
  const stars = useMemo(
    () =>
      Array.from({ length: variant === 'menu' ? 34 : 22 }, (_, i) => ({
        left: (i * 37.7) % 100,
        top: ((i * 23.3) % (variant === 'menu' ? 55 : 45)) + 2,
        size: 6 + ((i * 7) % 12),
        delay: (i % 9) * 0.45,
        color: i % 4 === 0 ? '#c7a6d6' : '#F1B74F',
      })),
    [variant],
  );

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {/* sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            variant === 'menu'
              ? 'radial-gradient(120% 70% at 50% 100%, #b07a83 0%, #725D79 30%, #3d3046 60%, #261d2d 100%)'
              : 'radial-gradient(120% 80% at 50% 60%, #4a3a52 0%, #302638 50%, #1d1623 100%)',
        }}
      />
      {/* moon glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: variant === 'menu' ? '14%' : '-10%',
          width: 'min(60vw, 560px)',
          height: 'min(60vw, 560px)',
          background: 'radial-gradient(circle, rgb(241 183 79 / .28) 0%, rgb(239 197 174 / .12) 35%, transparent 65%)',
        }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className="anim-twinkle absolute"
          style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s`, color: s.color }}
        >
          <IconSparkle size={s.size} />
        </span>
      ))}

      {/* shooting star */}
      <motion.div
        className="absolute"
        style={{ top: '8%', left: '-10%', width: 120 }}
        animate={{ x: ['0vw', '120vw'], y: [0, 120], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 9, ease: 'easeIn' }}
      >
        <AssetImage asset="fx.shootingStar" className="w-full rotate-[18deg] opacity-80" />
      </motion.div>

      {variant === 'menu' && (
        <motion.div
          className="absolute"
          style={{ top: '16%', width: 'clamp(90px, 12vw, 150px)' }}
          initial={{ x: '-20vw' }}
          animate={{ x: '115vw', y: [0, -10, 0, 8, 0] }}
          transition={{ x: { duration: 70, repeat: Infinity, ease: 'linear' }, y: { duration: 8, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <AssetImage asset="decor.airship" className="w-full opacity-90" />
        </motion.div>
      )}

      {/* distant rooftops (drawn) so the skyline image can stay crisp at its native scale */}
      <svg className="absolute bottom-0 left-0 w-full" style={{ height: variant === 'menu' ? '34%' : '22%' }} viewBox="0 0 1200 300" preserveAspectRatio="none">
        <path
          d="M0 170 Q60 150 120 168 L150 120 L175 168 Q240 150 300 172 L330 132 L350 172 Q420 140 500 175 L900 175 Q960 150 1010 170 L1040 118 L1065 170 Q1120 150 1200 168 L1200 300 L0 300Z"
          fill="#5b4864"
          opacity=".55"
        />
        <path d="M0 220 Q150 195 300 215 T600 210 T900 215 T1200 205 L1200 300 L0 300Z" fill="#3d3046" opacity=".9" />
      </svg>

      {variant === 'menu' && (
        <div className="absolute bottom-[9%] left-1/2 -translate-x-1/2" style={{ width: 'min(92vw, 820px)' }}>
          <AssetImage asset="bg.city" className="w-full opacity-95" eager />
        </div>
      )}
      {/* ground */}
      <div className="absolute inset-x-0 bottom-0" style={{ height: variant === 'menu' ? '11%' : '0', background: 'linear-gradient(180deg,#3d3046,#261d2d)' }} />
    </div>
  );
});
