import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useGame } from '../store';
import { IconClose, IconSparkle, IconWifiOff } from './Icons';

export function Modal({ open, onClose, children, title }: { open: boolean; onClose?: () => void; children: ReactNode; title?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal
          aria-label={title}
        >
          <motion.div className="absolute inset-0 bg-[#1a1320]/70 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            className="panel relative w-full max-w-sm p-6"
            initial={{ y: 30, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            {onClose && (
              <button onClick={onClose} aria-label="ปิด" className="absolute right-4 top-4 rounded-full p-1.5 text-cream/60 transition hover:bg-white/10 hover:text-cream">
                <IconClose size={18} />
              </button>
            )}
            {title && <h2 className="font-display mb-4 text-center text-2xl font-semibold text-cream">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TONE_BG: Record<string, string> = {
  info: '#725D79',
  warn: '#F1B74F',
  error: '#E97870',
  magic: '#74A8CB',
};

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4" style={{ top: 'calc(var(--safe-t) + 64px)' }} aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            onClick={() => dismiss(t.id)}
            className="font-display pointer-events-auto flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-[0_12px_24px_-10px_rgba(10,6,14,.8)]"
            style={{ background: TONE_BG[t.tone], color: t.tone === 'warn' ? '#302638' : '#F8E6C9' }}
            initial={{ y: -24, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 460, damping: 28 }}
          >
            <IconSparkle size={14} />
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Small status pill: online / reconnecting / offline. */
export function ConnectionBadge() {
  const c = useGame((s) => s.connection);
  const color = c === 'online' ? '#89A98B' : c === 'offline' ? '#E97870' : '#F1B74F';
  const label = c === 'online' ? 'ออนไลน์' : c === 'offline' ? 'ออฟไลน์' : 'กำลังเชื่อมต่อ…';
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-xs text-cream/80" role="status">
      <motion.span
        className="h-2 w-2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        animate={c === 'online' ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: c === 'online' ? 0 : Infinity }}
      />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

/** Full-screen veil while the socket is reconnecting during a game. */
export function ReconnectVeil() {
  const c = useGame((s) => s.connection);
  const inRoom = useGame((s) => !!s.room || !!s.session);
  const show = inRoom && c !== 'online';
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#1a1320]/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="panel flex flex-col items-center gap-3 px-8 py-6 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }} className="text-mustard">
              <IconSparkle size={34} />
            </motion.div>
            <p className="font-display text-lg">กำลังเชื่อมต่อเวทมนตร์ใหม่…</p>
            <p className="flex items-center gap-1.5 text-sm text-cream/60">
              <IconWifiOff size={14} /> ที่นั่งของคุณยังถูกเก็บไว้
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
