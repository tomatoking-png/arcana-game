import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { isPlayable, type Card, type CardColor, type RoomView } from '@arcana/shared';
import { AssetImage } from '../components/AssetImage';
import { Avatar } from '../components/Avatar';
import { Backdrop } from '../components/Backdrop';
import { IconButton, MagicButton, SpriteButton } from '../components/Buttons';
import { IconDoor, IconSound } from '../components/Icons';
import { ConnectionBadge, Modal } from '../components/Overlay';
import { ChallengePrompt, ColorPicker } from '../game/Dialogs';
import { EffectsLayer } from '../game/Effects';
import { Hand } from '../game/Hand';
import { OpponentSeat, useCountdown } from '../game/Seat';
import { TableCenter, TurnBanner } from '../game/TableCenter';
import { anchorRef } from '../lib/anchors';
import { useGame } from '../store';
import { Candles } from './Menu';

/** Seat positions around an ellipse, in play order starting to my left. */
function seatPositions(n: number, narrow: boolean) {
  if (n === 0) return [];
  const [from, to] = n === 1 ? [270, 270] : n === 2 ? [228, 312] : narrow ? [195, 345] : [188, 352];
  return Array.from({ length: n }, (_, i) => {
    const a = ((n === 1 ? 270 : from + (i * (to - from)) / (n - 1)) * Math.PI) / 180;
    return { left: 50 + Math.cos(a) * (narrow ? 39 : 43), top: (narrow ? 46 : 52) + Math.sin(a) * (narrow ? 30 : 36) };
  });
}

