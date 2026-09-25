// Icons copied verbatim from the "Poccabet Homepage Redesign" design canvas.
import type { CSSProperties } from "react";

type P = { size?: number; style?: CSSProperties };
const stroke = (w: number) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const MoonIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
export const SportsIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 4.5h-5L8 10z" /><path d="M12 3v4M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5L7 18.5M8 10L3.5 8.5" /></svg>
);
export const AviatorIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M3 17l18-10" /><path d="M10 13L6 9l2-1 6 3" /><path d="M14 15l-1 5 2-1 2-5" /></svg>
);
export const VirtualsIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><rect x="2" y="7" width="20" height="11" rx="5" /><path d="M7 11v3M5.5 12.5h3" /><circle cx="16" cy="11.5" r="0.8" /><circle cx="18" cy="13.5" r="0.8" /></svg>
);
export const JackpotIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M8 21h8M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
);
export const CasinoIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1" /><circle cx="16" cy="16" r="1" /><circle cx="12" cy="12" r="1" /></svg>
);
export const ChevronRight = ({ size = 14, color }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(color ? 2 : 2.4)} stroke={color ?? "currentColor"}><path d="M9 6l6 6-6 6" /></svg>
);
export const ChevronLeft = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.4)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronDown = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><path d="M6 9l6 6 6-6" /></svg>
);
export const StarIcon = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
);
export const GridIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>
);
export const HomeIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.9)}><path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></svg>
);
export const LiveIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.9)}><circle cx="12" cy="12" r="2.5" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></svg>
);
export const TicketShape = ({ accent }: { accent: string }) => (
  <svg width="68" height="46" viewBox="0 0 68 46" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
    <path d="M9 1H59a8 8 0 0 1 8 8V17a6 6 0 0 0 0 12V37a8 8 0 0 1-8 8H9a8 8 0 0 1-8-8V29a6 6 0 0 0 0-12V9a8 8 0 0 1 8-8Z" fill={accent} />
    <path d="M20 8V38" stroke="#13171C" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
  </svg>
);
export const ReceiptIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.9)}><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" /><path d="M9 11.5l2 2 4-4" /></svg>
);
export const UserIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.9)}><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></svg>
);
export const CloseIcon = ({ size = 18, width = 2.4 }: P & { width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const CheckIcon = ({ size = 18, style }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2.6)} style={style}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const TrackerIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /><circle cx="12" cy="12" r="2.5" /></svg>
);
export const LockIcon = ({ size = 16, width = 2.2 }: P & { width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(width)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const SearchIcon = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);

// Quick-nav extras and sport glyphs for the Shortcuts panel (same 24px line style).
export const HeadsetIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><path d="M4 14h3v6H5.5A1.5 1.5 0 0 1 4 18.5zM20 14h-3v6h1.5a1.5 1.5 0 0 0 1.5-1.5z" /><path d="M18 20c0 1.2-2 2-5 2" /></svg>
);
export const MoreIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><circle cx="8" cy="12" r="0.6" fill="currentColor" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /><circle cx="16" cy="12" r="0.6" fill="currentColor" /></svg>
);
export const BasketballIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3v18" /><path d="M5.6 5.6c3.2 3.4 3.2 9.4 0 12.8M18.4 5.6c-3.2 3.4-3.2 9.4 0 12.8" /></svg>
);
export const TennisIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><path d="M5 5.5c3.5 3.5 3.5 9.5 0 13M19 5.5c-3.5 3.5-3.5 9.5 0 13" /></svg>
);
export const TableTennisIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="10" cy="10" r="6.5" /><path d="M14.6 14.6l5.4 5.4" /><circle cx="19" cy="5" r="1.6" /></svg>
);
export const IceHockeyIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M7 3l6 14h7v3h-8.5L4.5 4" /><ellipse cx="6" cy="19" rx="3" ry="1.5" /></svg>
);
export const VolleyballIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><path d="M12 3c-1 4 0 7 3 9M3.5 9c4-1 8 0 10.5 3M7 19.5c3-3 5-5 7-7.5M21 12c-3 1.5-5 1.5-7 0" /></svg>
);
export const BaseballIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="12" cy="12" r="9" /><path d="M6 5.2c2.4 3.8 2.4 9.8 0 13.6M18 5.2c-2.4 3.8-2.4 9.8 0 13.6" /></svg>
);
export const AmFootballIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M4 20C4 11 11 4 20 4c0 9-7 16-16 16z" /><path d="M9 15l6-6M10.5 10.5l3 3M12.5 8.5l3 3M8.5 12.5l3 3" /></svg>
);
export const BoxingIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M7 11V7.5A4.5 4.5 0 0 1 11.5 3h2A4.5 4.5 0 0 1 18 7.5V12a5 5 0 0 1-5 5H9a2 2 0 0 1-2-2z" /><path d="M8 17v4h8v-4M7 12h4" /></svg>
);
export const DartsIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><circle cx="11" cy="13" r="8" /><circle cx="11" cy="13" r="4" /><path d="M11 13l9-9M17 4h3v3" /></svg>
);
export const CricketIcon = ({ size = 24 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M15 3l5 5-10 10-5-5z" /><path d="M5 13l-2 2 3 3" /><circle cx="18" cy="18" r="2" /></svg>
);
export const CopyIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" /></svg>
);
export const ShareIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(2)}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></svg>
);
export const EyeIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const EyeOffIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke(1.8)}><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></svg>
);
