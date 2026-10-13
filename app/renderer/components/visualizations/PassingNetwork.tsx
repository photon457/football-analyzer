import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { SpatialEvent, PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';

interface PassingNetworkProps {
  events: SpatialEvent[];
  players: PlayerStats[];
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

interface NodeData {
  id: string;
  name: string;
  shortName: string;
  position: string;
  jersey: number;
  x: number;
  y: number;
  passCount: number;
}

interface LinkData {
  source: string;
  target: string;
  value: number;
}

export const PassingNetwork: React.FC<PassingNetworkProps> = ({
  events,
  players,
  height = 340,
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
          Tactical passing network not available
        </div>
        <div style={{ fontSize: '12px', maxWidth: '380px', lineHeight: 1.5 }}>
          Passing network graph requires coordinate pass sequence events. Tabular match data records overall pass completions and accuracy in the squad summary.
        </div>
      </div>
    );
  }

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('passing-network-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  // Compute player average positions and pass links between players
  const { nodes, links } = useMemo(() => {
    // 1. Calculate average positions for players who participated
    const playerPositions: Record<string, { totalX: number; totalY: number; count: number; passes: number }> = {};

    events.forEach((ev) => {
      if (!playerPositions[ev.player_id]) {
        playerPositions[ev.player_id] = { totalX: 0, totalY: 0, count: 0, passes: 0 };
      }
      playerPositions[ev.player_id].totalX += ev.x;
      playerPositions[ev.player_id].totalY += ev.y;
      playerPositions[ev.player_id].count += 1;
      if (ev.event_type === 'pass') {
        playerPositions[ev.player_id].passes += 1;
      }
    });

    const activePlayers = players.filter((p) => (playerPositions[p.player_id]?.count || 0) > 0 || p.is_starter);

    const calculatedNodes: NodeData[] = activePlayers.map((p) => {
      const pos = playerPositions[p.player_id];
      // Default formation fallback if no spatial coordinates
      let defX = 50;
      let defY = 50;
      if (p.primary_position === 'GK') {
        defX = 12;
        defY = 50;
      } else if (p.primary_position === 'DF') {
        defX = 30;
        defY = p.detailed_position?.includes('L') ? 22 : p.detailed_position?.includes('R') ? 78 : 50;
      } else if (p.primary_position === 'MF') {
        defX = 55;
        defY = p.detailed_position?.includes('L') ? 28 : p.detailed_position?.includes('R') ? 72 : 50;
      } else {
        defX = 75;
        defY = p.detailed_position?.includes('L') ? 25 : p.detailed_position?.includes('R') ? 75 : 50;
      }

      const avgX = pos && pos.count > 0 ? pos.totalX / pos.count : defX;
      const avgY = pos && pos.count > 0 ? pos.totalY / pos.count : defY;

      return {
        id: p.player_id,
        name: p.player_name,
        shortName: p.player_name.split(' ').pop() || p.player_name,
        position: p.primary_position,
        jersey: p.jersey_number,
        x: Math.min(94, Math.max(6, avgX)),
        y: Math.min(94, Math.max(6, avgY)),
        passCount: p.passes_completed || pos?.passes || 0,
      };
    });

    // 2. Build passing connection links
    // Analyze sequential pass events or spatial proximity to derive connection strengths
    const linkMap: Record<string, number> = {};
    const passEvents = events.filter((e) => e.event_type === 'pass');

    for (let i = 0; i < passEvents.length - 1; i++) {
      const e1 = passEvents[i];
      const e2 = passEvents[i + 1];
      if (e1.player_id !== e2.player_id && Math.abs(e1.minute - e2.minute) <= 1) {
        const key = [e1.player_id, e2.player_id].sort().join('__');
        linkMap[key] = (linkMap[key] || 0) + 1;
      }
    }

    const calculatedLinks: LinkData[] = [];
    Object.entries(linkMap).forEach(([key, count]) => {
      const [source, target] = key.split('__');
      if (count >= 2) {
        calculatedLinks.push({ source, target, value: count });
      }
    });

    // If few sequential links detected, add positional chemistry links based on completed passes
    if (calculatedLinks.length < 5 && calculatedNodes.length >= 2) {
      for (let i = 0; i < calculatedNodes.length; i++) {
        for (let j = i + 1; j < calculatedNodes.length; j++) {
          const n1 = calculatedNodes[i];
          const n2 = calculatedNodes[j];
          const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (dist < 38) {
            const weight = Math.round(Math.min(n1.passCount, n2.passCount) * 0.15);
            if (weight >= 2) {
              calculatedLinks.push({ source: n1.id, target: n2.id, value: weight });
            }
          }
        }
      }
    }

    return { nodes: calculatedNodes, links: calculatedLinks };
  }, [events, players]);

  useEffect(() => {
    if (!containerRef.current) return;

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

    // 1. Draw Tactical Football Pitch Background
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#091c13')
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1.5)
      .attr('rx', 4);

    const pitchLines = g.append('g').attr('stroke', 'rgba(255, 255, 255, 0.28)').attr('stroke-width', 1.2).attr('fill', 'none');

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

    // 6-yard boxes
    const goalBoxW = innerWidth * 0.055;
    const goalBoxH = innerHeight * 0.26;
    const goalBoxY = (innerHeight - goalBoxH) / 2;
    pitchLines.append('rect').attr('x', 0).attr('y', goalBoxY).attr('width', goalBoxW).attr('height', goalBoxH);
    pitchLines.append('rect').attr('x', innerWidth - goalBoxW).attr('y', goalBoxY).attr('width', goalBoxW).attr('height', goalBoxH);

    // Node coordinate lookup
    const nodeMap = new Map<string, NodeData>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const maxLinkVal = d3.max(links, (d) => d.value) || 1;
    const linkWidthScale = d3.scaleLinear().domain([1, maxLinkVal]).range([1.2, 4.5]);
    const linkOpacityScale = d3.scaleLinear().domain([1, maxLinkVal]).range([0.4, 0.95]);

    // 2. Draw Links (Edges)
    const linksGroup = g.append('g').attr('class', 'passing-links');
    links.forEach((l) => {
      const src = nodeMap.get(l.source);
      const tgt = nodeMap.get(l.target);
      if (!src || !tgt) return;

      const isHighlighted = selectedPlayerId === l.source || selectedPlayerId === l.target;

      linksGroup
        .append('line')
        .attr('x1', xScale(src.x))
        .attr('y1', yScale(src.y))
        .attr('x2', xScale(tgt.x))
        .attr('y2', yScale(tgt.y))
        .attr('stroke', isHighlighted ? '#e5c57a' : '#d2ae5e')
        .attr('stroke-width', linkWidthScale(l.value) + (isHighlighted ? 1 : 0))
        .attr('stroke-opacity', isHighlighted ? 1 : linkOpacityScale(l.value))
        .attr('stroke-linecap', 'round');
    });

    // 3. Draw Nodes (Players)
    const maxPasses = d3.max(nodes, (d) => d.passCount) || 1;
    const radiusScale = d3.scaleLinear().domain([0, maxPasses]).range([10, 19]);

    const posColorMap: Record<string, string> = {
      FW: '#d97706',
      MF: '#c68715',
      DF: '#3b82f6',
      GK: '#64748b',
    };

    const nodesGroup = g.append('g').attr('class', 'passing-nodes');

    nodes.forEach((n) => {
      const cx = xScale(n.x);
      const cy = yScale(n.y);
      const r = radiusScale(n.passCount);
      const isSelected = selectedPlayerId === n.id;

      const nodeG = nodesGroup
        .append('g')
        .style('cursor', onSelectPlayer ? 'pointer' : 'default')
        .on('mouseenter', (event) => {
          tooltipRef.current?.show(
            `<strong>${n.name}</strong> (#${n.jersey})<br/>` +
              `Position: ${n.position}<br/>` +
              `Passes Completed: <strong>${n.passCount}</strong><br/>` +
              `Avg Position: x: ${n.x.toFixed(1)}, y: ${n.y.toFixed(1)}`,
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
          if (onSelectPlayer) onSelectPlayer(n.id);
        });

      // Node circle
      nodeG
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', r)
        .attr('fill', isSelected ? '#e5c57a' : posColorMap[n.position] || '#c68715')
        .attr('stroke', isSelected ? '#ffffff' : '#0f172a')
        .attr('stroke-width', isSelected ? 2.5 : 1.5)
        .attr('fill-opacity', 0.92);

      // Jersey number inside circle
      nodeG
        .append('text')
        .attr('x', cx)
        .attr('y', cy + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? '#111827' : '#ffffff')
        .style('font-size', '11.5px')
        .style('font-weight', '700')
        .style('user-select', 'none')
        .text(n.jersey);

      // Player short name below circle
      nodeG
        .append('text')
        .attr('x', cx)
        .attr('y', cy + r + 11)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? '#f59e0b' : '#cbd5e1')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('user-select', 'none')
        .text(n.shortName);
    });

    // 4. Y Axis (Pitch Width)
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

    // 5. X Axis (Pitch Length)
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
  }, [nodes, links, height, selectedPlayerId, onSelectPlayer]);

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
