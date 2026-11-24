import type { KChartPanelOptions } from '../types';

/**
 * Panels saved before 1.0.6 only stored the downsampling switch. Keep their
 * LTTB behavior while new panels use the Auto strategy registered by Grafana.
 */
export const migrateLegacyPanelOptions = (options: KChartPanelOptions): KChartPanelOptions => {
  if (options.downsampleStrategy !== undefined) {
    return options;
  }

  return {
    ...options,
    downsampleStrategy: 'lttb',
  };
};
