import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface RadarChartProps {
  data: Record<string, number>;
  playerName: string;
  size?: number;
  color?: string;
  comparisonData?: Record<string, number>;
  comparisonName?: string;
  comparisonColor?: string;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  playerName,
  size = 300,
  color = '#c68715',
  comparisonData,
  comparisonName = 'Whole Team Average',
  comparisonColor = '#38bdf8',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = size;
    const height = size;
    const margin = 44;
    const radius = Math.min(width, height) / 2 - margin;

    d3.select(container).selectAll('svg').remove();

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

    const axes = Object.keys(data);
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
        .style('font-size', '10.5px')
        .style('font-family', 'var(--font-mono)')
        .text(`${Math.round((level / levels) * 100)}`);
    }

    // Radial Axis Subtitle / Legend
    if (!comparisonData) {
      g.append('text')
        .attr('x', 0)
        .attr('y', radius + 32)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9c9ca6')
        .style('font-size', '11.5px')
        .style('font-weight', '600')
        .style('letter-spacing', '0.04em')
        .text('Radial Axes: Tactical Attribute Ratings (0 – 100)');
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

      const labelDistance = radius + 20;
      const lx = labelDistance * Math.cos(angleSlice * i - Math.PI / 2);
      const ly = labelDistance * Math.sin(angleSlice * i - Math.PI / 2);

      g.append('text')
        .attr('x', lx)
        .attr('y', ly + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9c9ca6')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .text(axis);
    });

    // Comparison Dataset Polygon (Whole Team Average)
    if (comparisonData) {
      const compPoints = axes.map((axis, i) => {
        const val = comparisonData[axis] || 0;
        const r = rScale(val);
        const x = r * Math.cos(angleSlice * i - Math.PI / 2);
        const y = r * Math.sin(angleSlice * i - Math.PI / 2);
        return [x, y];
      });

      const compPolygonPointsStr = compPoints.map((p) => p.join(',')).join(' ');

      g.append('polygon')
        .attr('points', compPolygonPointsStr)
        .attr('fill', comparisonColor)
        .attr('fill-opacity', 0.15)
        .attr('stroke', comparisonColor)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 3');

      compPoints.forEach(([x, y]) => {
        g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 3.5)
          .attr('fill', comparisonColor)
          .attr('stroke', '#0c0f16')
          .attr('stroke-width', 1.5);
      });
    }

    // Primary Player Dataset Polygon
    const radarPoints = axes.map((axis, i) => {
      const val = data[axis] || 0;
      const r = rScale(val);
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
        .attr('r', 4)
        .attr('fill', '#e59e1b')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);
    });
  }, [data, playerName, size, color, comparisonData, comparisonName, comparisonColor]);

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
        padding: '12px',
        width: '100%',
        maxWidth: `${size}px`,
        margin: '0 auto',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
};
