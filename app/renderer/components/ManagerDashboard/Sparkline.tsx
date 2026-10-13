import React, { useId } from 'react';

interface SparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  color?: string;
  seedIndex?: number;
}

// Preset dynamic waveforms matching reference screenshot
const PRESET_WAVEFORMS: number[][] = [
  [6.8, 8.2, 7.1, 8.6, 8.5], // Saka: rise, dip, peak, finish high
  [7.2, 7.0, 8.4, 7.3, 8.0], // Havertz: dip, peak, dip, rise
  [8.2, 7.1, 8.0, 7.8, 8.5], // Caicedo: high, dip, rise, high
  [6.9, 7.4, 7.2, 8.5, 7.6], // Palmer: steady rise, peak, finish
  [7.5, 7.1, 7.8, 7.2, 7.3], // Fernandes: oscillation
  [6.8, 7.2, 7.0, 7.5, 7.0], // Sanchez: wave
  [7.0, 8.3, 7.2, 8.6, 8.5], // Saliba: double peak
];

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 96,
  height = 22,
  color = '#D4A34B',
  seedIndex = 0,
}) => {
  const gradientId = useId().replace(/:/g, '_');
  const points = data && data.length >= 4 ? data : PRESET_WAVEFORMS[seedIndex % PRESET_WAVEFORMS.length];

  const minVal = 6.4;
  const maxVal = 9.0;
  const range = maxVal - minVal;

  const padX = 2;
  const padY = 2;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((val, idx) => {
    const x = padX + (idx / (points.length - 1)) * innerW;
    const y = height - padY - ((val - minVal) / range) * innerH;
    return { x, y };
  });

  // Polyline path string matching reference's crisp angular/smooth line
  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPoints = `${coords[0].x.toFixed(1)},${height} ${linePoints} ${coords[coords.length - 1].x.toFixed(1)},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Gradient Area Fill */}
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />

      {/* Dynamic Gold Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
