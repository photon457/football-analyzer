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

export function calculatePlayerMatchRating(p: PlayerStats): number {
  if (p.metrics && typeof (p.metrics as any).match_rating === 'number') {
    return Number((p.metrics as any).match_rating.toFixed(1));
  }
  if (p.metrics && typeof (p.metrics as any).rating === 'number') {
    return Number((p.metrics as any).rating.toFixed(1));
  }
  let r = 6.0;
  const mins = p.minutes_played || 0;
  if (mins === 0) return 6.0;

  const g = p.goals || 0;
  const a = p.assists || 0;
  const s = p.shots_total || 0;
  const sot = (p as any).shots_on_target || (p.metrics as any)?.shots_on_target || Math.round(s * 0.5);
  const kp = (p as any).key_passes || (p.metrics as any)?.key_passes || 0;
  const pc = p.passes_completed || 0;
  const pa = p.passes_attempted || Math.round(pc * 1.18);
  const tw = p.tackles_won || 0;
  const intc = p.interceptions || 0;
  const duels = (p as any).duels_won || (p.metrics as any)?.duels_won || 0;

  r += g * 1.1;
  r += a * 0.6;
  r += kp * 0.25;
  r += sot * 0.18;
  r += Math.max(0, s - sot) * 0.05;
  r += tw * 0.16;
  r += intc * 0.16;
  r += duels * 0.06;

  if (pa >= 10) {
    const acc = pc / pa;
    if (acc >= 0.88) r += 0.35;
    else if (acc >= 0.80) r += 0.18;
    else if (acc < 0.65) r -= 0.25;
  }

  if ((p.primary_position === 'DF' || p.primary_position === 'GK') && mins >= 60) {
    r += 0.2;
  }

  return Math.min(10.0, Math.max(6.0, Math.round(r * 10) / 10));
}

