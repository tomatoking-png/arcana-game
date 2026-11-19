import { memo, type CSSProperties } from 'react';
import type { Card } from '@arcana/shared';
import { cardAssetKey } from '../assets/manifest';
import { AssetImage } from './AssetImage';
import { IconPlus, IconReverse, IconSkip, IconWild } from './Icons';

/** Card width as a multiple of the responsive --card-w token. */
export type CardScale = number;

const FRONT_RATIO = 234 / 141;
const BACK_RATIO = 235 / 166;

export const cardSize = (scale: CardScale = 1): CSSProperties => ({
  width: `calc(var(--card-w) * ${scale})`,
  height: `calc(var(--card-w) * ${scale} * ${FRONT_RATIO})`,
});
export const backSize = (scale: CardScale = 1): CSSProperties => ({
  width: `calc(var(--card-w) * ${scale} * ${FRONT_RATIO / BACK_RATIO})`,
  height: `calc(var(--card-w) * ${scale} * ${FRONT_RATIO})`,
});

/**
 * Card face: the reference-sheet artwork with the rank rendered as UI on top
 * (numbers are never baked into the image assets).
 */
export const CardFace = memo(function CardFace({ card, scale = 1, className = '', style }: { card: Card; scale?: CardScale; className?: string; style?: CSSProperties }) {
  const fs = `calc(var(--card-w) * ${scale} * 0.3)`;
  const corner = `calc(var(--card-w) * ${scale} * 0.2)`;
  return (
    <div className={`relative select-none ${className}`} style={{ ...cardSize(scale), ...style }}>
      <AssetImage asset={cardAssetKey(card)} className="absolute inset-0 h-full w-full object-contain" eager />
      {card.type === 'number' ? (
        <>
          <Rank value={card.value!} size={fs} style={{ left: '9%', top: '4.5%' }} />
          <Rank value={card.value!} size={`calc(${fs} * .62)`} style={{ right: '10%', bottom: '4%', transform: 'rotate(180deg)' }} />
        </>
      ) : (
        <div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            left: '8%',
            top: '5%',
            width: corner,
            height: corner,
            background: card.color ? 'rgb(248 230 201 / .95)' : 'rgb(48 38 56 / .9)',
            color: card.color ? '#302638' : '#F8E6C9',
            boxShadow: '0 2px 6px rgb(0 0 0 / .25)',
          }}
          aria-hidden
        >
          <ActionGlyph card={card} />
        </div>
      )}
      <span className="sr-only">{describeCard(card)}</span>
    </div>
  );
});

function Rank({ value, size, style }: { value: number; size: string; style: CSSProperties }) {
  return (
    <span
      className="font-display absolute leading-none"
      style={{
        fontSize: size,
        fontWeight: 700,
        color: '#F8E6C9',
        textShadow: '0 2px 0 rgb(48 38 56 / .55), 0 0 6px rgb(48 38 56 / .35)',
        textDecoration: value === 6 || value === 9 ? 'underline' : undefined,
        textDecorationThickness: '0.08em',
        textUnderlineOffset: '0.08em',
        ...style,
      }}
      aria-hidden
    >
      {value}
    </span>
  );
}

function ActionGlyph({ card }: { card: Card }) {
  const s = '72%';
  const sz = { width: s, height: s } as const;
  switch (card.type) {
    case 'skip':
      return <IconSkip style={sz} />;
    case 'reverse':
      return <IconReverse style={sz} />;
    case 'draw2':
      return <IconPlus n={2} style={{ width: '100%', height: '100%' }} />;
    case 'wild4':
      return <IconPlus n={4} style={{ width: '100%', height: '100%' }} />;
    case 'wild':
      return <IconWild style={sz} />;
    default:
      return null;
  }
}

export const CardBack = memo(function CardBack({ scale = 1, className = '', style }: { scale?: CardScale; className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={{ ...backSize(scale), ...style }}>
      <AssetImage asset="card.back" className="absolute inset-0 h-full w-full object-contain" eager />
    </div>
  );
});

const COLOR_TH = { red: 'แดง', yellow: 'เหลือง', green: 'เขียว', blue: 'ฟ้า' } as const;
export function describeCard(card: Card): string {
  const c = card.color ? COLOR_TH[card.color] : '';
  switch (card.type) {
    case 'number':
      return `${c} ${card.value}`;
    case 'skip':
      return `ข้าม ${c}`;
    case 'reverse':
      return `กลับทิศ ${c}`;
    case 'draw2':
      return `+2 ${c}`;
    case 'wild':
      return 'ไวลด์ (เปลี่ยนสี)';
    case 'wild4':
      return 'ไวลด์ +4';
  }
}
