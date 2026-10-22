import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface RadarChartProps {
  data: Record<string, number> | Array<{ axis: string; value: number; comparison?: number }>;
  playerName?: string;
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  comparisonData?: Record<string, number>;
  comparisonName?: string;
  comparisonColor?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  playerName,
  size,
  width: propWidth,
  height: propHeight,
  color = '#c68715',
  comparisonData,
  comparisonName = 'League Standard',
  comparisonColor = '#38bdf8',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    // 1. Normalize data structure
    let normalizedData: Record<string, number> = {};
    let resolvedCompData: Record<string, number> | undefined = comparisonData;

    if (Array.isArray(data)) {
      normalizedData = {};
      const arrayComp: Record<string, number> = {};
      let hasComp = false;
      data.forEach((item: any) => {
        if (item && item.axis) {
          normalizedData[item.axis] = typeof item.value === 'number' && !isNaN(item.value) ? item.value : 50;
          if (typeof item.comparison === 'number' && !isNaN(item.comparison)) {
            arrayComp[item.axis] = item.comparison;
            hasComp = true;
          }
        }
      });
      if (!resolvedCompData && hasComp) {
        resolvedCompData = arrayComp;
      }
    } else if (data && typeof data === 'object') {
      Object.entries(data).forEach(([k, v]) => {
        normalizedData[k] = typeof v === 'number' && !isNaN(v) ? v : 50;
      });
    }

    const axes = Object.keys(normalizedData);
    if (axes.length < 3) {
      // Empty / insufficient data placeholder
      const emptyDiv = d3
        .select(container)
        .append('div')
        .style('padding', '24px')
        .style('text-align', 'center')
        .style('color', '#6b7280')
        .style('font-size', '12px')
        .text('Tactical radar telemetry unavailable for selected fixture');
      return;
    }

    const chartSize = size || propWidth || propHeight || 280;
    const width = chartSize;
    const height = chartSize;
    const margin = 38;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')
      .style('max-width', `${width}px`)
      .style('margin', '0 auto');

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const totalAxes = axes.length;
    const angleSlice = (Math.PI * 2) / totalAxes;

    // Radius scale (0 to 100)
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, radius]);

    // Concentric grid circles / polygons
    const levels = 4;
    for (let level = 1; level <= levels; level++) {
      const levelFactor = radius * (level / levels);
      const points = axes.map((_, i) => {
        const x = levelFactor * Math.cos(angleSlice * i - Math.PI / 2);
        const y = levelFactor * Math.sin(angleSlice * i - Math.PI / 2);
        return `${x},${y}`;
      });

      g.append('polygon')
        .attr('points', points.join(' '))
        .attr('stroke', 'rgba(255, 255, 255, 0.08)')
        .attr('stroke-width', 1)
        .attr('fill', level === levels ? 'rgba(198, 135, 21, 0.04)' : 'none');

      // Concentric Scale Axis Labels (0-100)
      g.append('text')
        .attr('x', 4)
        .attr('y', -levelFactor + 3)
        .attr('fill', 'rgba(255, 255, 255, 0.35)')
        .style('font-size', '9.5px')
        .style('font-family', 'var(--font-mono)')
        .text(`${Math.round((level / levels) * 100)}`);
    }

    // Axis Lines & Labels
    axes.forEach((axis, i) => {
      const x = radius * Math.cos(angleSlice * i - Math.PI / 2);
      const y = radius * Math.sin(angleSlice * i - Math.PI / 2);

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', 'rgba(255, 255, 255, 0.12)')
        .attr('stroke-width', 1);

      const labelDistance = radius + 18;
      const lx = labelDistance * Math.cos(angleSlice * i - Math.PI / 2);
      const ly = labelDistance * Math.sin(angleSlice * i - Math.PI / 2);

      g.append('text')
        .attr('x', lx)
        .attr('y', ly + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#a0aab8')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .text(axis);
    });

    // Comparison Dataset Polygon (e.g. League Standard or Team Baseline)
    if (resolvedCompData) {
      const compPoints = axes.map((axis, i) => {
        const val = typeof resolvedCompData![axis] === 'number' && !isNaN(resolvedCompData![axis])
          ? resolvedCompData![axis]
          : 50;
        const r = rScale(Math.min(100, Math.max(0, val)));
        const x = r * Math.cos(angleSlice * i - Math.PI / 2);
        const y = r * Math.sin(angleSlice * i - Math.PI / 2);
        return [x, y];
      });

      const compPolygonPointsStr = compPoints.map((p) => p.join(',')).join(' ');

      g.append('polygon')
        .attr('points', compPolygonPointsStr)
        .attr('fill', comparisonColor)
        .attr('fill-opacity', 0.12)
        .attr('stroke', comparisonColor)
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4 3');

      compPoints.forEach(([x, y]) => {
        g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 3)
          .attr('fill', comparisonColor)
          .attr('stroke', '#0c0f16')
          .attr('stroke-width', 1.5);
      });
    }

    // Primary Dataset Polygon
    const radarPoints = axes.map((axis, i) => {
      const val = typeof normalizedData[axis] === 'number' && !isNaN(normalizedData[axis])
        ? normalizedData[axis]
        : 50;
      const r = rScale(Math.min(100, Math.max(0, val)));
      const x = r * Math.cos(angleSlice * i - Math.PI / 2);
      const y = r * Math.sin(angleSlice * i - Math.PI / 2);
      return [x, y];
    });

    const polygonPointsStr = radarPoints.map((p) => p.join(',')).join(' ');

    g.append('polygon')
      .attr('points', polygonPointsStr)
      .attr('fill', color)
      .attr('fill-opacity', 0.28)
      .attr('stroke', color)
      .attr('stroke-width', 2);

    // Primary coordinate dots
    radarPoints.forEach(([x, y]) => {
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 3.8)
        .attr('fill', color)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);
    });
  }, [data, playerName, size, propWidth, propHeight, color, comparisonData, comparisonName, comparisonColor]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(14, 15, 18, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '10px',
        width: '100%',
        maxWidth: `${size || propWidth || 280}px`,
        margin: '0 auto',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
};
