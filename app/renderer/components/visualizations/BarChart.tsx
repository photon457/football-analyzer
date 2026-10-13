import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { D3Tooltip } from './d3Tooltip';

export interface BarChartItem {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  category?: string;
}

interface BarChartProps {
  data: BarChartItem[];
  metricLabel: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  barColor?: string;
  onSelect?: (id: string) => void;
  selectedId?: string | null;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  metricLabel,
  xLabel,
  yLabel,
  height = 320,
  barColor = '#c68715',
  onSelect,
  selectedId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('barchart-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const container = containerRef.current;

    // Clear previous SVG first so it doesn't inflate container width measurement
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 500));
    const margin = { top: 20, right: 24, bottom: 78, left: 58 };
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

    // Scales
    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.24);

    const rawBandwidth = x.bandwidth();
    const maxBarWidth = 56;
    const barWidth = Math.min(rawBandwidth, maxBarWidth);
    const barOffset = (rawBandwidth - barWidth) / 2;

    const maxY = d3.max(data, (d) => d.value) || 1;
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxY * 1.15)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .selectAll('.tick line')
      .attr('stroke', 'rgba(255, 255, 255, 0.06)')
      .attr('stroke-dasharray', '2,2');

    g.select('.grid .domain').remove();

    // X Axis
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12.5px')
      .attr('transform', 'rotate(-32)')
      .style('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.5em');

    // X Axis Label
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 60)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .style('font-size', '13px')
      .style('font-weight', '600')
      .style('letter-spacing', '0.04em')
      .text(xLabel || 'Squad Member');

    // Y Axis
    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5));
    yAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    yAxis.selectAll('.tick line').attr('stroke', 'rgba(255, 255, 255, 0.12)');
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
      .text(yLabel || metricLabel.replace('_', ' ').toUpperCase());

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => (x(d.label) || 0) + barOffset)
      .attr('y', (d) => y(d.value))
      .attr('width', barWidth)
      .attr('height', (d) => innerHeight - y(d.value))
      .attr('fill', (d) => {
        if (selectedId === d.id) return '#e59e1b';
        if (d.category === 'FW') return '#e59e1b';
        if (d.category === 'MF') return '#c68715';
        if (d.category === 'DF') return '#995424';
        if (d.category === 'GK') return '#b8b8b8';
        return barColor;
      })
      .attr('stroke', (d) => (selectedId === d.id ? '#ffffff' : 'transparent'))
      .attr('stroke-width', (d) => (selectedId === d.id ? 1.5 : 0))
      .attr('rx', 3)
      .style('cursor', onSelect ? 'pointer' : 'default')
      .on('mouseenter', (event, d) => {
        tooltipRef.current?.show(
          `<strong>${d.label}</strong><br/>${metricLabel}: <strong>${d.value}</strong>${
            d.secondaryValue !== undefined ? `<br/>Secondary: ${d.secondaryValue}` : ''
          }`,
          event
        );
      })
      .on('mousemove', (event) => {
        tooltipRef.current?.move(event);
      })
      .on('mouseleave', () => {
        tooltipRef.current?.hide();
      })
      .on('click', (_, d) => {
        if (onSelect) onSelect(d.id);
      });

    // Bar Value Labels
    g.selectAll('.bar-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => (x(d.label) || 0) + barOffset + barWidth / 2)
      .attr('y', (d) => y(d.value) - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e5e7eb')
      .style('font-size', '11.5px')
      .style('font-weight', '500')
      .text((d) => (d.value > 0 ? d.value : ''));
  }, [data, metricLabel, xLabel, yLabel, height, barColor, selectedId, onSelect]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: `${height}px`,
        position: 'relative',
        background: '#0d1117',
        border: '1px solid #1f2937',
        borderRadius: '6px',
        padding: '12px 8px 8px 8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    />
  );
};
