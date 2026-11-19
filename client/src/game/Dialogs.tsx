import { AnimatePresence, motion } from 'motion/react';
import { CARD_COLORS, type CardColor } from '@arcana/shared';
import { COLOR_HEX, COLOR_NAME_TH } from '../assets/manifest';
import { AssetImage } from '../components/AssetImage';
import { MagicButton } from '../components/Buttons';
import { IconSparkle } from '../components/Icons';
import { sfx } from '../lib/sfx';

/** Colour selection with a magic burst — four swatches orbit out from the centre. */
export function ColorPicker({ open, onPick, onCancel }: { open: boolean; onPick: (c: CardColor) => void; onCancel?: () => void }) {
  const pos = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="เลือกสี">
          <motion.div className="absolute inset-0 bg-[#1a1320]/65 backdrop-blur-[2px]" onClick={onCancel} />
          <div className="relative flex flex-col items-center">
            <motion.h3 className="font-display mb-6 text-2xl font-semibold text-cream text-glow" initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              เลือกสีเวทมนตร์
            </motion.h3>
            <div className="relative h-52 w-52 sm:h-60 sm:w-60">
              {/* burst */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: 'conic-gradient(#E97870, #F1B74F, #89A98B, #74A8CB, #E97870)', filter: 'blur(28px)' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.55, rotate: 180 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
              <motion.div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-cream" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                <IconSparkle size={30} />
              </motion.div>
              {CARD_COLORS.map((c, i) => (
                <motion.button
                  key={c}
                  type="button"
                  aria-label={`สี${COLOR_NAME_TH[c]}`}
                  className="absolute left-1/2 top-1/2 flex flex-col items-center"
                  initial={{ x: '-50%', y: '-50%', scale: 0, rotate: -90 }}
                  animate={{ x: `calc(-50% + ${pos[i].x * 58}px)`, y: `calc(-50% + ${pos[i].y * 58}px)`, scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.05 * i }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.88 }}
                  onPointerEnter={() => sfx('hover')}
                  onClick={() => {
                    sfx('special');
                    onPick(c);
                  }}
                >
                  <div className="h-20 w-20 sm:h-24 sm:w-24" style={{ filter: `drop-shadow(0 0 14px ${COLOR_HEX[c]}aa)` }}>
                    <AssetImage asset={`swatch.${c}`} className="h-full w-full object-contain" eager />
                  </div>
                  <span className="font-display mt-1 text-sm text-cream">{COLOR_NAME_TH[c]}</span>
                </motion.button>
              ))}
            </div>
            {onCancel && (
              <button className="mt-6 text-sm text-cream/60 underline-offset-4 hover:underline" onClick={onCancel}>
                ยกเลิก
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Wild Draw Four response: accept the four or challenge the play. */
export function ChallengePrompt({ open, attackerName, onAccept, onChallenge }: { open: boolean; attackerName: string; onAccept: () => void; onChallenge: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-label="ท้าพิสูจน์ไวลด์ +4">
          <div className="absolute inset-0 bg-[#1a1320]/60 backdrop-blur-[2px]" />
          <motion.div
            className="panel relative w-full max-w-sm p-6 text-center"
            initial={{ y: 60, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{ marginBottom: 'var(--safe-b)' }}
          >
            <div className="mx-auto -mt-16 mb-2 w-20">
              <AssetImage asset="card.wild4" className="w-full drop-shadow-xl" eager />
            </div>
            <h3 className="font-display text-xl font-semibold">{attackerName} ใช้ไวลด์ +4 ใส่คุณ!</h3>
            <p className="mt-2 text-sm text-cream/70">
              ถ้าคิดว่าเขามีการ์ดสีเดิมอยู่ ลองท้าพิสูจน์ — ถ้าเขาโกง เขาจั่ว 4 แทน แต่ถ้าไม่โกง คุณจั่ว 6
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MagicButton tone="plum" onClick={onAccept}>
                รับ +4
              </MagicButton>
              <MagicButton tone="coral" onClick={onChallenge}>
                ท้าพิสูจน์!
              </MagicButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
