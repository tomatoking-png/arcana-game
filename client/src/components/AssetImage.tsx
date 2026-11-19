import { useState, type CSSProperties } from 'react';
import { ASSETS, type AssetKey } from '../assets/manifest';

/**
 * Image from the asset manifest with a themed fallback if it fails to load,
 * so the game never shows a broken-image icon.
 */
export function AssetImage({
  asset,
  className = '',
  style,
  alt = '',
  eager,
}: {
  asset: AssetKey;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  eager?: boolean;
}) {
  const entry = ASSETS[asset];
  const [failed, setFailed] = useState(false);
  if (failed) return <Fallback kind={entry.fallback} className={className} style={style} />;
  return (
    <img
      src={entry.src}
      alt={alt}
      draggable={false}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
      style={style}
    />
  );
}

function Fallback({ kind, className, style }: { kind: string; className: string; style?: CSSProperties }) {
  if (kind === 'none') return null;
  const fill = kind === 'cardBack' ? '#302638' : kind === 'avatar' ? '#725D79' : kind === 'card' ? '#EFC5AE' : '#3d3046';
  return (
    <svg viewBox="0 0 100 160" className={className} style={style} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <rect x="4" y="4" width="92" height="152" rx="16" fill="#F8E6C9" />
      <rect x="11" y="11" width="78" height="138" rx="11" fill={fill} />
      <path d="M50 58 L55 75 L72 80 L55 85 L50 102 L45 85 L28 80 L45 75 Z" fill="#F1B74F" opacity=".9" />
    </svg>
  );
}