const getRatingColor = (rating: number): string => {
  if (rating >= 8.5) return '#15803d'; // High Emerald
  if (rating >= 7.8) return '#0f766e'; // Deep Teal
  if (rating >= 7.2) return '#1d4ed8'; // Royal Blue
  if (rating >= 6.7) return '#854d0e'; // Bronze Gold
  return '#334155'; // Dark Slate
};

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

    const hierarchyData: any = {
      name: 'Collective Match Performance',
      children: activePlayers.map((p) => {
        const rating = calculatePlayerMatchRating(p);
        const areaWeight = Math.max(12, Math.round(Math.pow(rating - 5.2, 1.8) * 12));
        const pc = p.passes_completed || 0;
        const pa = p.passes_attempted || Math.round(pc * 1.18);
        const passAcc = pa > 0 ? ((pc / pa) * 100).toFixed(1) : '0';
        const s = p.shots_total || 0;
        const sot = (p as any).shots_on_target || (p.metrics as any)?.shots_on_target || Math.round(s * 0.5);
        const kp = (p as any).key_passes || (p.metrics as any)?.key_passes || 0;
        const duels = (p as any).duels_won || (p.metrics as any)?.duels_won || 0;

        return {
          id: p.player_id,
          name: p.player_name,
          position: p.primary_position,
          detailed_position: p.detailed_position,
          jersey: p.jersey_number,
          value: areaWeight,
          rating,
          goals: p.goals || 0,
          assists: p.assists || 0,
          minutes: p.minutes_played || 0,
          shots: s,
          shotsOnTarget: sot,
          passesCompleted: pc,
          passesAttempted: pa,
          passAcc,
          keyPasses: kp,
          tackles: p.tackles_won || 0,
          interceptions: p.interceptions || 0,
          duelsWon: duels,
        };
      }),
    };

    const root = d3
      .hierarchy(hierarchyData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.data?.rating || 0) - (a.data?.rating || 0));

    d3
      .treemap()
      .size([width, innerHeight])
      .padding(3)(root);

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
        if (selectedPlayerId === d.data.id) return '#c8963e';
        return getRatingColor(d.data.rating);
      })
      .attr('stroke', (d: any) => (selectedPlayerId === d.data.id ? '#ffffff' : 'rgba(255, 255, 255, 0.14)'))
      .attr('stroke-width', (d: any) => (selectedPlayerId === d.data.id ? 2 : 1))
      .attr('rx', 4)
      .style('cursor', onSelectPlayer ? 'pointer' : 'default')
      .on('mouseenter', (event, d: any) => {
        tooltipRef.current?.show(
          `<div style="font-size:13px; font-weight:700; color:#ffffff; margin-bottom:4px;">${d.data.name} <span style="font-size:11px; color:#38bdf8; font-weight:600;">(${d.data.detailed_position || d.data.position})</span></div>` +
            `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">` +
            `<span style="background:#22c55e; color:#090d14; font-weight:800; font-size:12px; padding:2px 8px; border-radius:4px;">${d.data.rating.toFixed(1)} Match Rating</span>` +
            `<span style="color:#94a3b8; font-size:12px;">${d.data.minutes}' played</span>` +
            `</div>` +
            `<div style="font-size:12px; color:#cbd5e1; line-height:1.5;">` +
            `<div><strong>Attacking:</strong> ${d.data.goals} Goals &bull; ${d.data.assists} Assists &bull; ${d.data.shots} Shots (${d.data.shotsOnTarget} on target)</div>` +
            `<div><strong>Passing:</strong> ${d.data.passesCompleted}/${d.data.passesAttempted} completed (${d.data.passAcc}%) &bull; ${d.data.keyPasses} Key Passes</div>` +
            `<div><strong>Defending:</strong> ${d.data.tackles} Tackles &bull; ${d.data.interceptions} Interceptions &bull; ${d.data.duelsWon} Duels Won</div>` +
            `</div>`,
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

    // Rating Badge Pill Background
    leafNodes
      .append('rect')
      .attr('x', 6)
      .attr('y', 6)
      .attr('width', 34)
      .attr('height', 19)
      .attr('rx', 3)
      .attr('fill', 'rgba(0, 0, 0, 0.45)')
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none')
      .style('display', (d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        return w < 44 || h < 28 ? 'none' : 'block';
      });

    // Rating Number Text
    leafNodes
      .append('text')
      .attr('x', 23)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .style('font-size', '12px')
      .style('font-weight', '800')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        if (w < 44 || h < 28) return '';
        return d.data.rating.toFixed(1);
      });

    // Position tag on top-right of tile
    leafNodes
      .append('text')
      .attr('x', (d: any) => Math.max(6, (d.x1 || 0) - (d.x0 || 0) - 28))
      .attr('y', 20)
      .attr('fill', 'rgba(255, 255, 255, 0.75)')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        return w > 74 && h > 28 ? (d.data.detailed_position || d.data.position) : '';
      });

    // Player Last Name Label
    leafNodes
      .append('text')
      .attr('x', 6)
      .attr('y', (d: any) => {
        const h = (d.y1 || 0) - (d.y0 || 0);
        return h > 45 ? 42 : 20;
      })
      .attr('fill', '#ffffff')
      .style('font-size', (d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        return w < 58 ? '11px' : '13px';
      })
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        if (h <= 28 && w < 44) return '';
        const nameParts = d.data.name.split(' ');
        const lastName = nameParts[nameParts.length - 1];
        if (w < 48) return lastName.slice(0, 5);
        return lastName;
      });

    // Sub-text: key match stats on larger tiles
    leafNodes
      .append('text')
      .attr('x', 6)
      .attr('y', 57)
      .attr('fill', 'rgba(255, 255, 255, 0.65)')
      .style('font-size', '10.5px')
      .style('font-family', 'var(--font-mono)')
      .style('pointer-events', 'none')
      .text((d: any) => {
        const w = (d.x1 || 0) - (d.x0 || 0);
        const h = (d.y1 || 0) - (d.y0 || 0);
        if (w < 85 || h < 66) return '';
        if (d.data.goals > 0 || d.data.assists > 0) {
          return `${d.data.goals}G ${d.data.assists}A • ${d.data.passesCompleted}p`;
        }
        return `${d.data.passesCompleted} passes • ${d.data.tackles}t`;
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#cbd5e1', padding: '2px 4px', flexWrap: 'wrap', gap: '8px' }}>
        <span><strong>Tile Dimension:</strong> Match Rating (6.0–10.0 scale &bull; all {activePlayers.length} starting players)</span>
        <span style={{ color: '#9ca3af' }}><strong>Scale:</strong> &ge;8.5 Excellent &bull; 7.8–8.4 High &bull; 7.2–7.7 Solid &bull; 6.7–7.1 Moderate &bull; 6.0–6.6 Baseline</span>
      </div>
    </div>
  );
};