function useNarrow() {
  const q = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setNarrow(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return narrow;
}

export function GameScreen({ room }: { room: RoomView }) {
  const game = room.game!;
  const { act, leaveRoom, settings, setSettings, pending, batches } = useGame();
  const narrow = useNarrow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wildCard, setWildCard] = useState<Card | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [unoBounce, setUnoBounce] = useState<Record<string, number>>({});
  const [reverseKey, setReverseKey] = useState(0);

  const meId = room.youId;
  const me = room.players.find((p) => p.id === meId)!;
  const myPub = game.players.find((p) => p.id === meId);
  const myTurn = game.currentPlayerId === meId && game.phase !== 'roundOver';
  const current = room.players.find((p) => p.id === game.currentPlayerId);

  // Opponents in play order, starting with the player after me.
  const opponents = useMemo(() => {
    const order = game.players.map((p) => p.id);
    const i = order.indexOf(meId);
    const rotated = i >= 0 ? [...order.slice(i + 1), ...order.slice(0, i)] : order;
    return rotated.map((id) => ({ room: room.players.find((p) => p.id === id)!, pub: game.players.find((p) => p.id === id)! })).filter((o) => o.room);
  }, [game.players, room.players, meId]);
  const positions = seatPositions(opponents.length, narrow);

  // Drop selection when the hand changes or turn passes.
  useEffect(() => {
    if (selectedId && !game.myHand.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [game.myHand, selectedId]);
  useEffect(() => {
    if (!myTurn) setSelectedId(null);
  }, [myTurn]);
  // A playable drawn card gets pre-selected so it's one tap to cast.
  useEffect(() => {
    if (myTurn && game.phase === 'drawnDecision' && game.drawnCardId) setSelectedId(game.drawnCardId);
  }, [myTurn, game.phase, game.drawnCardId]);

  const selected = game.myHand.find((c) => c.id === selectedId) ?? null;
  const selectedPlayable =
    !!selected && myTurn && (game.phase === 'turn' || (game.phase === 'drawnDecision' && game.drawnCardId === selected.id)) && isPlayable(selected, game.topCard, game.activeColor);

  const play = useCallback(
    (card: Card) => {
      if (card.type === 'wild' || card.type === 'wild4') {
        setWildCard(card);
        return;
      }
      setSelectedId(null);
      void act({ type: 'play', cardId: card.id });
    },
    [act],
  );
  const playWild = (color: CardColor) => {
    const card = wildCard;
    setWildCard(null);
    setSelectedId(null);
    if (card) void act({ type: 'play', cardId: card.id, chosenColor: color });
  };

  const canDraw = myTurn && game.phase === 'turn' && !pending;
  const unoAvailable =
    !!myPub &&
    !myPub.unoDeclared &&
    ((myTurn && myPub.cardCount === 2 && (game.phase === 'turn' || game.phase === 'drawnDecision')) || (game.unoVulnerableId === meId && myPub.cardCount === 1));

  const lastEvents = batches.length ? batches[batches.length - 1].events : [];
  const challenge = game.phase === 'challenge' && game.pendingChallenge?.targetId === meId;
  const attackerName = room.players.find((p) => p.id === game.pendingChallenge?.attackerId)?.name ?? '';
  const myCountdown = useCountdown(myTurn && room.autoActAt ? room.autoActAt : null);

  const bannerText = (() => {
    if (game.phase === 'roundOver') return 'จบรอบ!';
    if (game.phase === 'challenge') return game.pendingChallenge?.targetId === meId ? 'ตัดสินใจ: รับ +4 หรือท้าพิสูจน์' : `${current?.name ?? ''} กำลังตัดสินใจท้าพิสูจน์…`;
    if (game.phase === 'chooseColor') return myTurn ? 'เลือกสีเปิดรอบ' : `${current?.name ?? ''} กำลังเลือกสี…`;
    if (myTurn) return game.phase === 'drawnDecision' ? 'ลงใบที่จั่วได้ หรือเก็บไว้' : 'ตาของคุณ!';
    return `ตาของ ${current?.name ?? ''}`;
  })();

  return (
    <div className="relative flex h-full flex-col overflow-hidden" style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}>
      <Backdrop variant="game" />

      {/* top bar */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-3 pt-2 sm:px-4 sm:pt-3">
        <IconButton label="ออกจากเกม" icon={<IconDoor />} size={40} onClick={() => setLeaveOpen(true)} />
        <div className="font-display flex items-center gap-2 rounded-full bg-black/25 px-3 py-1.5 text-xs text-cream/80 sm:text-sm">
          <span className="text-mustard">{room.code}</span>
          <span className="opacity-40">·</span>
          <span>รอบ {room.round}</span>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge />
          <IconButton label="เสียง" icon={<IconSound on={settings.sound} />} size={40} onClick={() => setSettings({ sound: !settings.sound })} />
        </div>
      </div>

      {/* arena */}
      <div className="relative z-10 min-h-0 flex-1">
        {/* cozy table decorations */}
        <div className="pointer-events-none absolute bottom-[4%] left-[2%] hidden w-[70px] opacity-90 md:block" aria-hidden>
          <Candles />
        </div>
        <div className="anim-floaty pointer-events-none absolute bottom-[6%] right-[3%] hidden w-[64px] md:block" aria-hidden>
          <AssetImage asset="decor.crystal" className="w-full" />
        </div>

        {opponents.map((o, i) => (
          <div key={o.room.id} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${positions[i].left}%`, top: `max(${positions[i].top}%, ${narrow ? 62 : 84}px)` }}>
            <OpponentSeat
              player={o.room}
              pub={o.pub}
              active={game.currentPlayerId === o.room.id && game.phase !== 'roundOver'}
              compact={narrow || opponents.length > 4}
              bounceKey={unoBounce[o.room.id] ?? 0}
              canCatch={game.unoVulnerableId === o.room.id && o.pub.cardCount === 1 && !o.pub.unoDeclared}
              onCatch={() => void act({ type: 'catchUno', targetId: o.room.id })}
              autoActAt={room.autoActAt}
            />
          </div>
        ))}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ paddingTop: narrow ? '22%' : 'min(9%, 90px)' }}>
          <TableCenter game={game} canDraw={canDraw} onDraw={() => void act({ type: 'draw' })} lastEvents={lastEvents} reverseKey={reverseKey} />
          <div className="relative z-20 mt-7 sm:mt-9">
            <TurnBanner text={bannerText} mine={myTurn} />
          </div>
        </div>
      </div>

      {/* my area */}
      <div className="relative z-30 mx-auto w-full max-w-5xl px-2 sm:px-4">
        <div className="flex items-end justify-between gap-2 px-1 pb-1">
          <div className="flex min-w-0 items-center gap-2">
            <div ref={anchorRef('me')}>
              <Avatar avatar={me.avatar} size={narrow ? 44 : 56} active={myTurn} bounceKey={unoBounce[meId] ?? 0} />
            </div>
            <div className="min-w-0">
              <div className="font-display truncate text-sm sm:text-base">{me.name}</div>
              <div className="text-[11px] text-cream/60 sm:text-xs">
                {myPub?.cardCount ?? 0} ใบ · {me.score} คะแนน
                {myCountdown !== null && myCountdown <= 15 && <span className="ml-1 text-mustard">· {myCountdown}s</span>}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-2 sm:gap-3">
            <AnimatePresence>
              {myTurn && game.phase === 'drawnDecision' && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <MagicButton tone="plum" size="sm" onClick={() => void act({ type: 'pass' })}>
                    เก็บไว้
                  </MagicButton>
                </motion.div>
              )}
            </AnimatePresence>
            <ActionSprite label="จั่ว" show>
              <SpriteButton asset="icon.cards" label="จั่วการ์ด" width={narrow ? 66 : 84} disabled={!canDraw} pulse={canDraw && !game.myHand.some((c) => isPlayable(c, game.topCard, game.activeColor))} onClick={() => void act({ type: 'draw' })} />
            </ActionSprite>
            <UnoButton available={unoAvailable} declared={!!myPub?.unoDeclared && myPub.cardCount <= 2} narrow={narrow} onClick={() => void act({ type: 'callUno' })} />
            <AnimatePresence>
              {selectedPlayable && (
                <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
                  <ActionSprite label="ร่าย!" show>
                    <SpriteButton asset="icon.play" label="ลงการ์ด" width={narrow ? 92 : 120} pulse onClick={() => selected && play(selected)} />
                  </ActionSprite>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <Hand game={game} selectedId={selectedId} onSelect={setSelectedId} onPlay={play} myTurn={myTurn} />
      </div>

      <EffectsLayer onUno={(id) => setUnoBounce((b) => ({ ...b, [id]: (b[id] ?? 0) + 1 }))} onReverse={() => setReverseKey((k) => k + 1)} />

      <ColorPicker open={!!wildCard || (myTurn && game.phase === 'chooseColor')} onPick={(c) => (wildCard ? playWild(c) : void act({ type: 'chooseColor', color: c }))} onCancel={wildCard ? () => setWildCard(null) : undefined} />
      <ChallengePrompt open={challenge} attackerName={attackerName} onAccept={() => void act({ type: 'acceptDraw4' })} onChallenge={() => void act({ type: 'challenge' })} />

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="ออกจากเกม?">
        <p className="mb-5 text-center text-sm text-cream/70">ที่นั่งของคุณจะถูกลบ และการ์ดในมือจะกลับเข้ากองจั่ว</p>
        <div className="grid grid-cols-2 gap-3">
          <MagicButton tone="plum" onClick={() => setLeaveOpen(false)}>
            อยู่ต่อ
          </MagicButton>
          <MagicButton tone="coral" onClick={() => void leaveRoom()}>
            ออกเลย
          </MagicButton>
        </div>
      </Modal>
    </div>
  );
}

function ActionSprite({ label, children, show }: { label: string; children: React.ReactNode; show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex flex-col items-center">
      {children}
      <span className="font-display -mt-0.5 text-[11px] text-cream/75 sm:text-xs">{label}</span>
    </div>
  );
}

function UnoButton({ available, declared, narrow, onClick }: { available: boolean; declared: boolean; narrow: boolean; onClick: () => void }) {
  const size = narrow ? 62 : 76;
  return (
    <div className="flex flex-col items-center">
      <motion.button
        type="button"
        aria-label="ประกาศ UNO"
        disabled={!available}
        onClick={onClick}
        className="font-display relative flex items-center justify-center overflow-hidden rounded-full font-bold"
        style={{
          width: size,
          height: size,
          fontSize: narrow ? 17 : 20,
          background: declared ? 'linear-gradient(160deg,#9cba9e,#76967a)' : 'linear-gradient(160deg,#f08a82 0%,#E97870 50%,#d9655e 100%)',
          color: '#FFF4E4',
          boxShadow: available ? '0 0 0 4px rgb(241 183 79 / .8), 0 0 30px 6px rgb(233 120 112 / .55)' : '0 10px 20px -10px rgb(10 6 14 / .8)',
          opacity: available || declared ? 1 : 0.45,
        }}
        animate={available ? { scale: [1, 1.1, 1], rotate: [0, -4, 4, 0] } : { scale: 1 }}
        transition={available ? { duration: 0.9, repeat: Infinity } : { type: 'spring' }}
        whileTap={available ? { scale: 0.85 } : undefined}
      >
        <span className="pointer-events-none absolute -top-1/3 left-[12%] h-2/3 w-1/3 rotate-[-20deg] rounded-full bg-white/15" />
        UNO
      </motion.button>
      <span className="font-display -mt-0.5 text-[11px] text-cream/75 sm:text-xs">{declared ? 'ประกาศแล้ว' : 'ประกาศ'}</span>
    </div>
  );
}
