"use client";

interface SparkLineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  filled?: boolean;
  strokeWidth?: number;
}

export function SparkLine({
  data,
  color = "#14b8a6",
  height = 36,
  width = 80,
  filled = true,
  strokeWidth = 1.5,
}: SparkLineProps) {
  if (!data.length) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pad = 2;
  const W = width - pad * 2;
  const H = height - pad * 2;

  const points = data.map((v, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * W,
    y: pad + H - ((v - min) / range) * H,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const fillPath = filled
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(pad + H).toFixed(1)} L ${pad} ${(pad + H).toFixed(1)} Z`
    : "";

  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      {filled && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={fillPath} fill={`url(#${id})`} />}
      <path
        d={linePath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* last dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2.5}
        fill={color}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
