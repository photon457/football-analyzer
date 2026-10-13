import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { D3Tooltip } from './d3Tooltip';

export interface LineChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  date?: string;
  opponent?: string;
}

interface LineChartProps {
  data: LineChartPoint[];
  metricLabel: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
  lineColor?: string;
  comparisonData?: LineChartPoint[];
  comparisonName?: string;
  comparisonColor?: string;
  primaryName?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  metricLabel,
  xLabel,
  yLabel,
  height = 280,
  lineColor = '#c68715',
  comparisonData,
  comparisonName,
  comparisonColor = '#38bdf8',
  primaryName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<D3Tooltip | null>(null);

  useEffect(() => {
    tooltipRef.current = new D3Tooltip('linechart-tooltip');
    return () => {
      tooltipRef.current?.hide();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll('svg').remove();

    const rect = container.getBoundingClientRect();
    const width = Math.max(260, Math.floor(rect.width || container.clientWidth || 500));
    const margin = { top: 28, right: 24, bottom: 58, left: 58 };
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

    // X Domain
    const hasComparison = Boolean(comparisonData && comparisonData.length > 0);
    const xLabels = hasComparison
      ? Array.from(new Set([...data.map((d) => d.label), ...(comparisonData || []).map((d) => d.label)]))
      : data.map((d) => d.label);

    const x = d3
      .scalePoint()
      .domain(xLabels)
      .range([0, innerWidth])
      .padding(0.2);

    // Y Domain
    const maxPrimary = d3.max(data, (d) => d.value) || 1;
    const maxSecondary = hasComparison ? d3.max(comparisonData || [], (d) => d.value) || 1 : 0;
    const maxY = Math.max(maxPrimary, maxSecondary);

    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxY * 1.25)])
      .nice()
      .range([innerHeight, 0]);

    // Gridlines
    g.append('g')
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

    g.selectAll('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');

    // Axes
    const xAxis = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x));

    xAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    xAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px');

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
      .text(xLabel || 'Fixture / Match Progression');

    const yAxis = g.append('g').call(d3.axisLeft(y).ticks(5));
    yAxis.select('.domain').attr('stroke', 'rgba(255, 255, 255, 0.12)');
    yAxis
      .selectAll('.tick text')
      .attr('fill', '#9c9ca6')
      .style('font-size', '12px')
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

    // Legend if dual series
    if (hasComparison) {
      const legend = g
        .append('g')
        .attr('transform', `translate(${innerWidth - 200}, -14)`);

      // Series A
      legend
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 4.5)
        .attr('fill', lineColor);

      legend
        .append('text')
        .attr('x', 8)
        .attr('y', 4)
        .attr('fill', lineColor)
        .style('font-size', '11.5px')
        .style('font-weight', '700')
        .text(primaryName || 'Series A');

      // Series B
      legend
        .append('circle')
        .attr('cx', 105)
        .attr('cy', 0)
        .attr('r', 4.5)
        .attr('fill', comparisonColor);

      legend
        .append('text')
        .attr('x', 113)
        .attr('y', 4)
        .attr('fill', comparisonColor)
        .style('font-size', '11.5px')
        .style('font-weight', '700')
        .text(comparisonName || 'Series B');
    }

    // Area fill under primary line (only if single series)
    if (!hasComparison) {
      const area = d3
        .area<LineChartPoint>()
        .x((d) => x(d.label) || 0)
        .y0(innerHeight)
        .y1((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', lineColor)
        .attr('fill-opacity', 0.14)
        .attr('d', area);
    }

    // Primary Line generator
    const line = d3
      .line<LineChartPoint>()
      .x((d) => x(d.label) || 0)
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Primary Data points (Dots)
    g.selectAll('.dot-primary')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-primary')
      .attr('cx', (d) => x(d.label) || 0)
      .attr('cy', (d) => y(d.value))
      .attr('r', 5)
      .attr('fill', '#090a0c')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget as SVGCircleElement).attr('r', 7).attr('stroke', '#ffffff');
        tooltipRef.current?.show(
          `<strong>${primaryName ? `${primaryName}: ` : ''}${d.opponent ? `vs ${d.opponent}` : d.label}</strong><br/>` +
            `${metricLabel}: <strong>${d.value}</strong>${
              d.date ? `<br/><span style="color:#9c9ca6">${d.date}</span>` : ''
            }`,
          event
        );
      })
      .on('mousemove', (event) => {
        tooltipRef.current?.move(event);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget as SVGCircleElement).attr('r', 5).attr('stroke', lineColor);
        tooltipRef.current?.hide();
      });

    // Secondary / Comparison Series
    if (hasComparison && comparisonData && comparisonData.length > 0) {
      const lineSecondary = d3
        .line<LineChartPoint>()
        .x((d) => x(d.label) || 0)
        .y((d) => y(d.value))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(comparisonData)
        .attr('fill', 'none')
        .attr('stroke', comparisonColor)
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '4, 2')
        .attr('d', lineSecondary);

      g.selectAll('.dot-comparison')
        .data(comparisonData)
        .enter()
        .append('circle')
        .attr('class', 'dot-comparison')
        .attr('cx', (d) => x(d.label) || 0)
        .attr('cy', (d) => y(d.value))
        .attr('r', 5)
        .attr('fill', '#090a0c')
        .attr('stroke', comparisonColor)
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          d3.select(event.currentTarget as SVGCircleElement).attr('r', 7).attr('stroke', '#ffffff');
          tooltipRef.current?.show(
            `<strong>${comparisonName ? `${comparisonName}: ` : ''}${d.opponent ? `vs ${d.opponent}` : d.label}</strong><br/>` +
              `${metricLabel}: <strong>${d.value}</strong>${
                d.date ? `<br/><span style="color:#9c9ca6">${d.date}</span>` : ''
              }`,
            event
          );
        })
        .on('mousemove', (event) => {
          tooltipRef.current?.move(event);
        })
        .on('mouseleave', (event) => {
          d3.select(event.currentTarget as SVGCircleElement).attr('r', 5).attr('stroke', comparisonColor);
          tooltipRef.current?.hide();
        });
    }
  }, [data, metricLabel, xLabel, yLabel, height, lineColor, comparisonData, comparisonName, comparisonColor, primaryName]);

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
