import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { PlayerStats } from '../../services/api';
import { D3Tooltip } from './d3Tooltip';

interface ScatterPlotProps {
  players: PlayerStats[];
  height?: number;
  onSelectPlayer?: (playerId: string) => void;
  selectedPlayerId?: string | null;
}

type MetricOption = {
  key: string;
  label: string;
  getValue: (p: PlayerStats) => number;
};

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'shots_total', label: 'Shots Total', getValue: (p) => p.shots_total },
  { key: 'goals', label: 'Goals Scored', getValue: (p) => p.goals },
  { key: 'passes_completed', label: 'Passes Completed', getValue: (p) => p.passes_completed },
  { key: 'pass_acc', label: 'Pass Accuracy %', getValue: (p) => p.rates?.pass_accuracy_pct || 0 },
  { key: 'tackles_won', label: 'Tackles Won', getValue: (p) => p.tackles_won },
  { key: 'interceptions', label: 'Interceptions', getValue: (p) => p.interceptions },
  { key: 'minutes_played', label: 'Minutes Played', getValue: (p) => p.minutes_played },
  { key: 'shots_per_90', label: 'Shots / 90', getValue: (p) => p.per_90?.shots_per_90 || 0 },
  { key: 'passes_per_90', label: 'Passes Completed / 90', getValue: (p) => p.per_90?.passes_completed_per_90 || 0 },
  { key: 'tackles_per_90', label: 'Tackles Won / 90', getValue: (p) => p.per_90?.tackles_won_per_90 || 0 },
];

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  players,
  height = 340,
  onSelectPlayer,
  selectedPlayerId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  const [xMetricKey, setXMetricKey] = useState<string>('passes_completed');
  const [yMetricKey, setYMetricKey] = useState<string>('pass_acc');

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('scatterplot-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  const xOption = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === xMetricKey) || METRIC_OPTIONS[2],
    [xMetricKey]
  );
  const yOption = useMemo(
    () => METRIC_OPTIONS.find((m) => m.key === yMetricKey) || METRIC_OPTIONS[3],
    [yMetricKey]
  );

  const plotData = useMemo(() => {
    return players.map((p) => ({
      id: p.player_id,
      name: p.player_name,
      shortName: p.player_name.split(' ').pop() || p.player_name,
      position: p.primary_position,
      x: xOption.getValue(p),
      y: yOption.getValue(p),
      minutes: p.minutes_played,
    }));
  }, [players, xOption, yOption]);

  useEffect(() => {
    if (!containerRef.current || plotData.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 540));
    const margin = { top: 24, right: 30, bottom: 56, left: 60 };
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

    const maxX = Math.max(1, d3.max(plotData, (d) => d.x) || 1);
    const maxY = Math.max(1, d3.max(plotData, (d) => d.y) || 1);

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxX * 1.15)])
      .nice()
      .range([0, innerWidth]);

    const yScale = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxY * 1.15)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255, 255, 255, 0.06)')
      .attr('stroke-dasharray', '2,2');

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickSize(-innerHeight)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255, 255, 255, 0.06)')
      .attr('stroke-dasharray', '2,2');

    g.selectAll('.grid .domain').remove();

    // Average crosshair lines
    const avgX = d3.mean(plotData, (d) => d.x) || 0;
    const avgY = d3.mean(plotData, (d) => d.y) || 0;

    g.append('line')
      .attr('x1', xScale(avgX))
      .attr('y1', 0)
      .attr('x2', xScale(avgX))
      .attr('y2', innerHeight)
      .attr('stroke', 'rgba(210, 174, 94, 0.35)')
      .attr('stroke-dasharray', '4,4');

    g.append('line')
      .attr('x1', 0)
      .attr('y1', yScale(avgY))
      .attr('x2', innerWidth)
      .attr('y2', yScale(avgY))
      .attr('stroke', 'rgba(210, 174, 94, 0.35)')
      .attr('stroke-dasharray', '4,4');

    // Axes
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6));

    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.14)');
    xAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.14)');
    xAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12.5px')
      .style('font-family', 'var(--font-mono)');

    // X Axis Label
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text(`X-Axis: ${xOption.label}`);

    const yAxis = g.append('g').call(d3.axisLeft(yScale).ticks(5));
    yAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.14)');
    yAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.14)');
    yAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12.5px')
      .style('font-family', 'var(--font-mono)');

    // Y Axis Label
    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -42)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text(`Y-Axis: ${yOption.label}`);

    // Color by position
    const posColors: Record<string, string> = {
      FW: '#e59e1b',
      MF: '#c68715',
      DF: '#3b82f6',
      GK: '#94a3b8',
    };

    // Plot points
    plotData.forEach((d) => {
      const isSelected = selectedPlayerId === d.id;
      const ptG = g
        .append('g')
        .style('cursor', onSelectPlayer ? 'pointer' : 'default')
        .on('mouseenter', (event) => {
          tooltipRef.current?.show(
            `<strong>${d.name}</strong> (${d.position})<br/>` +
              `${xOption.label}: <strong>${d.x}</strong><br/>` +
              `${yOption.label}: <strong>${d.y}</strong><br/>` +
              `Minutes: ${d.minutes}'`,
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
          if (onSelectPlayer) onSelectPlayer(d.id);
        });

      ptG
        .append('circle')
        .attr('cx', xScale(d.x))
        .attr('cy', yScale(d.y))
        .attr('r', isSelected ? 8 : 6)
        .attr('fill', isSelected ? '#ffffff' : posColors[d.position] || '#c68715')
        .attr('stroke', isSelected ? '#d2ae5e' : '#0d1117')
        .attr('stroke-width', isSelected ? 2.5 : 1.5)
        .attr('fill-opacity', 0.9);

      ptG
        .append('text')
        .attr('x', xScale(d.x))
        .attr('y', yScale(d.y) - 9)
        .attr('text-anchor', 'middle')
        .attr('fill', isSelected ? '#f59e0b' : '#9c9ca6')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('user-select', 'none')
        .text(d.shortName);
    });
  }, [plotData, height, xOption, yOption, selectedPlayerId, onSelectPlayer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* Metric Selectors Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>X Axis:</span>
          <select
            value={xMetricKey}
            onChange={(e) => setXMetricKey(e.target.value)}
            style={{
              background: '#161c26',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '13px',
            }}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Y Axis:</span>
          <select
            value={yMetricKey}
            onChange={(e) => setYMetricKey(e.target.value)}
            style={{
              background: '#161c26',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '13px',
            }}
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: '100%',
          minHeight: `${height}px`,
          position: 'relative',
          background: '#0d1117',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          padding: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      />
    </div>
  );
};
