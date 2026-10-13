import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';
import { ensureElevenPlayers } from './squadHelper';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface PackedBubbleProps {
  players: PlayerStats[];
  metricKey?: 'passes_completed' | 'minutes_played' | 'tackles_won';
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

export const PackedBubble: React.FC<PackedBubbleProps> = ({
  players,
  metricKey = 'passes_completed',
  height = 320,
  onSelectPlayer,
  selectedPlayerId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  // Guarantee that at least all 11 starting players are available on the pitch
  const fullSquad = ensureElevenPlayers(players);
  const starters = fullSquad.filter((p) => p.is_starter);
  const hasMultipleOptions = fullSquad.length > 11;
  const [lineupFilter, setLineupFilter] = useState<'xi' | 'all'>('xi');

  const activePlayers = hasMultipleOptions && lineupFilter === 'all'
    ? fullSquad
    : starters.length >= 11 ? starters.slice(0, 11) : fullSquad.slice(0, 11);

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('bubble-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || activePlayers.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 500));

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')
      .style('max-width', '100%');

    // Calculate metric bounds
    const metricVals = activePlayers.map((p) => (p as any)[metricKey] || 0);
    const minV = Math.min(...metricVals);
    const maxV = Math.max(...metricVals);
    const range = Math.max(1, maxV - minV);

    // Balanced area sizing so EVERY player bubble has a comfortable minimum radius (>= 22px)
    // while higher volume performers receive visibly larger bubble areas
    const packData = {
      name: 'Squad',
      children: activePlayers.map((p) => {
        const raw = (p as any)[metricKey] || 0;
        const norm = (raw - minV) / range;
        const bubbleWeight = 24 + (norm * 52);
        return {
          id: p.player_id,
          name: p.player_name,
          position: p.primary_position,
          detailed_position: p.detailed_position,
          rawValue: raw,
          value: bubbleWeight,
          goals: p.goals || 0,
          assists: p.assists || 0,
          minutes: p.minutes_played || 0,
          passes: p.passes_completed || 0,
          tackles: p.tackles_won || 0,
        };
      }),
    };

    const root = d3
      .hierarchy(packData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack().size([width - 24, height - 24]).padding(6);
    pack(root as any);

    // Original Position-Based Tactical Color Scheme
    const colorMap: Record<string, string> = {
      FW: '#e59e1b', // Bright Gold
      MF: '#c68715', // Ochre Gold
      DF: '#995424', // Brushed Copper
      GK: '#7a7f8d', // Silver Slate
    };

    const g = svg.append('g').attr('transform', 'translate(12, 12)');

    const node = g
      .selectAll('.node')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Circle in original positional color
    node
      .append('circle')
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) =>
        selectedPlayerId === d.data.id ? '#e59e1b' : colorMap[d.data.position] || '#374151'
      )
      .attr('fill-opacity', 0.88)
      .attr('stroke', (d: any) =>
        selectedPlayerId === d.data.id ? '#ffffff' : '#090a0c'
      )
      .attr('stroke-width', (d: any) => (selectedPlayerId === d.data.id ? 2.5 : 1.5))
      .style('cursor', onSelectPlayer ? 'pointer' : 'default')
      .on('mouseenter', (event, d: any) => {
        const metricName = metricKey.replace(/_/g, ' ').toUpperCase();
        tooltipRef.current?.show(
          `<strong>${d.data.name}</strong> (${d.data.detailed_position || d.data.position})<br/>` +
            `${metricName}: <strong>${d.data.rawValue}</strong><br/>` +
            `Minutes: ${d.data.minutes}' | Goals: ${d.data.goals} | Assists: ${d.data.assists}<br/>` +
            `Passes: ${d.data.passes} | Tackles: ${d.data.tackles}`,
          event
        );
      })
      .on('mousemove', (event) => {
        tooltipRef.current?.move(event);
      })
      .on('mouseleave', () => {
        tooltipRef.current?.hide();
      })
      .on('click', (_, d: any) => {
        if (onSelectPlayer) onSelectPlayer(d.data.id);
      });

    // Player Last Name
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', '#ffffff')
      .style('font-size', (d: any) => `${Math.max(11, Math.min(13.5, d.r / 2.3))}px`)
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const parts = d.data.name.split(' ');
        const lastName = parts[parts.length - 1];
        return d.r < 18 ? lastName.slice(0, 4) : lastName;
      });

    // Metric Value Sub-text
    node
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.15em')
      .attr('fill', '#f3f4f6')
      .style('font-size', (d: any) => `${Math.max(10, Math.min(12, d.r / 2.8))}px`)
      .style('font-weight', '500')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const unit = metricKey === 'passes_completed' ? 'pass' : metricKey === 'minutes_played' ? 'min' : 'tkl';
        return `${d.data.rawValue} ${unit}`;
      });
  }, [activePlayers, metricKey, height, selectedPlayerId, onSelectPlayer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {hasMultipleOptions && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <JellyRadio
            size="sm"
            items={[
              { value: 'xi', label: 'Starting XI (11 Players)' },
              { value: 'all', label: `All Players (${fullSquad.length})` },
            ]}
            value={lineupFilter}
            onChange={(val) => setLineupFilter(val as 'xi' | 'all')}
          />
        </div>
      )}

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
          padding: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: '#cbd5e1', padding: '2px 4px' }}>
        <span><strong>Bubble Size Dimension (Radius):</strong> {metricKey.replace('_', ' ').toUpperCase()}</span>
        <span style={{ color: '#9ca3af' }}><strong>Clustering:</strong> Squad Volume Cluster ({activePlayers.length} players)</span>
      </div>
    </div>
  );
};
