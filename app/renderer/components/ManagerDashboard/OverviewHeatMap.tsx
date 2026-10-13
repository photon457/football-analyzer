import React, { useEffect, useRef } from 'react';
import { SpatialEvent } from '../../services/api';

interface OverviewHeatMapProps {
  events?: SpatialEvent[];
  height?: number;
}

export const OverviewHeatMap: React.FC<OverviewHeatMapProps> = ({
  events = [],
  height = 240,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;

    // Clear with dark tactical pitch base
    ctx.fillStyle = '#0F131C';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Points to render on the heatmap
    // If events exist, use their coordinates; otherwise use representative tactical density hotspots matching reference
    const points: Array<{ x: number; y: number; weight: number }> = [];

    if (events && events.length > 10) {
      events.forEach((ev) => {
        points.push({
          x: (ev.x / 100) * width,
          y: (ev.y / 100) * canvasHeight,
          weight: 1.0,
        });
      });
    } else {
      // Hotspot clusters matching reference image:
      // Heavy center midfield & attacking zones, right channel, left channel
      const clusters = [
        { cx: 0.52 * width, cy: 0.52 * canvasHeight, count: 18, spread: 26 },
        { cx: 0.55 * width, cy: 0.32 * canvasHeight, count: 14, spread: 22 },
        { cx: 0.60 * width, cy: 0.22 * canvasHeight, count: 12, spread: 20 },
        { cx: 0.42 * width, cy: 0.48 * canvasHeight, count: 10, spread: 22 },
        { cx: 0.48 * width, cy: 0.72 * canvasHeight, count: 10, spread: 20 },
        { cx: 0.75 * width, cy: 0.30 * canvasHeight, count: 12, spread: 24 },
        { cx: 0.78 * width, cy: 0.70 * canvasHeight, count: 10, spread: 22 },
        { cx: 0.30 * width, cy: 0.50 * canvasHeight, count: 8, spread: 24 },
        { cx: 0.65 * width, cy: 0.85 * canvasHeight, count: 8, spread: 18 },
      ];

      clusters.forEach((c) => {
        for (let i = 0; i < c.count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * c.spread;
          points.push({
            x: c.cx + Math.cos(angle) * dist,
            y: c.cy + Math.sin(angle) * dist,
            weight: 0.8 + Math.random() * 0.4,
          });
        }
      });
    }

    // Step 1: Draw radial alpha blobs onto an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = canvasHeight;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, width, canvasHeight);

    points.forEach((p) => {
      const radius = 32;
      const grad = offCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      grad.addColorStop(0, `rgba(0, 0, 0, ${0.18 * p.weight})`);
      grad.addColorStop(0.5, `rgba(0, 0, 0, ${0.08 * p.weight})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      offCtx.fillStyle = grad;
      offCtx.beginPath();
      offCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      offCtx.fill();
    });

    // Step 2: Colorize using thermal palette (deep blue -> cyan -> gold -> bright yellow/amber -> orange)
    const imgData = offCtx.getImageData(0, 0, width, canvasHeight);
    const data = imgData.data;

    // Palette lookup (256 levels)
    const palette: Array<[number, number, number, number]> = [];
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      if (t < 0.05) {
        palette.push([0, 0, 0, 0]);
      } else if (t < 0.28) {
        // Deep blue to cyan-teal
        const f = (t - 0.05) / 0.23;
        palette.push([
          Math.round(20 + f * 30),
          Math.round(45 + f * 110),
          Math.round(85 + f * 130),
          Math.round(f * 130),
        ]);
      } else if (t < 0.58) {
        // Teal to gold
        const f = (t - 0.28) / 0.3;
        palette.push([
          Math.round(50 + f * 162),
          Math.round(155 + f * 19),
          Math.round(215 - f * 140),
          Math.round(130 + f * 75),
        ]);
      } else if (t < 0.82) {
        // Gold to bright amber / glowing yellow
        const f = (t - 0.58) / 0.24;
        palette.push([
          Math.round(212 + f * 43),
          Math.round(174 + f * 40),
          Math.round(75 - f * 45),
          Math.round(205 + f * 40),
        ]);
      } else {
        // Glowing orange-yellow peak
        const f = (t - 0.82) / 0.18;
        palette.push([
          Math.round(255 - f * 15),
          Math.round(214 - f * 50),
          Math.round(30),
          Math.round(245 + f * 10),
        ]);
      }
    }

    const coloredData = ctx.createImageData(width, canvasHeight);
    const cData = coloredData.data;

    for (let i = 3; i < data.length; i += 4) {
      const alpha = data[i];
      if (alpha > 0) {
        const entry = palette[alpha];
        cData[i - 3] = entry[0];
        cData[i - 2] = entry[1];
        cData[i - 1] = entry[2];
        cData[i] = entry[3];
      }
    }

    ctx.putImageData(coloredData, 0, 0);

    // Step 3: Draw crisp pitch markings on top
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;

    // Pitch boundary
    const pad = 4;
    ctx.strokeRect(pad, pad, width - pad * 2, canvasHeight - pad * 2);

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(width / 2, pad);
    ctx.lineTo(width / 2, canvasHeight - pad);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(width / 2, canvasHeight / 2, canvasHeight * 0.18, 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(width / 2, canvasHeight / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Left Penalty Box
    const boxW = width * 0.16;
    const boxH = canvasHeight * 0.58;
    const boxY = (canvasHeight - boxH) / 2;
    ctx.strokeRect(pad, boxY, boxW, boxH);

    // Left 6-yard Box
    const sBoxW = width * 0.06;
    const sBoxH = canvasHeight * 0.32;
    const sBoxY = (canvasHeight - sBoxH) / 2;
    ctx.strokeRect(pad, sBoxY, sBoxW, sBoxH);

    // Left Penalty Arc
    ctx.beginPath();
    ctx.arc(pad + boxW, canvasHeight / 2, canvasHeight * 0.14, -Math.PI / 2.8, Math.PI / 2.8);
    ctx.stroke();

    // Right Penalty Box
    ctx.strokeRect(width - pad - boxW, boxY, boxW, boxH);

    // Right 6-yard Box
    ctx.strokeRect(width - pad - sBoxW, sBoxY, sBoxW, sBoxH);

    // Right Penalty Arc
    ctx.beginPath();
    ctx.arc(width - pad - boxW, canvasHeight / 2, canvasHeight * 0.14, Math.PI - Math.PI / 2.8, Math.PI + Math.PI / 2.8);
    ctx.stroke();
  }, [events]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        background: '#0F131C',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        width={420}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};
