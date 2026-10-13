import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { SpatialEvent, PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';

interface VoronoiPitchControlProps {
  events: SpatialEvent[];
  players: PlayerStats[];
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

interface PlayerPoint {
  id: string;
  name: string;
  shortName: string;
  position: string;
  jersey: number;
  x: number;
  y: number;
  passes: number;
}

export const VoronoiPitchControl: React.FC<VoronoiPitchControlProps> = ({
  events,
  players,
  height = 350,
  onSelectPlayer,
  selectedPlayerId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  if (!events || events.length === 0) {
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
          Territorial pitch control not available
        </div>
        <div style={{ fontSize: '12px', maxWidth: '380px', lineHeight: 1.5 }}>
          Territorial Voronoi tessellation requires spatial tracking coordinates. Positional distributions and squad structure are available in Treemap and Bubble charts.
        </div>
      </div>
    );
  }

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('voronoi-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  // Compute average player coordinates on pitch
  const playerPoints: PlayerPoint[] = useMemo(() => {
    const coords: Record<string, { totalX: number; totalY: number; count: number }> = {};
    events.forEach((e) => {
      if (!coords[e.player_id]) coords[e.player_id] = { totalX: 0, totalY: 0, count: 0 };
      coords[e.player_id].totalX += e.x;
      coords[e.player_id].totalY += e.y;
      coords[e.player_id].count += 1;
    });

    const active = players.filter((p) => p.is_starter || (coords[p.player_id]?.count || 0) > 0);

    return active.map((p) => {
      const c = coords[p.player_id];
      // Tactical default fallback if few touch coordinates
      let defX = 50;
      let defY = 50;
      if (p.primary_position === 'GK') {
        defX = 12;
        defY = 50;
      } else if (p.primary_position === 'DF') {
        defX = 28;
        defY = p.detailed_position?.includes('L') ? 25 : p.detailed_position?.includes('R') ? 75 : 50;
      } else if (p.primary_position === 'MF') {
        defX = 52;
        defY = p.detailed_position?.includes('L') ? 30 : p.detailed_position?.includes('R') ? 70 : 50;
      } else {
        defX = 76;
        defY = p.detailed_position?.includes('L') ? 26 : p.detailed_position?.includes('R') ? 74 : 50;
      }

      const avgX = c && c.count > 0 ? c.totalX / c.count : defX;
      const avgY = c && c.count > 0 ? c.totalY / c.count : defY;

      return {
        id: p.player_id,
        name: p.player_name,
        shortName: p.player_name.split(' ').pop() || p.player_name,
        position: p.primary_position,
        jersey: p.jersey_number,
        x: Math.min(94, Math.max(6, avgX)),
        y: Math.min(94, Math.max(6, avgY)),
        passes: p.passes_completed,
      };
    });
  }, [events, players]);

  useEffect(() => {
    if (!containerRef.current || playerPoints.length < 3) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 540));
    const margin = { top: 18, right: 20, bottom: 42, left: 48 };
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

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain([0, 100]).range([0, innerHeight]);

    // 1. Draw Football Pitch Background
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#091c13')
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1.5)
      .attr('rx', 4);

    // 2. Compute Voronoi Tessellation using d3.Delaunay
    const points: [number, number][] = playerPoints.map((p) => [xScale(p.x), yScale(p.y)]);
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, innerWidth, innerHeight]);

    const posColorMap: Record<string, string> = {
      FW: 'rgba(217, 119, 6, 0.28)',
      MF: 'rgba(198, 135, 21, 0.26)',
      DF: 'rgba(59, 130, 246, 0.24)',
      GK: 'rgba(100, 116, 139, 0.22)',
    };

    const voronoiGroup = g.append('g').attr('class', 'voronoi-cells');

    playerPoints.forEach((p, i) => {
      const cellPolygon = voronoi.cellPolygon(i);
      if (!cellPolygon) return;

      const isSelected = selectedPlayerId === p.id;
      const pathD = `M${cellPolygon.join('L')}Z`;

      voronoiGroup
        .append('path')
        .attr('d', pathD)
        .attr('fill', isSelected ? 'rgba(229, 197, 122, 0.45)' : posColorMap[p.position] || 'rgba(255,255,255,0.1)')
        .attr('stroke', isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.18)')
        .attr('stroke-width', isSelected ? 2 : 1)
        .style('cursor', onSelectPlayer ? 'pointer' : 'default')
        .on('mouseenter', (event) => {
          tooltipRef.current?.show(
            `<strong>${p.name}</strong> (#${p.jersey})<br/>` +
              `Territorial Zone: ${p.position}<br/>` +
              `Passes Completed: <strong>${p.passes}</strong><br/>` +
              `Mean Spatial Center: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`,
            event
          );
        })
        .on('mousemove', (event) => {
          tooltipRef.current?.move(event);
        })
        .on('mouseleave', () => {
          tooltipRef.current?.hide();
        })
        .on('click', () => {
          if (onSelectPlayer) onSelectPlayer(p.id);
        });
    });

    // 3. Pitch Tactical Line Markings Over Voronoi
    const pitchLines = g.append('g').attr('stroke', 'rgba(255, 255, 255, 0.35)').attr('stroke-width', 1.2).attr('fill', 'none').style('pointer-events', 'none');

    // Halfway line & center circle
    pitchLines.append('line').attr('x1', innerWidth / 2).attr('y1', 0).attr('x2', innerWidth / 2).attr('y2', innerHeight);
    const circleRadius = innerHeight * 0.18;
    pitchLines.append('circle').attr('cx', innerWidth / 2).attr('cy', innerHeight / 2).attr('r', circleRadius);
    pitchLines.append('circle').attr('cx', innerWidth / 2).attr('cy', innerHeight / 2).attr('r', 2.5).attr('fill', 'rgba(255,255,255,0.5)');

    // Penalty Boxes
    const boxW = innerWidth * 0.165;
    const boxH = innerHeight * 0.55;
    const boxY = (innerHeight - boxH) / 2;
    pitchLines.append('rect').attr('x', 0).attr('y', boxY).attr('width', boxW).attr('height', boxH);
    pitchLines.append('rect').attr('x', innerWidth - boxW).attr('y', boxY).attr('width', boxW).attr('height', boxH);

    // 4. Draw Player Focal Points
    const nodesGroup = g.append('g').attr('class', 'player-nodes');
    playerPoints.forEach((p) => {
      const cx = xScale(p.x);
      const cy = yScale(p.y);
      const isSelected = selectedPlayerId === p.id;

      const nodeG = nodesGroup.append('g').style('pointer-events', 'none');

      nodeG
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', isSelected ? 8.5 : 6)
        .attr('fill', isSelected ? '#ffffff' : '#e5c57a')
        .attr('stroke', '#0d1117')
        .attr('stroke-width', 1.8);

      nodeG
        .append('text')
        .attr('x', cx)
        .attr('y', cy + 13)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? '#f59e0b' : '#cbd5e1')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .text(p.shortName);
    });

    // 5. Y Axis (Pitch Width)
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
      .text('Y-Axis: Pitch Width (0m Left Flank → 100m Right Flank)');

    // 6. X Axis (Pitch Length)
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((d) => (d === 50 ? '50m' : `${d}m`))
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
      .attr('y', innerHeight + 32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text('X-Axis: Pitch Length (0m Defending Goal → 100m Attacking Goal)');
  }, [playerPoints, height, selectedPlayerId, onSelectPlayer]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: `${height}px`,
        position: 'relative',
        background: '#0a0e17',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
};
