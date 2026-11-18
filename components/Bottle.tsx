import { useId } from 'react';

export type BottleKind = 'dropper' | 'lotion' | 'jar';

type Props = {
  kind?: BottleKind;
  liquid?: string;
  label?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Temporary vector product stand-in. Replace with verified product photography. */
export default function Bottle({ kind = 'dropper', liquid = '#D9A441', label = true, className, style }: Props) {
  const id = useId().replace(/:/g, '');
  const glass = `g${id}`, liq = `l${id}`, cream = `c${id}`;
  return (
    <svg viewBox="0 0 120 240" className={className} style={style} role="img" aria-label="VELUNE product">
      <defs>
        <linearGradient id={glass} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#d8c4b0" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id={liq} x1="0" x2="1">
          <stop offset="0" stopColor={liquid} stopOpacity=".95" />
          <stop offset=".6" stopColor={liquid} />
          <stop offset="1" stopColor="#33241F" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id={cream} x1="0" x2="1">
          <stop offset="0" stopColor="#fffaf3" />
          <stop offset=".65" stopColor="#f1e2d1" />
          <stop offset="1" stopColor="#d9c3ac" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="232" rx="44" ry="5" fill="#33241F" opacity=".14" />
      {kind === 'dropper' && (
        <g>
          <rect x="44" y="6" width="32" height="50" rx="7" fill="#1d1511" />
          <rect x="40" y="54" width="40" height="16" rx="3" fill="#2d231d" />
          <rect x="24" y="70" width="72" height="158" rx="14" fill={`url(#${glass})`} stroke="#33241F" strokeOpacity=".15" />
          <rect x="28" y="116" width="64" height="108" rx="10" fill={`url(#${liq})`} />
          <rect x="56" y="70" width="8" height="104" rx="4" fill={liquid} opacity=".75" />
          <rect x="32" y="80" width="5" height="136" rx="2.5" fill="#fff" opacity=".5" />
          {label && <text x="60" y="196" textAnchor="middle" fontSize="8" letterSpacing="2.4" fill="#33241F" fontFamily="Cormorant Garamond, serif">VELUNE</text>}
        </g>
      )}
      {kind === 'lotion' && (
        <g>
          <rect x="26" y="14" width="68" height="168" rx="28" fill={`url(#${cream})`} stroke="#33241F" strokeOpacity=".12" />
          <rect x="46" y="180" width="28" height="14" rx="3" fill="#DCC5B0" />
          <rect x="52" y="192" width="16" height="34" rx="5" fill="#A77C60" />
          <rect x="34" y="30" width="5" height="120" rx="2.5" fill="#fff" opacity=".7" />
          {label && <text x="60" y="104" textAnchor="middle" fontSize="9" letterSpacing="2.6" fill="#33241F" fontFamily="Cormorant Garamond, serif">VELUNE</text>}
        </g>
      )}
      {kind === 'jar' && (
        <g>
          <rect x="12" y="132" width="96" height="94" rx="18" fill={`url(#${cream})`} stroke="#33241F" strokeOpacity=".12" />
          <rect x="8" y="104" width="104" height="36" rx="10" fill="#A77C60" />
          <rect x="16" y="110" width="88" height="5" rx="2.5" fill="#fff" opacity=".25" />
          {label && <text x="60" y="186" textAnchor="middle" fontSize="9" letterSpacing="2.6" fill="#33241F" fontFamily="Cormorant Garamond, serif">VELUNE</text>}
        </g>
      )}
    </svg>
  );
}
