import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SpatialEvent, PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';
import { JellyRadio } from '../JellyRadio/JellyRadio';

interface HeatMapProps {
  events: SpatialEvent[];
  players?: PlayerStats[];
  height?: number;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  events,
  players = [],
  height = 360,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  // Player filter: null means All Squad
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  // Action type filter: pass, defending, shot, possession_retrieval, or all
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'pass' | 'defending' | 'shot' | 'possession_retrieval'>('all');

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('heatmap-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

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
          Spatial pitch coordinates not available
        </div>
        <div style={{ fontSize: '12px', maxWidth: '380px', lineHeight: 1.5 }}>
          This fixture was imported from tabular player statistics without coordinate event telemetry. Detailed metrics and player trends are fully accessible.
        </div>
      </div>
    );
  }

  // Filter events based on player and action category
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchPlayer = !selectedPid || ev.player_id === selectedPid;
      if (!matchPlayer) return false;

      if (eventTypeFilter === 'all') return true;
      if (eventTypeFilter === 'pass') return ev.event_type === 'pass';
      if (eventTypeFilter === 'shot') return ev.event_type === 'shot';
      if (eventTypeFilter === 'defending') {
        return ['tackle', 'interception', 'clearance', 'foul'].includes(ev.event_type);
      }
      if (eventTypeFilter === 'possession_retrieval') {
        return ['touch', 'recovery', 'interception', 'tackle', 'take_on'].includes(ev.event_type);
      }
      return true;
    });
  }, [events, selectedPid, eventTypeFilter]);

  // Player event count map
  const playerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      map[e.player_id] = (map[e.player_id] || 0) + 1;
    });
    return map;
  }, [events]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 540));
    const margin = { top: 18, right: 20, bottom: 42, left: 48 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(100, height - margin.top - margin.bottom);

    // ── Generate Smooth Color-Gradient Density Heatmap via Canvas ──────
    const canvas = document.createElement('canvas');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const ctx = canvas.getContext('2d');

    if (ctx && filteredEvents.length > 0) {
      // Step 1: Draw radial Gaussian intensity stamps for each occurrence
      const stampRadius = Math.max(20, Math.min(38, Math.floor(innerWidth * 0.065)));
      filteredEvents.forEach((ev) => {
        const cx = Math.max(0, Math.min(innerWidth, (ev.x / 100) * innerWidth));
        const cy = Math.max(0, Math.min(innerHeight, (ev.y / 100) * innerHeight));

        const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, stampRadius);
        // Alpha stamp accumulates where occurrences are frequent
        radGrad.addColorStop(0, 'rgba(0, 0, 0, 0.40)');
        radGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.18)');
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, stampRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Step 2: Map accumulated alpha intensity to continuous thermal color gradient
      const imgData = ctx.getImageData(0, 0, innerWidth, innerHeight);
      const data = imgData.data;
      const len = data.length;

      // Color stops: Blue (cool) -> Cyan -> Emerald Green -> Amber -> High-intensity Crimson (hot)
      for (let i = 0; i < len; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          // Normalize alpha to ratio [0, 1]
          const t = Math.min(1.0, alpha / 140);

          let r = 0;
          let g = 0;
          let b = 0;
          let a = Math.min(0.85, 0.25 + t * 0.60);

          if (t < 0.25) {
            // Blue to Cyan
            const factor = t / 0.25;
            r = Math.round(30 + factor * (56 - 30));
            g = Math.round(58 + factor * (189 - 58));
            b = Math.round(138 + factor * (248 - 138));
          } else if (t < 0.50) {
            // Cyan to Emerald Green
            const factor = (t - 0.25) / 0.25;
            r = Math.round(56 + factor * (16 - 56));
            g = Math.round(189 + factor * (185 - 189));
            b = Math.round(248 + factor * (129 - 248));
          } else if (t < 0.75) {
            // Emerald Green to Amber
            const factor = (t - 0.50) / 0.25;
            r = Math.round(16 + factor * (245 - 16));
            g = Math.round(185 + factor * (158 - 185));
            b = Math.round(129 + factor * (11 - 129));
          } else {
            // Amber to Crimson Red
            const factor = (t - 0.75) / 0.25;
            r = Math.round(245 + factor * (239 - 245));
            g = Math.round(158 + factor * (68 - 158));
            b = Math.round(11 + factor * (68 - 11));
          }

          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = Math.round(a * 255);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    }

    const heatMapDataUrl = canvas.toDataURL();

    // ── Build SVG Pitch and Visualizations ─────────────────────────────
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

    // 1. Football Pitch Background Turf
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', '#07150e') // Deep dark tactical pitch turf
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-width', 1.5)
      .attr('rx', 4);

    // 2. Smooth Color Gradient Heatmap Layer
    if (filteredEvents.length > 0) {
      g.append('image')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('href', heatMapDataUrl)
        .style('pointer-events', 'none');
    }

    // 3. Pitch Tactical Line Markings (drawn crisply over the heatmap gradient)
    const pitchLines = g
      .append('g')
      .attr('stroke', 'rgba(255, 255, 255, 0.35)')
      .attr('stroke-width', 1.2)
      .attr('fill', 'none')
      .style('pointer-events', 'none');

    // Halfway line & center spot
    pitchLines.append('line').attr('x1', innerWidth / 2).attr('y1', 0).attr('x2', innerWidth / 2).attr('y2', innerHeight);
    const circleRadius = innerHeight * 0.18;
    pitchLines.append('circle').attr('cx', innerWidth / 2).attr('cy', innerHeight / 2).attr('r', circleRadius);
    pitchLines.append('circle').attr('cx', innerWidth / 2).attr('cy', innerHeight / 2).attr('r', 2.5).attr('fill', 'rgba(255,255,255,0.6)');

    // Penalty Boxes (Defending: left, Attacking: right)
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

    // Penalty spots
    pitchLines.append('circle').attr('cx', innerWidth * 0.115).attr('cy', innerHeight / 2).attr('r', 2).attr('fill', 'rgba(255,255,255,0.5)');
    pitchLines.append('circle').attr('cx', innerWidth * 0.885).attr('cy', innerHeight / 2).attr('r', 2).attr('fill', 'rgba(255,255,255,0.5)');

    // Attacking direction indicator arrow
    const arrowY = innerHeight + 36;
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', arrowY)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .style('font-size', '12.5px')
      .style('font-weight', '500')
      .style('letter-spacing', '0.04em')
      .text('Attacking Direction →');

    // 4. Individual Spatial Action Nodes for Hover Inspection
    const pointsGroup = g.append('g').attr('class', 'action-points');
    pointsGroup
      .selectAll('.event-point')
      .data(filteredEvents)
      .enter()
      .append('circle')
      .attr('class', 'event-point')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', (d) => (d.event_type === 'shot' ? 5 : 3))
      .attr('fill', (d) => {
        if (d.event_type === 'shot') return '#ef4444';
        if (d.event_type === 'pass') return '#38bdf8';
        if (['tackle', 'interception', 'clearance', 'foul'].includes(d.event_type)) return '#10b981';
        return '#f59e0b'; // Possession retrieval / recovery
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.8)
      .attr('opacity', 0.75)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        const pName = d.player_id.replace('p_', '').replace('_', ' ').toUpperCase();
        const actionLabel =
          d.event_type === 'pass'
            ? 'Pass'
            : d.event_type === 'shot'
            ? 'Shot'
            : ['tackle', 'interception', 'clearance'].includes(d.event_type)
            ? 'Defensive Action'
            : 'Possession Retrieval';

        tooltipRef.current?.show(
          `<strong>${pName}</strong> &bull; ${actionLabel} (${d.minute}')<br/>` +
            `Outcome: <strong>${d.outcome}</strong><br/>` +
            `Pitch: (${d.x.toFixed(1)}m, ${d.y.toFixed(1)}m)` +
            (d.metadata?.shot_result ? `<br/>Shot Result: ${d.metadata.shot_result}` : '') +
            (d.metadata?.xg ? `<br/>xG: ${d.metadata.xg}` : ''),
          event
        );
      })
      .on('mousemove', (event) => {
        tooltipRef.current?.move(event);
      })
      .on('mouseleave', () => {
        tooltipRef.current?.hide();
      });

    // 5. Explicit X and Y Axis Markings and Labels
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((d) => `${d}m`)
      );

    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.15)');
    xAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.15)');
    xAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)');

    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth - 6)
      .attr('y', innerHeight + 28)
      .attr('text-anchor', 'end')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .text('Pitch Length (X: 0m – 105m)');

    const yAxis = g
      .append('g')
      .call(
        d3
          .axisLeft(yScale)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((d) => `${d}m`)
      );

    yAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.15)');
    yAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.15)');
    yAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)');

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -32)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .text('Pitch Width (Y: 0m – 68m)');
  }, [filteredEvents, height]);

  // Squad player chips list
  const playerChips = useMemo(() => {
    return players
      .map((p) => ({
        id: p.player_id,
        name: p.player_name.split(' ').pop() || p.player_name,
        count: playerCounts[p.player_id] || 0,
      }))
      .filter((p) => p.count > 0);
  }, [players, playerCounts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* Controls & Filter Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        {/* Player Filter Pills */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '65%' }}>
          <button
            onClick={() => setSelectedPid(null)}
            className="view-tab"
            style={{
              padding: '4px 10px',
              fontSize: '12.5px',
              fontWeight: !selectedPid ? 600 : 400,
              background: !selectedPid ? 'var(--bg-surface-elevated)' : 'transparent',
              borderColor: !selectedPid ? 'var(--accent-gold)' : 'transparent',
              color: !selectedPid ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            All Squad ({events.length})
          </button>
          {playerChips.map((p) => {
            const isSel = selectedPid === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPid(isSel ? null : p.id)}
                className="view-tab"
                style={{
                  padding: '4px 10px',
                  fontSize: '12.5px',
                  fontWeight: isSel ? 600 : 400,
                  background: isSel ? 'var(--bg-surface-elevated)' : 'transparent',
                  borderColor: isSel ? 'var(--accent-gold)' : 'transparent',
                  color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {p.name} ({p.count})
              </button>
            );
          })}
        </div>

        {/* Action Type Filter: pass, defending, shot, possession retrieval */}
        <JellyRadio
          size="sm"
          items={[
            { value: 'all', label: 'All' },
            { value: 'pass', label: 'Pass' },
            { value: 'defending', label: 'Defending' },
            { value: 'shot', label: 'Shot' },
            { value: 'possession_retrieval', label: 'Possession Retrieval' },
          ]}
          value={eventTypeFilter}
          onChange={(val) => setEventTypeFilter(val as any)}
        />
      </div>

      {/* Pitch Heat Map Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '100%',
          minHeight: `${height}px`,
          position: 'relative',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: '#07150e',
          borderRadius: '6px',
        }}
      />

      {/* Legend & Stats Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-hairline)', paddingTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          {/* Continuous Color Gradient Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Low Frequency</span>
            <div
              style={{
                width: '64px',
                height: '8px',
                borderRadius: '4px',
                background: 'linear-gradient(to right, #1e3a8a, #38bdf8, #10b981, #f59e0b, #ef4444)',
              }}
            />
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Peak Frequency</span>
          </div>

          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Passes
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Defending
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Shots
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} /> Possession Retrieval
          </span>
        </div>

        <div>
          Displaying <strong>{filteredEvents.length}</strong> / {events.length} tactical events
        </div>
      </div>
    </div>
  );
};
