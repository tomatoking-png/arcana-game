import type { AvatarId, Card, CardColor } from '@arcana/shared';

/**
 * Asset manifest — every image extracted from the reference sheet,
 * which component uses it, and what renders if it fails to load.
 * Files live in client/public/assets/<group>/<name>.png (transparent PNG).
 */
export interface AssetEntry {
  src: string;
  usedBy: string;
  /** Fallback drawn by <AssetImage> when the file is missing. */
  fallback: 'card' | 'cardBack' | 'avatar' | 'icon' | 'decor' | 'none';
  /** Natural size in px (for aspect ratio). */
  w: number;
  h: number;
}

const A = (src: string, usedBy: string, fallback: AssetEntry['fallback'], w: number, h: number): AssetEntry => ({
  src: `/assets/${src}.png`,
  usedBy,
  fallback,
  w,
  h,
});

const COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue'];
const cardEntries = Object.fromEntries(
  COLORS.flatMap((c) =>
    (['number', 'skip', 'reverse', 'draw2'] as const).map((t) => [
      `card.${t}.${c}`,
      A(`cards/${t}-${c}`, 'CardFace', 'card', 141, 234),
    ]),
  ),
);

export const ASSETS = {
  ...cardEntries,
  'card.wild': A('cards/wild', 'CardFace', 'card', 141, 234),
  'card.wild4': A('cards/wild4', 'CardFace', 'card', 141, 234),
  'card.back': A('cards/back', 'CardBack, DrawPile, OpponentSeat', 'cardBack', 166, 235),

  'avatar.witch': A('avatars/witch', 'Avatar', 'avatar', 144, 141),
  'avatar.tinkerer': A('avatars/tinkerer', 'Avatar', 'avatar', 144, 140),
  'avatar.cleric': A('avatars/cleric', 'Avatar', 'avatar', 144, 140),
  'avatar.catfolk': A('avatars/catfolk', 'Avatar', 'avatar', 144, 140),

  'bg.city': A('backgrounds/city-skyline', 'SceneBackdrop', 'none', 485, 167),
  'bg.table': A('backgrounds/table', 'TableCenter', 'none', 554, 188),

  'icon.refresh': A('icons/btn-refresh', 'IconButton (rematch)', 'icon', 120, 120),
  'icon.players': A('icons/btn-players', 'IconButton (players)', 'icon', 120, 120),
  'icon.settings': A('icons/btn-settings', 'IconButton (settings)', 'icon', 120, 120),
  'icon.cards': A('icons/btn-cards', 'DrawButton', 'icon', 184, 120),
  'icon.ready': A('icons/btn-ready', 'ReadyButton', 'icon', 186, 120),
  'icon.play': A('icons/btn-play', 'CastButton / Start', 'icon', 327, 150),
  'swatch.red': A('icons/swatch-red', 'ColorPicker', 'icon', 70, 74),
  'swatch.yellow': A('icons/swatch-yellow', 'ColorPicker', 'icon', 70, 74),
  'swatch.green': A('icons/swatch-green', 'ColorPicker', 'icon', 70, 74),
  'swatch.blue': A('icons/swatch-blue', 'ColorPicker', 'icon', 70, 74),

  'decor.cat': A('decorations/black-cat', 'Menu / Table decorations', 'decor', 180, 133),
  'decor.crystal': A('decorations/crystal-ball', 'Menu / Table decorations', 'decor', 99, 121),
  'decor.candles': A('decorations/candles', 'Table decorations', 'decor', 107, 123),
  'decor.books': A('decorations/books', 'Table decorations', 'decor', 128, 84),
  'decor.lamp': A('decorations/lamp', 'Menu backdrop', 'decor', 49, 165),
  'decor.banner': A('decorations/banner', 'Lobby', 'decor', 120, 161),
  'decor.airship': A('decorations/airship', 'Sky drift', 'decor', 159, 88),
  'decor.witch': A('decorations/witch-silhouette', 'Results', 'decor', 182, 164),
  'decor.sproutA': A('decorations/sprout-a', 'Menu foreground', 'decor', 107, 141),
  'decor.sproutB': A('decorations/sprout-b', 'Menu foreground', 'decor', 92, 113),
  'decor.cardFan': A('decorations/card-fan', 'Menu title', 'decor', 216, 107),
  'decor.pill': A('decorations/pill-red', 'Reference only', 'none', 129, 100),

  'fx.sparkle': A('effects/sparkle-big', 'Sparkle particles', 'none', 90, 102),
  'fx.sparklePurple': A('effects/sparkle-purple', 'Sparkle particles', 'none', 40, 48),
  'fx.sparkleSmall': A('effects/sparkle-small', 'Sparkle particles', 'none', 38, 48),
  'fx.shootingStar': A('effects/shooting-star', 'Sky / UNO burst', 'none', 162, 102),
} satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof ASSETS;

export function cardAssetKey(card: Card): AssetKey {
  if (card.type === 'wild') return 'card.wild';
  if (card.type === 'wild4') return 'card.wild4';
  return `card.${card.type}.${card.color}` as AssetKey;
}

export const avatarKey = (a: AvatarId) => `avatar.${a}` as AssetKey;

export const COLOR_HEX: Record<CardColor, string> = {
  red: '#E97870',
  yellow: '#F1B74F',
  green: '#89A98B',
  blue: '#74A8CB',
};

export const COLOR_NAME_TH: Record<CardColor, string> = {
  red: 'แดง',
  yellow: 'เหลือง',
  green: 'เขียว',
  blue: 'ฟ้า',
};

/** Preload every image so the first card flight never pops in. */
export function preloadAssets() {
  for (const a of Object.values(ASSETS)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = a.src;
  }
}
