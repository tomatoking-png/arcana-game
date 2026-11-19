import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { AVATARS, type AvatarId } from '@arcana/shared';
import { AssetImage } from '../components/AssetImage';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { IconButton, MagicButton } from '../components/Buttons';
import { IconArrow, IconSound, IconSparkle } from '../components/Icons';
import { ConnectionBadge, Modal } from '../components/Overlay';
import { SettingsModal } from '../components/Settings';
import { unlockAudio } from '../lib/sfx';
import { useGame } from '../store';

const TITLE = 'ARCANA'.split('');

export function MenuScreen() {
  const { profile, setProfile, createRoom, joinRoom, busy, connection, settings, setSettings } = useGame();
  const [joinOpen, setJoinOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [code, setCode] = useState('');
  const online = connection === 'online';

  // Deep link: ?room=ABCDE pre-fills the join dialog.
  useEffect(() => {
    const c = new URLSearchParams(location.search).get('room');
    if (c) {
      setCode(c.toUpperCase().slice(0, 5));
      setJoinOpen(true);
    }
  }, []);

  const doJoin = async () => {
    if (code.length < 4) return;
    if (await joinRoom(code)) {
      setJoinOpen(false);
      history.replaceState(null, '', location.pathname);
    }
  };

  return (
    <div className="relative flex h-full flex-col overflow-y-auto overflow-x-hidden no-scrollbar" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}>
      <Backdrop variant="menu" />
      <MenuDecor />

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-end gap-2 p-3 sm:p-4">
        <ConnectionBadge />
        <IconButton
          label={settings.sound ? 'ปิดเสียง' : 'เปิดเสียง'}
          icon={<IconSound on={settings.sound} />}
          size={42}
          onClick={() => setSettings({ sound: !settings.sound })}
        />
        <IconButton asset="icon.settings" label="ตั้งค่า" size={46} onClick={() => setSettingsOpen(true)} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-5 pb-[18vh] sm:pb-[22vh]">
        {/* title */}
        <div className="flex flex-col items-center">
          <motion.div initial={{ y: 20, opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.1 }} className="anim-floaty w-28 sm:w-36">
            <AssetImage asset="decor.cardFan" className="w-full" eager />
          </motion.div>
          <h1 className="font-display text-glow -mt-2 flex text-6xl font-bold tracking-[0.08em] text-cream sm:text-7xl" aria-label="ARCANA">
            {TITLE.map((ch, i) => (
              <motion.span
                key={i}
                initial={{ y: 30, opacity: 0, scale: 0.6 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 13, delay: 0.25 + i * 0.07 }}
                whileHover={{ y: -8, rotate: i % 2 ? 6 : -6, color: ['#E97870', '#F1B74F', '#89A98B', '#74A8CB'][i % 4] }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-1 text-center text-sm text-cream/75 sm:text-base">
            <span className="inline-block">เกมการ์ดเวทมนตร์</span> <span className="hidden sm:inline">·</span>{' '}
            <span className="inline-block">ร่ายคาถาแข่งกับเพื่อนแบบเรียลไทม์</span>
          </motion.p>
        </div>

        {/* profile */}
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 22 }} className="panel w-full p-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            {AVATARS.map((a) => (
              <AvatarPick key={a} avatar={a} selected={profile.avatar === a} onPick={() => setProfile({ avatar: a })} />
            ))}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">ชื่อผู้เล่น</span>
            <input
              value={profile.name}
              maxLength={16}
              onChange={(e) => setProfile({ name: e.target.value })}
              placeholder="ชื่อนักเวทของคุณ"
              className="font-display w-full rounded-full bg-black/25 px-5 py-3 text-center text-lg text-cream placeholder:text-cream/35 focus:bg-black/35 focus:outline-none"
            />
          </label>
        </motion.div>

        {/* actions */}
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.65, type: 'spring', stiffness: 200, damping: 22 }} className="flex w-full flex-col gap-3">
          <MagicButton tone="coral" size="lg" icon={<IconSparkle size={22} />} disabled={!online} onClick={() => setOnlineOpen(true)} className="w-full">
            เล่นออนไลน์
          </MagicButton>
          <div className="grid grid-cols-2 gap-3">
            <MagicButton tone="mustard" disabled={!online || busy} onClick={() => void createRoom()}>
              สร้างห้อง
            </MagicButton>
            <MagicButton tone="dusty" disabled={!online} onClick={() => setJoinOpen(true)}>
              เข้าห้อง
            </MagicButton>
          </div>
          {!online && <p className="text-center text-xs text-cream/55">กำลังเชื่อมต่อเซิร์ฟเวอร์…</p>}
        </motion.div>
      </div>

      <Modal open={onlineOpen} onClose={() => setOnlineOpen(false)} title="เล่นออนไลน์">
        <p className="mb-4 text-center text-sm text-cream/70">สร้างห้องใหม่แล้วส่งรหัสให้เพื่อน หรือใส่รหัสห้องที่เพื่อนส่งมา</p>
        <div className="flex flex-col gap-3">
          <MagicButton tone="mustard" disabled={busy} onClick={async () => { if (await createRoom()) setOnlineOpen(false); }}>
            สร้างห้องใหม่
          </MagicButton>
          <MagicButton tone="dusty" onClick={() => { setOnlineOpen(false); setJoinOpen(true); }}>
            ใส่รหัสห้อง
          </MagicButton>
        </div>
      </Modal>

      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="เข้าร่วมห้อง">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            void doJoin();
          }}
          className="flex flex-col gap-4"
        >
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="รหัส 5 ตัว"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-display w-full rounded-2xl bg-black/30 px-4 py-4 text-center text-3xl tracking-[0.4em] text-mustard placeholder:text-base placeholder:tracking-normal placeholder:text-cream/35 focus:outline-none"
          />
          <MagicButton type="submit" tone="coral" disabled={code.length < 4 || busy || !online} icon={<IconArrow />}>
            เข้าห้อง
          </MagicButton>
        </form>
      </Modal>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function AvatarPick({ avatar, selected, onPick }: { avatar: AvatarId; selected: boolean; onPick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`อวาตาร์ ${avatar}`}
      animate={{ scale: selected ? 1.12 : 0.88, opacity: selected ? 1 : 0.6, y: selected ? -4 : 0 }}
      whileHover={{ scale: selected ? 1.16 : 0.96, opacity: 1 }}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className="rounded-full"
    >
      <Avatar avatar={avatar} size={58} active={selected} />
    </motion.button>
  );
}

