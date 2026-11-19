import type { SVGProps } from 'react';

/** Rounded, soft-stroke icon set drawn to match the reference sheet's iconography. */
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export const IconSparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} stroke="none" fill="currentColor">
    <path d="M12 1.5c.5 4.6 2.6 8.3 9 10.5-6.4 2.2-8.5 5.9-9 10.5-.5-4.6-2.6-8.3-9-10.5 6.4-2.2 8.5-5.9 9-10.5Z" />
  </svg>
);
export const IconCopy = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="8" y="8" width="12" height="12" rx="3.5" />
    <path d="M16 5.5A2.5 2.5 0 0 0 13.5 3h-7A3.5 3.5 0 0 0 3 6.5v7A2.5 2.5 0 0 0 5.5 16" />
  </svg>
);
export const IconShare = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 13v4.5A3.5 3.5 0 0 0 8.5 21h7a3.5 3.5 0 0 0 3.5-3.5V13" />
  </svg>
);
export const IconDoor = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4H8a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6" />
    <path d="M17 8.5 20.5 12 17 15.5M20 12H10" />
  </svg>
);
export const IconSound = ({ size, on = true, ...p }: P & { on?: boolean }) => (
  <svg {...base(size)} {...p}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" fill="currentColor" />
    {on ? (
      <>
        <path d="M15.5 9a4 4 0 0 1 0 6" />
        <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
      </>
    ) : (
      <path d="m16 9.5 5 5m0-5-5 5" />
    )}
  </svg>
);
export const IconCrown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} stroke="none" fill="currentColor">
    <path d="M3.5 8.5 7.8 12 12 5.5 16.2 12l4.3-3.5-1.8 9.5a2 2 0 0 1-2 1.6H7.3a2 2 0 0 1-2-1.6Z" />
  </svg>
);
export const IconWifiOff = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.6M14 9.9a10 10 0 0 1 5 2.6M2 9a15 15 0 0 1 4.5-2.8M10.5 5.1A15 15 0 0 1 22 9" />
    <circle cx="12" cy="20" r=".6" fill="currentColor" />
  </svg>
);
export const IconCheck = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={3}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconSkip = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={3}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6.5 17.5 11-11" />
  </svg>
);
export const IconReverse = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={2.8}>
    <path d="M4.5 10a7.5 7.5 0 0 1 13.2-3.3L20 9" />
    <path d="M20 4.5V9h-4.5" />
    <path d="M19.5 14a7.5 7.5 0 0 1-13.2 3.3L4 15" />
    <path d="M4 19.5V15h4.5" />
  </svg>
);
export const IconPlus = ({ size, n, ...p }: P & { n: number }) => (
  <svg {...base(size)} {...p} viewBox="0 0 24 24" stroke="none" fill="currentColor">
    <text x="12" y="17" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight={700} fontSize={14}>+{n}</text>
  </svg>
);
export const IconWild = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} stroke="none">
    <path d="M12 2.5 14.2 9.8 12 12 9.8 9.8Z" fill="#E97870" />
    <path d="M21.5 12 14.2 14.2 12 12 14.2 9.8Z" fill="#74A8CB" />
    <path d="M12 21.5 9.8 14.2 12 12 14.2 14.2Z" fill="#89A98B" />
    <path d="M2.5 12 9.8 9.8 12 12 9.8 14.2Z" fill="#F1B74F" />
  </svg>
);
export const IconClose = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} strokeWidth={3}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const IconHand = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-7a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3.2 15a1.6 1.6 0 0 1 2.6-1.8L8 15.5" />
  </svg>
);
export const IconArrow = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
