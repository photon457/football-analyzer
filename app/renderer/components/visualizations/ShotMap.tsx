import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SpatialEvent } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';

interface ShotMapProps {
  events: SpatialEvent[];
  height?: number;
}

export const ShotMap: React.FC<ShotMapProps> = ({ events, height = 300 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('shotmap-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  const shotEvents = events.filter((e) => e.event_type === 'shot');

  if (!events || shotEvents.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: `${height}px`,
          background: 'rgba(14, 15, 18, 0.75)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-muted, #8b8f9a)',
        }}
      >
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-secondary, #d1d5db)', marginBottom: '4px' }}>
          Shot map telemetry not available
        </div>
        <div style={{ fontSize: '12px', maxWidth: '380px', lineHeight: 1.5 }}>
          No spatial shot coordinates recorded for this match. Total shot volume and individual player goal statistics remain fully available.
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 450));
    const margin = { top: 18, right: 20, bottom: 44, left: 48 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')
      .style('max-width', '100%');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Coordinate mapping: Focus on attacking half (x: 50 to 100)
    const xScale = d3.scaleLinear().domain([50, 100]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([0, innerHeight]);

    // Attacking Half Pitch Canvas
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#091c13')
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1.5)
      .attr('rx', 4);

    const pitchLines = g.append('g').attr('stroke', 'rgba(255, 255, 255, 0.25)').attr('stroke-width', 1.2).attr('fill', 'none');

    // Halfway line (left boundary)
    pitchLines.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', innerHeight);

    // Goal line (right boundary)
    pitchLines.append('line').attr('x1', innerWidth).attr('y1', 0).attr('x2', innerWidth).attr('y2', innerHeight);

    // Goal Post on Right (y = 44 to 56)
    const goalTop = yScale(44);
    const goalBottom = yScale(56);
    g.append('line')
      .attr('x1', innerWidth)
      .attr('y1', goalTop)
      .attr('x2', innerWidth + 4)
      .attr('y2', goalTop)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3);
    g.append('line')
      .attr('x1', innerWidth)
      .attr('y1', goalBottom)
      .attr('x2', innerWidth + 4)
      .attr('y2', goalBottom)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3);
    g.append('line')
      .attr('x1', innerWidth + 4)
      .attr('y1', goalTop)
      .attr('x2', innerWidth + 4)
      .attr('y2', goalBottom)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Penalty Box (x: 83.5 to 100, y: 22 to 78)
    const boxX = xScale(83.5);
    const boxW = innerWidth - boxX;
    const boxY = yScale(22);
    const boxH = yScale(78) - boxY;
    pitchLines.append('rect').attr('x', boxX).attr('y', boxY).attr('width', boxW).attr('height', boxH);

    // 6-yard Box (x: 94.5 to 100, y: 37 to 63)
    const sixX = xScale(94.5);
    const sixW = innerWidth - sixX;
    const sixY = yScale(37);
    const sixH = yScale(63) - sixY;
    pitchLines.append('rect').attr('x', sixX).attr('y', sixY).attr('width', sixW).attr('height', sixH);

    // Penalty Spot (x: 88.5, y: 50)
    pitchLines.append('circle').attr('cx', xScale(88.5)).attr('cy', yScale(50)).attr('r', 2.5).attr('fill', 'rgba(255,255,255,0.4)');

    // Shot outcome colors
    const getShotColor = (result: string) => {
      switch (result?.toLowerCase()) {
        case 'goal':
          return '#10b981'; // Emerald
        case 'saved':
          return '#3b82f6'; // Blue
        case 'blocked':
          return '#f59e0b'; // Amber
        default:
          return '#ef4444'; // Red
      }
    };

    // Plot Shots
    g.selectAll('.shot-bubble')
      .data(shotEvents)
      .enter()
      .append('circle')
      .attr('class', 'shot-bubble')
      .attr('cx', (d) => xScale(Math.max(50, d.x)))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => {
        const xg = d.metadata?.xg || 0.15;
        return Math.max(5, Math.min(18, xg * 22));
      })
      .attr('fill', (d) => getShotColor(d.metadata?.shot_result || ''))
      .attr('fill-opacity', 0.8)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const res = d.metadata?.shot_result || 'shot';
        const xg = d.metadata?.xg || 'N/A';
        const bp = d.metadata?.body_part || 'boot';
        tooltipRef.current?.show(
          `<strong>${res.toUpperCase()}</strong> (${d.minute}')<br/>` +
            `Player: ${d.player_id.replace('p_', '').replace('_', ' ')}<br/>` +
            `Expected Goals (xG): <strong>${xg}</strong><br/>` +
            `Body part: ${bp}`,
          event
        );
      })
      .on('mousemove', (event) => {
        tooltipRef.current?.move(event);
      })
      .on('mouseleave', () => {
        tooltipRef.current?.hide();
      });

    // Coordinate Axes
    // Y Axis (Pitch Width)
    const yAxis = g.append('g').call(
      d3
        .axisLeft(yScale)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat((d) => `${d}m`)
    );
    yAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    yAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    yAxis.selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)');

    // Y Axis Label
    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text('Y-Axis: Pitch Width (0m Left → 100m Right Touchline)');

    // X Axis (Pitch Length)
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([50, 60, 70, 80, 90, 100])
          .tickFormat((d) => (d === 50 ? '50m' : d === 100 ? '100m' : `${d}m`))
      );
    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis.selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)');

    // X Axis Label
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text('X-Axis: Attacking Pitch Length (50m Halfway → 100m Goal Line)');

    // Legend inside pitch
    const legend = g.append('g').attr('transform', `translate(8, ${innerHeight - 14})`);
    const labels = [
      { text: 'Goal', color: '#10b981' },
      { text: 'Saved', color: '#3b82f6' },
      { text: 'Blocked', color: '#f59e0b' },
      { text: 'Miss', color: '#ef4444' },
    ];
    let offset = 0;
    labels.forEach((l) => {
      legend.append('circle').attr('cx', offset + 4).attr('cy', 0).attr('r', 3.5).attr('fill', l.color);
      legend.append('text').attr('x', offset + 12).attr('y', 3).attr('fill', '#9ca3af').attr('font-size', '11.5px').text(l.text);
      offset += 62;
    });

    legend.append('text')
      .attr('x', innerWidth - 10)
      .attr('y', 3)
      .attr('text-anchor', 'end')
      .attr('fill', '#9ca3af')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .text(`${shotEvents.length} Total Shots`);
  }, [events, height, shotEvents]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: `${height}px`,
        position: 'relative',
        background: 'rgba(14, 15, 18, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '12px 8px 8px 8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
};
