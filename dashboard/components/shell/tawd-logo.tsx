interface TawdLogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
  glow?: boolean;
}

/**
 * The TAWD mark: three white bars ascending left→right, leaning forward.
 * Read at once as a mountain's steps (طود), a rising chart, and full signal.
 */
export function TawdLogoMark({ className, style, glow = true }: TawdLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="طود"
    >
      {glow && (
        <defs>
          <filter id="tawd-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <g transform="skewY(-10) translate(0 4)" filter={glow ? "url(#tawd-soft)" : undefined}>
        <rect x="2.5"  y="19" width="8.5" height="17" rx="2.5" fill="#ffffff" />
        <rect x="15"   y="12" width="8.5" height="24" rx="2.5" fill="#ffffff" />
        <rect x="27.5" y="5"  width="8.5" height="31" rx="2.5" fill="#ffffff" />
      </g>
    </svg>
  );
}

/**
 * Tiny 3-bar glyph — the system's section marker.
 * Replaces generic dots/rules next to section titles.
 */
export function TawdBarsGlyph({
  size = 12,
  color = "var(--accent-1)",
  className,
}: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g transform="skewY(-10) translate(0 1.5)">
        <rect x="0.5" y="7.5" width="3" height="6" rx="1" fill={color} opacity="0.45" />
        <rect x="5"   y="5"   width="3" height="8.5" rx="1" fill={color} opacity="0.7" />
        <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill={color} />
      </g>
    </svg>
  );
}
