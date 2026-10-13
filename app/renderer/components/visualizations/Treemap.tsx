import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';
import { ensureElevenPlayers } from './squadHelper';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface TreemapProps {
  players: PlayerStats[];
  metricKey?: 'minutes_played' | 'passes_completed' | 'tackles_won';
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

export const Treemap: React.FC<TreemapProps> = ({
  players,
  metricKey: _metricKey = 'minutes_played',
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
    tooltipRef.current = new D3Tooltip('treemap-tooltip');
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
    const innerHeight = Math.max(100, height - 16);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', innerHeight)
      .attr('viewBox', `0 0 ${width} ${innerHeight}`)
      .style('display', 'block')
      .style('max-width', '100%');

    // Helper to calculate overall game contribution score
    const calcContribution = (p: PlayerStats): number => {
      if (p.metrics && typeof p.metrics.contribution_score === 'number') {
        return Math.max(0.5, p.metrics.contribution_score);
      }
      const g = p.goals || 0;
      const a = p.assists || 0;
      const kp = (p as any).key_passes || p.metrics?.key_passes || 0;
      const tw = p.tackles_won || 0;
      const intc = p.interceptions || 0;
      const pc = p.passes_completed || 0;
      const calculated = (g * 3.0) + (a * 2.0) + (kp * 1.0) + (tw * 1.0) + (intc * 1.0) + (pc * 0.05);
      return Math.max(0.5, Math.round(calculated * 10) / 10);
    };

    const totalSquadContribution = activePlayers.reduce((sum, p) => sum + calcContribution(p), 0);
    const maxVal = d3.max(activePlayers, (p) => calcContribution(p)) || 10;

    // Floor area ensures every player in the squad has an ample, readable tile,
    // while preserving strict proportionality (higher contribution = larger tile)
    const baseAreaFloor = 14;

    const hierarchyData: any = {
      name: 'Squad Game Contribution',
      children: activePlayers.map((p) => {
        const contrib = calcContribution(p);
        const pct = totalSquadContribution > 0 ? ((contrib / totalSquadContribution) * 100).toFixed(1) : '0';
        const areaWeight = baseAreaFloor + (contrib * 2.8);
        return {
          name: p.player_name,
          id: p.player_id,
          position: p.primary_position,
          detailed_position: p.detailed_position,
          value: areaWeight,
          contribution: contrib,
          sharePct: pct,
          goals: p.goals || 0,
          assists: p.assists || 0,
          minutes: p.minutes_played || 0,
          passes: p.passes_completed || 0,
          tackles: p.tackles_won || 0,
        };
      }),
    };

    const root = d3
      .hierarchy(hierarchyData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3
      .treemap()
      .size([width, innerHeight])
      .padding(3)(root);

    // Original Color Gradient: Slate Navy -> Deep Teal -> Emerald -> Ochre Gold -> Radiant Gold
    const colorScale = d3
      .scaleSequential<string>()
      .domain([0, maxVal])
      .interpolator(d3.interpolateRgbBasis(['#1e293b', '#1e3a5f', '#10594a', '#8a6217', '#c68715']));

    // Nodes (Leaves)
    const leafNodes = svg
      .append('g')
      .selectAll('g')
      .data(root.leaves())
      .enter()
      .append('g')
      .attr('transform', (d: any) => `translate(${d.x0 || 0},${d.y0 || 0})`);

    leafNodes
      .append('rect')
      .attr('width', (d: any) => Math.max(0, (d.x1 || 0) - (d.x0 || 0)))
      .attr('height', (d: any) => Math.max(0, (d.y1 || 0) - (d.y0 || 0)))
      .attr('fill', (d: any) => {
        if (selectedPlayerId === d.data.id) return '#e59e1b';
        return colorScale(d.data.contribution);
      })
      .attr('stroke', (d: any) => (selectedPlayerId === d.data.id ? '#ffffff' : 'rgba(255, 255, 255, 0.12)'))
      .attr('stroke-width', (d: any) => (selectedPlayerId === d.data.id ? 2 : 1))
      .attr('rx', 3)
      .style('cursor', onSelectPlayer ? 'pointer' : 'default')
      .on('mouseenter', (event, d: any) => {
        tooltipRef.current?.show(
          `<strong>${d.data.name}</strong> (${d.data.detailed_position || d.data.position})<br/>` +
            `Overall Contribution: <strong>${d.data.contribution} pts</strong> (${d.data.sharePct}% squad share)<br/>` +
            `Goals: ${d.data.goals} | Assists: ${d.data.assists} | Minutes: ${d.data.minutes}'<br/>` +
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

    // Player Last Name Label
    leafNodes
      .append('text')
      .attr('x', 6)
      .attr('y', 17)
      .attr('fill', '#ffffff')
      .style('font-size', (d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        return w < 54 ? '11px' : '13px';
      })
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const nameParts = d.data.name.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        if (w < 44) return lastName.slice(0, 5);
        return lastName;
      });

    // Contribution Score & Share Sub-label
    leafNodes
      .append('text')
      .attr('x', 6)
      .attr('y', 33)
      .attr('fill', '#e5c57a')
      .style('font-size', '11.5px')
      .style('font-weight', '500')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        if (h < 28) return '';
        if (w < 52) return `${d.data.contribution}p`;
        return `${d.data.contribution} pts (${d.data.sharePct}%)`;
      });

    // Position tag on larger tiles
    leafNodes
      .append('text')
      .attr('x', (d: any) => Math.max(6, (d.x1 || 0) - (d.x0 || 0) - 28))
      .attr('y', 17)
      .attr('fill', 'rgba(255, 255, 255, 0.6)')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        return w > 74 ? (d.data.detailed_position || d.data.position) : '';
      });
  }, [activePlayers, height, selectedPlayerId, onSelectPlayer]);

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
        <span><strong>Area Dimension:</strong> Player Overall Game Contribution (Higher impact = larger treemap share)</span>
        <span style={{ color: '#9ca3af' }}><strong>Scale:</strong> Weighted match contribution score ({activePlayers.length} players)</span>
      </div>
    </div>
  );
};
