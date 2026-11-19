import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { AVATARS, MAX_PLAYERS, MIN_PLAYERS, type RoomPlayerView, type RoomView } from '@arcana/shared';
import { AssetImage } from '../components/AssetImage';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { IconButton, MagicButton, SpriteButton } from '../components/Buttons';
import { IconCheck, IconCopy, IconCrown, IconDoor, IconShare, IconSound, IconWifiOff } from '../components/Icons';
import { ConnectionBadge } from '../components/Overlay';
import { sfx } from '../lib/sfx';
import { useGame } from '../store';

export function LobbyScreen({ room }: { room: RoomView }) {
  const { setReady, startGame, leaveRoom, setProfile, toast, settings, setSettings } = useGame();
  const me = room.players.find((p) => p.id === room.youId)!;
  const isHost = room.hostId === room.youId;
  const others = room.players.filter((p) => p.id !== room.hostId);
  const canStart = room.players.length >= MIN_PLAYERS && others.every((p) => p.ready) && room.players.every((p) => p.connected);
  const [copied, setCopied] = useState(false);

  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      sfx('select');
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast(`รหัสห้อง: ${room.code}`);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ARCANA', text: `มาเล่น ARCANA กัน! รหัสห้อง ${room.code}`, url: link });
      } catch {
        /* cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(link);
        toast('คัดลอกลิงก์เชิญแล้ว', 'magic');
      } catch {
        toast(link);
      }
    }
  };
  const cycleAvatar = () => {
    const i = AVATARS.indexOf(me.avatar);
    setProfile({ avatar: AVATARS[(i + 1) % AVATARS.length] });
  };

  const slots: (RoomPlayerView | null)[] = [...room.players, ...Array(Math.max(0, MAX_PLAYERS - room.players.length)).fill(null)];

  return (
    <div className="relative flex h-full flex-col overflow-y-auto no-scrollbar" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'calc(var(--safe-b) + 12px)' }}>
      <Backdrop variant="game" />

      <div className="relative z-10 flex items-center justify-between gap-2 p-3 sm:p-4">
        <MagicButton tone="ghost" size="sm" icon={<IconDoor size={18} />} onClick={() => void leaveRoom()}>
          ออกจากห้อง
        </MagicButton>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <IconButton label="เสียง" icon={<IconSound on={settings.sound} />} size={40} onClick={() => setSettings({ sound: !settings.sound })} />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-6 px-4 pb-4 sm:gap-10">
        {/* room code */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 sm:gap-5">
          <motion.div className="w-14 sm:w-20" initial={{ rotate: -8 }} animate={{ rotate: [-4, 4, -4] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '50% 0%' }}>
            <AssetImage asset="decor.banner" className="w-full" />
          </motion.div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-cream/55">รหัสห้อง</span>
            <div className="font-display text-glow text-5xl font-bold tracking-[0.25em] text-mustard sm:text-6xl" aria-label={`รหัสห้อง ${room.code.split('').join(' ')}`}>
              {room.code}
            </div>
            <div className="mt-2 flex gap-2">
              <MagicButton tone="cream" size="sm" icon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy}>
                {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
              </MagicButton>
              <MagicButton tone="plum" size="sm" icon={<IconShare size={16} />} onClick={share}>
                ส่งคำเชิญ
              </MagicButton>
            </div>
          </div>
        </motion.div>

        {/* seats */}
        <div className="grid w-full grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {slots.map((p, i) =>
              p ? (
                <PlayerSlot key={p.id} player={p} isYou={p.id === room.youId} onAvatar={p.id === room.youId ? cycleAvatar : undefined} />
              ) : (
                <motion.div
                  key={`empty-${i}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="shimmer flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[28px] bg-white/[0.04] text-cream/35"
                >
                  <div className="h-16 w-16 rounded-full bg-white/[0.06]" />
                  <span className="text-sm">รอผู้เล่น…</span>
                </motion.div>
              ),
            )}
          </AnimatePresence>
        </div>

        {/* actions */}
        <div className="flex w-full max-w-md flex-col items-center gap-3 pb-2">
          {isHost ? (
            <>
              <SpriteButton asset="icon.play" label="เริ่มเกม" width={170} disabled={!canStart} pulse={canStart} onClick={() => void startGame()} />
              <span className="font-display -mt-1 text-lg">{canStart ? 'เริ่มเกม!' : 'รอเพื่อน ๆ พร้อม'}</span>
              <p className="text-center text-xs text-cream/55">
                {room.players.length < MIN_PLAYERS ? 'ส่งรหัสห้องให้เพื่อน ต้องมีอย่างน้อย 2 คน' : !others.every((p) => p.ready) ? 'ทุกคนต้องกดพร้อมก่อนเริ่ม' : 'ทุกคนพร้อมแล้ว'}
              </p>
            </>
          ) : (
            <>
              <SpriteButton asset="icon.ready" label={me.ready ? 'ยกเลิกพร้อม' : 'พร้อม'} width={130} pulse={!me.ready} onClick={() => { sfx(me.ready ? 'click' : 'select'); void setReady(!me.ready); }} className={me.ready ? '' : 'grayscale-[.6]'} />
              <span className="font-display -mt-1 text-lg">{me.ready ? 'พร้อมแล้ว! รอหัวห้องเริ่มเกม' : 'แตะเพื่อพร้อม'}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerSlot({ player, isYou, onAvatar }: { player: RoomPlayerView; isYou: boolean; onAvatar?: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, y: 20 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      className="panel relative flex aspect-[4/5] flex-col items-center justify-center gap-2 p-3"
      style={{ boxShadow: player.ready ? '0 0 34px -6px rgb(137 169 139 / .75), 0 18px 40px -18px rgb(10 6 14 / .75)' : undefined, background: player.ready ? 'linear-gradient(180deg, rgb(137 169 139 / .28), rgb(48 38 56 / .94))' : undefined }}
    >
      {player.isHost && (
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-mustard px-2 py-0.5 text-[11px] font-semibold text-plum">
          <IconCrown size={12} /> หัวห้อง
        </span>
      )}
      {isYou && <span className="absolute right-3 top-3 rounded-full bg-dusty px-2 py-0.5 text-[11px] font-semibold text-plum">คุณ</span>}
      <motion.button type="button" disabled={!onAvatar} onClick={onAvatar} whileTap={onAvatar ? { scale: 0.9, rotate: -6 } : undefined} aria-label={onAvatar ? 'เปลี่ยนอวาตาร์' : undefined} className="rounded-full">
        <Avatar avatar={player.avatar} size={84} active={player.ready} dim={!player.connected} bounceKey={player.ready ? 1 : 0} />
      </motion.button>
      <span className="font-display max-w-full truncate text-lg">{player.name}</span>
      <AnimatePresence mode="wait">
        {!player.connected ? (
          <motion.span key="off" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 rounded-full bg-coral/80 px-3 py-1 text-xs">
            <IconWifiOff size={12} /> หลุดการเชื่อมต่อ
          </motion.span>
        ) : player.ready || player.isHost ? (
          <motion.span
            key="ready"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
            className="flex items-center gap-1 rounded-full bg-sage px-3 py-1 text-xs font-semibold text-cream"
          >
            <IconCheck size={13} /> {player.isHost ? 'หัวห้อง' : 'พร้อม'}
          </motion.span>
        ) : (
          <motion.span key="wait" initial={{ scale: 0 }} animate={{ scale: 1 }} className="rounded-full bg-white/10 px-3 py-1 text-xs text-cream/60">
            ยังไม่พร้อม
          </motion.span>
        )}
      </AnimatePresence>
      {isYou && onAvatar && <span className="text-[11px] text-cream/40">แตะรูปเพื่อเปลี่ยน</span>}
    </motion.div>
  );
}
