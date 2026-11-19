import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useEffect } from 'react';
import { preloadAssets } from './assets/manifest';
import { ReconnectVeil, Toasts } from './components/Overlay';
import { unlockAudio } from './lib/sfx';
import { GameScreen } from './screens/Game';
import { LobbyScreen } from './screens/Lobby';
import { MenuScreen } from './screens/Menu';
import { ResultsScreen } from './screens/Results';
import { useGame } from './store';

export function App() {
  const room = useGame((s) => s.room);
  const reduced = useGame((s) => s.settings.reducedMotion);

  useEffect(() => {
    preloadAssets();
    useGame.getState().init();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduced);
  }, [reduced]);

  const screen = !room ? 'menu' : room.status === 'lobby' ? 'lobby' : 'game';

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          className="h-full"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {screen === 'menu' && <MenuScreen />}
          {screen === 'lobby' && room && <LobbyScreen room={room} />}
          {screen === 'game' && room?.game && <GameScreen room={room} />}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>{room?.status === 'results' && room.lastResult && <ResultsScreen key={`r${room.round}`} room={room} />}</AnimatePresence>
      <Toasts />
      <ReconnectVeil />
    </MotionConfig>
  );
}
