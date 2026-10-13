import * as d3 from 'd3';

/**
 * Reusable D3 Tooltip system adhering to Core-4 rules:
 * - Clean dark-mode tactical aesthetic
 * - No glow / no blur filters (Rule 22)
 * - No emojis (Rule 23)
 */

export class D3Tooltip {
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  constructor(containerId: string = 'd3-tactical-tooltip') {
    // Check if singleton tooltip element already exists
    let existing = d3.select<HTMLDivElement, unknown>(`#${containerId}`);
    if (existing.empty()) {
      existing = d3.select('body')
        .append('div')
        .attr('id', containerId)
        .style('position', 'fixed')
        .style('top', '-9999px')
        .style('left', '-9999px')
        .style('pointer-events', 'none')
        .style('opacity', '0')
        .style('background', 'rgba(14, 15, 18, 0.96)')
        .style('border', '1px solid rgba(198, 135, 21, 0.35)')
        .style('border-radius', '6px')
        .style('padding', '8px 12px')
        .style('font-size', '13.5px')
        .style('color', '#ffffff')
        .style('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif')
        .style('box-shadow', '0 8px 24px rgba(0, 0, 0, 0.8)')
        .style('z-index', '9999')
        .style('transition', 'opacity 0.12s ease');
    }
    this.tooltip = existing;
  }

  public show(htmlContent: string, event: MouseEvent): void {
    this.tooltip
      .html(htmlContent)
      .style('opacity', '1')
      .style('left', `${event.clientX + 14}px`)
      .style('top', `${event.clientY - 28}px`);
  }

  public move(event: MouseEvent): void {
    this.tooltip
      .style('left', `${event.clientX + 14}px`)
      .style('top', `${event.clientY - 28}px`);
  }

  public hide(): void {
    this.tooltip.style('opacity', '0');
  }

  public destroy(): void {
    this.tooltip.remove();
  }
}
