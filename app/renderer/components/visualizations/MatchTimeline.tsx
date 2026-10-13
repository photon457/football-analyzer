import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { SpatialEvent, PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';

interface MatchTimelineProps {
  events: SpatialEvent[];
  players?: PlayerStats[];
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
}

export const MatchTimeline: React.FC<MatchTimelineProps> = ({
  events,
  players = [],
  height = 200,
  onSelectPlayer,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'key_events' | 'shots' | 'tackles'>('all');

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('timeline-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  if (!events || events.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: '120px',
          background: 'rgba(14, 15, 18, 0.75)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted, #8b8f9a)',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #d1d5db)', marginBottom: '3px' }}>
          Event stream timeline not recorded
        </div>
        <div style={{ fontSize: '11.5px', maxWidth: '380px', lineHeight: 1.5 }}>
          Minute-by-minute action stream is not available for this tabular match record.
        </div>
      </div>
    );
  }

  // Player name lookup map
  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((p) => map.set(p.player_id, p.player_name));
    return map;
  }, [players]);

  // Filter timeline events
  const timelineEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterType === 'shots') return e.event_type === 'shot';
      if (filterType === 'tackles') return ['tackle', 'interception', 'clearance'].includes(e.event_type);
      if (filterType === 'key_events') {
        const isGoal = e.event_type === 'shot' && (e.outcome === 'successful' || e.metadata?.shot_result === 'goal');
        const isCard = e.metadata?.card || ['foul', 'save'].includes(e.event_type);
        return isGoal || isCard || e.event_type === 'shot';
      }
      return true;
    });
  }, [events, filterType]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 600));
    const margin = { top: 30, right: 28, bottom: 48, left: 46 };
    const innerWidth = Math.max(100, width - margin.left - margin.right);
    const innerHeight = Math.max(80, height - margin.top - margin.bottom);

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

    // X Scale: 0 to 95 minutes
    const xScale = d3.scaleLinear().domain([0, 95]).range([0, innerWidth]);

    // 1. Draw Match Half Zones (1st Half: 0-45, 2nd Half: 45-90+)
    const halfMidX = xScale(45);
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', halfMidX)
      .attr('height', innerHeight)
      .attr('fill', 'rgba(255, 255, 255, 0.015)');

    g.append('rect')
      .attr('x', halfMidX)
      .attr('y', 0)
      .attr('width', innerWidth - halfMidX)
      .attr('height', innerHeight)
      .attr('fill', 'rgba(255, 255, 255, 0.025)');

    // Half labels
    g.append('text')
      .attr('x', halfMidX / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6f7885')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .text('FIRST HALF (1\' - 45\')');

    g.append('text')
      .attr('x', halfMidX + (innerWidth - halfMidX) / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#6f7885')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .text('SECOND HALF (46\' - 90\'+)');

    // Halfway dividing line
    g.append('line')
      .attr('x1', halfMidX)
      .attr('y1', -6)
      .attr('x2', halfMidX)
      .attr('y2', innerHeight + 6)
      .attr('stroke', 'rgba(255, 255, 255, 0.15)')
      .attr('stroke-dasharray', '3,3');

    // Central Timeline Track
    const centerY = innerHeight / 2;
    g.append('line')
      .attr('x1', 0)
      .attr('y1', centerY)
      .attr('x2', innerWidth)
      .attr('y2', centerY)
      .attr('stroke', 'rgba(210, 174, 94, 0.4)')
      .attr('stroke-width', 2);

    // Y Axis Label
    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '12.5px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text('Action Stream');

    // X Axis Ticks
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues([0, 15, 30, 45, 60, 75, 90])
          .tickFormat((d) => `${d}'`)
      );

    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-mono)');

    // X Axis Label
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text('Match Time (Minutes: 0\' – 90\'+)');

    // Event color & shape helpers
    const getEventClassification = (ev: SpatialEvent) => {
      const isGoal = ev.event_type === 'shot' && (ev.outcome === 'successful' || ev.metadata?.shot_result === 'goal' || ev.metadata?.is_goal);
      const isAssist = Boolean(ev.metadata?.is_assist || ev.metadata?.assist || (ev.event_type === 'pass' && (ev.metadata?.key_pass_type === 'assist' || ev.metadata?.assist)));
      const isCard = Boolean(ev.metadata?.card || ev.metadata?.yellow_card || ev.metadata?.red_card || (ev.event_type === 'foul' && ev.metadata?.card));
      const isRed = Boolean(ev.metadata?.card === 'red' || ev.metadata?.red_card);

      if (isGoal) return { type: 'goal', color: '#e5c57a', label: 'Goal' };
      if (isAssist) return { type: 'assist', color: '#38bdf8', label: 'Assist' };
      if (isCard) return { type: 'card', color: isRed ? '#ef4444' : '#facc15', isRed, label: isRed ? 'Red Card' : 'Yellow Card' };
      if (ev.event_type === 'shot') return { type: 'shot', color: '#ef4444', size: 5, stroke: '#1e293b', label: 'Shot' };
      if (ev.event_type === 'pass') return { type: 'pass', color: '#3b82f6', size: 3.5, stroke: '#1e293b', label: 'Pass' };
      if (['tackle', 'interception', 'clearance', 'recovery'].includes(ev.event_type)) {
        return { type: 'tackle', color: '#10b981', size: 4, stroke: '#1e293b', label: 'Defensive Action' };
      }
      return { type: 'default', color: '#94a3b8', size: 3.5, stroke: '#1e293b', label: ev.event_type };
    };

    // Plot event nodes along timeline with small vertical jitter for readability
    const eventsGroup = g.append('g').attr('class', 'timeline-events');

    timelineEvents.forEach((ev, idx) => {
      const cx = xScale(Math.min(95, Math.max(0, ev.minute + (ev.second || 0) / 60)));
      // Jitter alternation above and below track
      const isUpper = idx % 2 === 0;
      const offset = (idx % 3) * 14 + 12;
      const cy = isUpper ? centerY - offset : centerY + offset;
      const info = getEventClassification(ev);
      const playerName = playerNameMap.get(ev.player_id) || ev.player_id;

      // Connecting stem line
      eventsGroup
        .append('line')
        .attr('x1', cx)
        .attr('y1', centerY)
        .attr('x2', cx)
        .attr('y2', cy)
        .attr('stroke', info.color)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.5);

      // Render custom symbol or circle
      const eventG = eventsGroup
        .append('g')
        .attr('transform', `translate(${cx},${cy})`)
        .style('cursor', onSelectPlayer ? 'pointer' : 'default')
        .on('mouseenter', (event) => {
          tooltipRef.current?.show(
            `<strong>${ev.minute}' ${info.label}</strong><br/>` +
              `Player: <strong>${playerName}</strong><br/>` +
              `Outcome: ${ev.outcome}<br/>` +
              `Pitch Location: (${ev.x.toFixed(1)}, ${ev.y.toFixed(1)})`,
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
          if (onSelectPlayer && ev.player_id) {
            onSelectPlayer(ev.player_id);
          }
        });

      if (info.type === 'goal') {
        // Goal Symbol: Soccer Goal Net & Ball
        eventG
          .append('rect')
          .attr('x', -8)
          .attr('y', -6)
          .attr('width', 16)
          .attr('height', 12)
          .attr('rx', 1.5)
          .attr('fill', 'rgba(210, 174, 94, 0.35)')
          .attr('stroke', '#e5c57a')
          .attr('stroke-width', 1.4);

        // Net lines
        eventG
          .append('line')
          .attr('x1', -8)
          .attr('y1', 0)
          .attr('x2', 8)
          .attr('y2', 0)
          .attr('stroke', '#e5c57a')
          .attr('stroke-width', 0.8)
          .attr('stroke-dasharray', '2,1');

        eventG
          .append('line')
          .attr('x1', -2.5)
          .attr('y1', -6)
          .attr('x2', -2.5)
          .attr('y2', 6)
          .attr('stroke', '#e5c57a')
          .attr('stroke-width', 0.8)
          .attr('stroke-dasharray', '2,1');

        eventG
          .append('line')
          .attr('x1', 2.5)
          .attr('y1', -6)
          .attr('x2', 2.5)
          .attr('y2', 6)
          .attr('stroke', '#e5c57a')
          .attr('stroke-width', 0.8)
          .attr('stroke-dasharray', '2,1');

        // Ball in net
        eventG
          .append('circle')
          .attr('cx', 2)
          .attr('cy', 0)
          .attr('r', 3)
          .attr('fill', '#ffffff')
          .attr('stroke', '#000000')
          .attr('stroke-width', 0.8);
      } else if (info.type === 'card') {
        // Card Symbol: Yellow or Red card
        eventG
          .append('rect')
          .attr('x', -4.5)
          .attr('y', -7)
          .attr('width', 9)
          .attr('height', 14)
          .attr('rx', 1.5)
          .attr('fill', info.color)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1);
      } else if (info.type === 'assist') {
        // Assist Symbol: Football Boot
        eventG
          .append('path')
          .attr('d', 'M -6 -1 L -3 -1 L -1 2 L 4 3 Q 6 3.5 6 5.5 L 5 7 L -6 7 Q -7 7 -7 5.5 L -7 0 Q -7 -1 -6 -1 Z')
          .attr('fill', '#38bdf8')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 0.9);

        // Cleats
        [-4.5, -1.5, 2, 4.5].forEach((sx) => {
          eventG
            .append('line')
            .attr('x1', sx)
            .attr('y1', 7)
            .attr('x2', sx)
            .attr('y2', 8.5)
            .attr('stroke', '#38bdf8')
            .attr('stroke-width', 1.2);
        });
      } else {
        // Standard circle node
        eventG
          .append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', info.size || 4)
          .attr('fill', info.color)
          .attr('stroke', info.stroke || '#1e293b')
          .attr('stroke-width', 1.5);
      }
    });
  }, [timelineEvents, height, playerNameMap, onSelectPlayer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {/* Event Filter Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'all', label: 'All Telemetry' },
            { key: 'key_events', label: 'Goals & Key Moments' },
            { key: 'shots', label: 'Shots Only' },
            { key: 'tackles', label: 'Defensive Actions' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key as any)}
              style={{
                background: filterType === f.key ? 'rgba(210, 174, 94, 0.2)' : 'transparent',
                border: `1px solid ${filterType === f.key ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.1)'}`,
                color: filterType === f.key ? 'var(--accent-gold)' : 'var(--text-secondary)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12.5px', color: '#9c9ca6', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="10" viewBox="0 0 14 10" style={{ display: 'inline-block' }}>
              <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="rgba(210,174,94,0.3)" stroke="#e5c57a" strokeWidth="1" />
              <line x1="0" y1="5" x2="14" y2="5" stroke="#e5c57a" strokeWidth="0.6" strokeDasharray="2,1" />
              <circle cx="9" cy="5" r="2.2" fill="#fff" stroke="#000" strokeWidth="0.6" />
            </svg>
            <span>Goal</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="12" height="9" viewBox="0 0 14 11" style={{ display: 'inline-block' }}>
              <path d="M 1 2 L 4 2 L 6 5 L 11 6 Q 13 6.5 13 8 L 12 9.5 L 1 9.5 Q 0 9.5 0 8 Z" fill="#38bdf8" stroke="#fff" strokeWidth="0.8" />
              <line x1="2" y1="9.5" x2="2" y2="11" stroke="#38bdf8" strokeWidth="1" />
              <line x1="6" y1="9.5" x2="6" y2="11" stroke="#38bdf8" strokeWidth="1" />
              <line x1="10" y1="9.5" x2="10" y2="11" stroke="#38bdf8" strokeWidth="1" />
            </svg>
            <span>Assist (Boot)</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="8" height="12" viewBox="0 0 8 12" style={{ display: 'inline-block' }}>
              <rect x="0.5" y="0.5" width="7" height="11" rx="1" fill="#facc15" stroke="#fff" strokeWidth="0.8" />
            </svg>
            <span>Card</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            Shot
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            Tackle
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
            Pass
          </span>
        </div>
      </div>

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
          padding: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
