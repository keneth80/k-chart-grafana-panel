import type { KChartSeries } from '@keneth80/k-chart/core/contracts';
import type { KChartChartType, KChartDownsampleStrategy } from '../types';
import type { KChartPanelPoint } from './dataFrame';

const DEFAULT_POINTS_PER_PIXEL = 4;

export const resolveDownsampleOptions = (
  enabled: boolean,
  strategy: KChartDownsampleStrategy | undefined = undefined,
  pointsPerPixel = DEFAULT_POINTS_PER_PIXEL,
  chartType: KChartChartType = 'line'
): KChartSeries<KChartPanelPoint>['downsample'] => {
  if (!enabled || (chartType !== 'line' && chartType !== 'area')) {
    return false;
  }

  return {
    // Before strategies were configurable, the library's boolean `true` meant LTTB.
    strategy: strategy ?? 'lttb',
    pointsPerPixel: Math.max(1, Math.min(16, Math.round(pointsPerPixel))),
  };
};
