interface TawdLogoMarkProps {
  className?: string;
  style?: React.CSSProperties;
}

export function TawdLogoMark({ className, style }: TawdLogoMarkProps) {
  return (
    <svg
      viewBox="0 0 36 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="طود"
    >
      <defs>
        {/* Shadow face — left side in darkness */}
        <linearGradient id="tawd-gl" x1="1" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#134e4a" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>

        {/* Light face — right side catches illumination */}
        <linearGradient id="tawd-gr" x1="0" y1="1" x2="0.3" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="55%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#ecfdf8" />
        </linearGradient>

        {/* Base — ground shadow */}
        <linearGradient id="tawd-gb" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#134e4a" />
          <stop offset="100%" stopColor="#115e59" />
        </linearGradient>

        {/* Summit radial halo */}
        <radialGradient id="tawd-sg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cbf6ef" stopOpacity="1" />
          <stop offset="60%" stopColor="#14b8a6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </radialGradient>

        {/* Glow filter for summit dot */}
        <filter id="tawd-gf" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left face — shadow side */}
      <polygon points="3,38 18,3 18,25" fill="url(#tawd-gl)" />

      {/* Right face — illuminated side */}
      <polygon points="18,3 33,38 18,25" fill="url(#tawd-gr)" />

      {/* Base — ground */}
      <polygon points="3,38 18,25 33,38" fill="url(#tawd-gb)" />

      {/* Ridge line: center crest catches a sliver of light */}
      <line x1="18" y1="3" x2="18" y2="25"
        stroke="rgba(45,212,191,0.25)" strokeWidth="0.6" />

      {/* Summit ambient halo — pulses via CSS */}
      <circle cx="18" cy="3" r="7"
        fill="url(#tawd-sg)"
        className="tawd-summit-glow" />

      {/* Summit bright point */}
      <circle cx="18" cy="3" r="1.6"
        fill="#fefce8"
        filter="url(#tawd-gf)" />
    </svg>
  );
}