/** Crystal ball, candles, lamp, sprouts and a black cat that swishes its tail. */
function MenuDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
      <div className="absolute bottom-[10%] left-[3%] w-[11vw] min-w-[44px] max-w-[60px] opacity-90">
        <AssetImage asset="decor.lamp" className="w-full" />
        <div className="absolute left-1/2 top-[6%] h-16 w-16 -translate-x-1/2 rounded-full bg-mustard/30 blur-xl" />
      </div>
      <div className="anim-floaty absolute bottom-[13%] left-[10%] w-[14vw] min-w-[60px] max-w-[110px]" style={{ animationDuration: '4.2s' }}>
        <div className="absolute inset-[10%] rounded-full bg-[#c7a6d6]/40 blur-2xl" />
        <AssetImage asset="decor.crystal" className="relative w-full" />
      </div>
      <div className="absolute bottom-[8%] right-[4%] w-[22vw] min-w-[110px] max-w-[190px]">
        <CatWithTail />
      </div>
      <div className="absolute bottom-[8%] right-[26%] hidden w-[8vw] max-w-[90px] sm:block">
        <Candles />
      </div>
      <div className="absolute bottom-[7.5%] left-[22%] hidden w-[6vw] max-w-[70px] opacity-80 sm:block">
        <AssetImage asset="decor.sproutA" className="w-full" />
      </div>
      <div className="absolute bottom-[7.5%] right-[18%] w-[6vw] min-w-[34px] max-w-[60px] opacity-80">
        <AssetImage asset="decor.sproutB" className="w-full" />
      </div>
    </div>
  );
}

export function Candles() {
  return (
    <div className="relative">
      <div className="anim-flicker absolute left-[22%] top-[-6%] h-[45%] w-[45%] rounded-full bg-mustard/45 blur-xl" />
      <div className="anim-flicker absolute right-[8%] top-[20%] h-[35%] w-[35%] rounded-full bg-mustard/40 blur-lg" style={{ animationDelay: '.5s' }} />
      <AssetImage asset="decor.candles" className="relative w-full" />
    </div>
  );
}

export function CatWithTail() {
  return (
    <div className="relative">
      {/* tail behind the body */}
      <svg className="anim-sway absolute" style={{ right: '-2%', bottom: '18%', width: '30%' }} viewBox="0 0 60 80" aria-hidden>
        <path d="M8 76 C 10 50, 4 34, 22 20 C 34 10, 44 14, 46 6" stroke="#2b2030" strokeWidth="11" fill="none" strokeLinecap="round" />
      </svg>
      <AssetImage asset="decor.cat" className="relative w-full" />
      {/* blinking eyes overlay */}
      <motion.div
        className="absolute rounded-full bg-[#2b2030]"
        style={{ left: '24%', top: '30%', width: '22%', height: '10%' }}
        animate={{ scaleY: [0, 0, 1, 0, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] }}
      />
    </div>
  );
}
