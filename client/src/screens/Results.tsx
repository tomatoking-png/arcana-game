import { motion } from 'motion/react';
import { useMemo } from 'react';
import type { RoomView } from '@arcana/shared';
import { AssetImage } from '../components/AssetImage';
import { Avatar } from '../components/Avatar';
import { MagicButton, SpriteButton } from '../components/Buttons';
import { IconCheck, IconCrown, IconDoor, IconSparkle } from '../components/Icons';
import { useGame } from '../store';

/** Celebratory round summary shown over the table. */
export function ResultsScreen({ room }: { room: RoomView }) {
  const { rematch, backToLobby, leaveRoom } = useGame();
  const result = room.lastResult!;
  const winner = room.players.find((p) => p.id === result.winnerId);
  const me = room.players.find((p) => p.id === room.youId)!;
  const isHost = room.hostId === room.youId;
  const youWon = result.winnerId === room.youId;
  const ranked = [...room.players].sort((a, b) => (a.id === result.winnerId ? -1 : b.id === result.winnerId ? 1 : (result.cardsLeft[a.id] ?? 0) - (result.cardsLeft[b.id] ?? 0)));
  const confetti = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: (i * 41) % 100, d: (i % 7) * 0.25, c: ['#E97870', '#F1B74F', '#89A98B', '#74A8CB', '#F8E6C9'][i % 5], s: 10 + (i % 4) * 5, r: i * 37 })),
    [],
  );

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 no-scrollbar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingTop: 'calc(var(--safe-t) + 16px)', paddingBottom: 'calc(var(--safe-b) + 16px)' }}>
      <div className="fixed inset-0 bg-[#1a1320]/75 backdrop-blur-[4px]" />
      {/* falling sparkles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {confetti.map((p, i) => (
          <motion.span key={i} className="absolute" style={{ left: `${p.x}%`, top: -30, color: p.c }} animate={{ y: ['0vh', '110vh'], rotate: [0, p.r + 360], opacity: [0, 1, 1, 0] }} transition={{ duration: 4 + (i % 5) * 0.6, delay: p.d, repeat: Infinity, ease: 'linear' }}>
            <IconSparkle size={p.s} />
          </motion.span>
        ))}
      </div>

      <motion.div className="panel relative my-auto w-full max-w-md px-5 pb-6 pt-4 text-center" initial={{ y: 60, scale: 0.85 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.15 }}>
        {/* winner */}
        <div className="relative mx-auto -mt-16 mb-1 flex h-36 w-36 items-center justify-center">
          <motion.div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent, rgb(241 183 79 / .55), transparent 30%, rgb(241 183 79 / .55), transparent 60%, rgb(241 183 79 / .55), transparent 90%)', filter: 'blur(6px)' }} animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
          <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 0.35 }}>
            {winner && <Avatar avatar={winner.avatar} size={112} active bounceKey={1} />}
          </motion.div>
          <motion.span className="absolute -top-2 text-mustard" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
            <IconCrown size={34} />
          </motion.span>
        </div>
        <motion.h2 className="font-display text-glow text-3xl font-bold" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 14 }}>
          {youWon ? 'คุณชนะ!' : `${winner?.name ?? '?'} ชนะ!`}
        </motion.h2>
        <p className="mt-1 text-sm text-cream/70">
          รอบที่ {result.round} · ได้รับ <span className="font-display text-mustard">+{result.pointsWon}</span> คะแนน
        </p>

        {/* scores */}
        <div className="mt-4 flex flex-col gap-2">
          {ranked.map((p, i) => (
            <motion.div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl px-3 py-2"
              style={{ background: p.id === result.winnerId ? 'rgb(241 183 79 / .18)' : 'rgb(0 0 0 / .2)' }}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.1, type: 'spring', stiffness: 300, damping: 24 }}
            >
              <Avatar avatar={p.avatar} size={38} dim={!p.connected} />
              <div className="min-w-0 flex-1 text-left">
                <div className="font-display truncate text-sm">
                  {p.name} {p.id === room.youId && <span className="text-cream/50">(คุณ)</span>}
                </div>
                <div className="text-[11px] text-cream/55">
                  เหลือ {result.cardsLeft[p.id] ?? 0} ใบ · {result.handPoints[p.id] ?? 0} แต้มในมือ
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold text-mustard">{p.score}</div>
                <div className="text-[10px] text-cream/50">คะแนนรวม</div>
              </div>
              {p.wantsRematch && (
                <span className="rounded-full bg-sage p-1 text-cream" title="อยากเล่นอีกรอบ">
                  <IconCheck size={12} />
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* actions */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <SpriteButton asset="icon.refresh" label="เล่นอีกรอบ" width={64} pulse={!me.wantsRematch} onClick={() => void rematch(!me.wantsRematch)} />
            <div className="text-left">
              <div className="font-display text-lg">{me.wantsRematch ? 'รอคนอื่น…' : 'เล่นอีกรอบ'}</div>
              <div className="text-xs text-cream/55">
                {room.players.filter((p) => p.wantsRematch).length}/{room.players.filter((p) => p.connected).length} คนพร้อม
              </div>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            {isHost && (
              <MagicButton tone="dusty" size="sm" onClick={() => void backToLobby()}>
                กลับล็อบบี้
              </MagicButton>
            )}
            <MagicButton tone="ghost" size="sm" icon={<IconDoor size={16} />} onClick={() => void leaveRoom()}>
              ออก
            </MagicButton>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-6 -right-4 w-20 opacity-90" aria-hidden>
          <AssetImage asset="decor.cat" className="w-full" />
        </div>
      </motion.div>
    </motion.div>
  );
}
