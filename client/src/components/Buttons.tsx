import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import type { AssetKey } from '../assets/manifest';
import { sfx, unlockAudio } from '../lib/sfx';
import { AssetImage } from './AssetImage';

type Tone = 'coral' | 'mustard' | 'sage' | 'dusty' | 'cream' | 'plum' | 'ghost';

const TONES: Record<Tone, { bg: string; fg: string; glow: string }> = {
  coral: { bg: 'linear-gradient(160deg,#f08a82 0%,#E97870 45%,#d9655e 100%)', fg: '#FFF4E4', glow: 'rgb(233 120 112 / .45)' },
  mustard: { bg: 'linear-gradient(160deg,#f6c76b 0%,#F1B74F 50%,#e2a23b 100%)', fg: '#3a2a20', glow: 'rgb(241 183 79 / .45)' },
  sage: { bg: 'linear-gradient(160deg,#9cba9e 0%,#89A98B 50%,#76967a 100%)', fg: '#F8E6C9', glow: 'rgb(137 169 139 / .45)' },
  dusty: { bg: 'linear-gradient(160deg,#8ab8d7 0%,#74A8CB 50%,#5f93b7 100%)', fg: '#F8E6C9', glow: 'rgb(116 168 203 / .45)' },
  cream: { bg: 'linear-gradient(160deg,#fdf0da 0%,#F8E6C9 55%,#efd5b0 100%)', fg: '#302638', glow: 'rgb(248 230 201 / .35)' },
  plum: { bg: 'linear-gradient(160deg,#84708a 0%,#725D79 55%,#5f4c66 100%)', fg: '#F8E6C9', glow: 'rgb(114 93 121 / .45)' },
  ghost: { bg: 'rgb(248 230 201 / .07)', fg: '#F8E6C9', glow: 'transparent' },
};

/** Rounded pill button with the reference sheet's soft gloss and springy press. */
export function MagicButton({
  tone = 'coral',
  size = 'md',
  icon,
  children,
  disabled,
  className = '',
  onClick,
  ...rest
}: { tone?: Tone; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; children?: ReactNode } & HTMLMotionProps<'button'>) {
  const t = TONES[tone];
  const pad = size === 'lg' ? 'px-8 py-4 text-xl' : size === 'sm' ? 'px-4 py-2 text-sm' : 'px-6 py-3 text-base';
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -3, scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.94, y: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      onPointerEnter={() => !disabled && sfx('hover')}
      onClick={(e) => {
        unlockAudio();
        if (!disabled) sfx('click');
        onClick?.(e);
      }}
      className={`font-display relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold tracking-wide ${pad} ${disabled ? 'opacity-45 saturate-50' : ''} ${className}`}
      style={{ background: t.bg, color: t.fg, boxShadow: `0 10px 22px -10px ${t.glow}, 0 4px 0 rgb(0 0 0 / .14), inset 0 1px 0 rgb(255 255 255 / .22)` }}
      {...rest}
    >
      {/* gloss streak like the reference buttons */}
      <span aria-hidden className="pointer-events-none absolute -top-1/2 left-[8%] h-full w-[38%] rotate-[-18deg] rounded-full bg-white/12" />
      {icon && <span className="relative flex shrink-0 items-center">{icon}</span>}
      {children && <span className="relative">{children}</span>}
    </motion.button>
  );
}

/** Round icon button using one of the sheet's button sprites, or a drawn icon. */
export function IconButton({
  asset,
  icon,
  label,
  size = 48,
  onClick,
  disabled,
  className = '',
  active,
}: {
  asset?: AssetKey;
  icon?: ReactNode;
  label: string;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  active?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.08, rotate: -4 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 20 }}
      onPointerEnter={() => !disabled && sfx('hover')}
      onClick={() => {
        unlockAudio();
        if (!disabled) sfx('click');
        onClick?.();
      }}
      className={`relative flex shrink-0 items-center justify-center rounded-full ${disabled ? 'opacity-40' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: asset ? 'transparent' : active ? '#F8E6C9' : '#725D79',
        color: active ? '#302638' : '#F8E6C9',
        boxShadow: asset ? undefined : '0 8px 18px -8px rgb(10 6 14 / .7)',
      }}
    >
      {asset ? <AssetImage asset={asset} className="h-full w-full object-contain drop-shadow-[0_6px_10px_rgba(10,6,14,.5)]" eager /> : icon}
    </motion.button>
  );
}

/** Large image button made from a sheet sprite (e.g. the red star "cast" pill). */
export function SpriteButton({
  asset,
  label,
  width,
  onClick,
  disabled,
  pulse,
  className = '',
}: {
  asset: AssetKey;
  label: string;
  width: number | string;
  onClick?: () => void;
  disabled?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerEnter={() => !disabled && sfx('hover')}
      onClick={() => {
        unlockAudio();
        onClick?.();
      }}
      whileHover={disabled ? undefined : { scale: 1.06, y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.92, y: 2 }}
      animate={pulse && !disabled ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 480, damping: 20 }}
      className={`relative shrink-0 ${disabled ? 'opacity-40 saturate-50' : ''} ${className}`}
      style={{ width }}
    >
      <AssetImage asset={asset} className="w-full object-contain drop-shadow-[0_10px_16px_rgba(10,6,14,.5)]" eager />
    </motion.button>
  );
}
