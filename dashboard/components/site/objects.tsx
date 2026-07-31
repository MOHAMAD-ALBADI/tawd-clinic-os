"use client";

/* The isometric objects.

   Drawn as SVG rather than generated as images: they stay sharp at any density,
   weigh a couple of kilobytes each, inherit the brand blue from one place, and
   can be recoloured without a round trip to an image tool. A raster render would
   also have been the one part of the page that could not be edited.

   Each is built on a true isometric projection — 30° faces, a consistent light
   from the upper left — so the three read as one family rather than three
   separate drawings. */

const G = {
  top: "#4f8bff",
  left: "#1f4fd0",
  right: "#12307e",
  dark: "#0a1c47",
  edge: "#7ba9ff",
};

/** Stacked data planes — the layered system. */
export function ObjLayers() {
  const plate = (y: number, o: number) => (
    <g opacity={o}>
      <path d={`M60 ${y} 110 ${y + 26} 60 ${y + 52} 10 ${y + 26}Z`} fill={G.top} />
      <path d={`M10 ${y + 26} 60 ${y + 52} 60 ${y + 62} 10 ${y + 36}Z`} fill={G.left} />
      <path d={`M110 ${y + 26} 60 ${y + 52} 60 ${y + 62} 110 ${y + 36}Z`} fill={G.right} />
    </g>
  );
  return (
    <svg viewBox="0 0 120 130" role="img" aria-label="">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ba9ff" /><stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      {plate(66, 0.32)}
      {plate(44, 0.6)}
      <g>
        <path d="M60 12 110 38 60 64 10 38Z" fill="url(#lg1)" />
        <path d="M10 38 60 64 60 76 10 50Z" fill={G.left} />
        <path d="M110 38 60 64 60 76 110 50Z" fill={G.right} />
        {/* a small mark on the top face so it reads as a surface, not a shape */}
        <path d="M60 30 74 38 60 46 46 38Z" fill="#fff" opacity=".9" />
      </g>
    </svg>
  );
}

/** Shield on a plinth — security. */
export function ObjShield() {
  return (
    <svg viewBox="0 0 120 130" role="img" aria-label="">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ba9ff" /><stop offset="1" stopColor="#1341b8" />
        </linearGradient>
      </defs>
      {/* plinth */}
      <ellipse cx="60" cy="104" rx="46" ry="19" fill={G.dark} />
      <ellipse cx="60" cy="99" rx="46" ry="19" fill={G.right} />
      <ellipse cx="60" cy="96" rx="38" ry="15" fill={G.left} opacity=".85" />
      {/* shield */}
      <path d="M60 22 92 34v24c0 20-14 33-32 40-18-7-32-20-32-40V34Z" fill="url(#sg)" />
      <path d="M60 22 92 34v24c0 20-14 33-32 40Z" fill="#000" opacity=".16" />
      {/* padlock */}
      <rect x="49" y="56" width="22" height="18" rx="4" fill="#fff" />
      <path d="M53 56v-5a7 7 0 0 1 14 0v5" stroke="#fff" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <circle cx="60" cy="65" r="2.6" fill={G.left} />
    </svg>
  );
}

/** A cluster of floating cards — everything in one place. */
export function ObjCards() {
  const card = (x: number, y: number, w: number, h: number, fill: string, o = 1) => (
    <g opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={fill} />
      <rect x={x} y={y} width={w} height="3" rx="1.5" fill="#fff" opacity=".22" />
    </g>
  );
  return (
    <svg viewBox="0 0 120 130" role="img" aria-label="">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f8bff" /><stop offset="1" stopColor="#1341b8" />
        </linearGradient>
      </defs>
      <g transform="rotate(-14 60 65)">
        {card(6, 74, 34, 26, G.dark, 0.85)}
        {card(44, 80, 30, 24, G.right, 0.9)}
        {card(78, 70, 32, 26, G.dark, 0.8)}
        {card(24, 44, 36, 28, G.left)}
        {card(64, 38, 34, 28, G.right)}
        {/* the lit one, in front */}
        <g>
          <rect x="40" y="14" width="42" height="34" rx="6" fill="url(#cg)" />
          <rect x="46" y="22" width="22" height="3.4" rx="1.7" fill="#fff" opacity=".95" />
          <rect x="46" y="30" width="30" height="3.4" rx="1.7" fill="#fff" opacity=".55" />
          <rect x="46" y="38" width="16" height="3.4" rx="1.7" fill="#fff" opacity=".35" />
        </g>
      </g>
    </svg>
  );
}
