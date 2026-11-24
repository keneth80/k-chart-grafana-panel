import type { KChartPanelOptions } from '../types';
import { migrateLegacyPanelOptions } from './optionsMigration';

const options = (overrides: Partial<KChartPanelOptions> = {}): KChartPanelOptions => ({
  chartType: 'line',
  renderer: 'svg',
  showLegend: true,
  showGrid: true,
  showTooltip: true,
  curve: true,
  animation: false,
  downsample: true,
  lineWidth: 2,
  nullMode: 'skip',
  xAxisFormat: 'auto',
  showThresholds: true,
  ...overrides,
});

describe('migrateLegacyPanelOptions', () => {
  it('preserves the LTTB behavior of panels saved before strategy options existed', () => {
    expect(migrateLegacyPanelOptions(options()).downsampleStrategy).toBe('lttb');
  });

  it.each(['auto', 'min-max', 'lttb'] as const)('keeps an explicit %s strategy', (downsampleStrategy) => {
    const current = options({ downsampleStrategy });

    expect(migrateLegacyPanelOptions(current)).toBe(current);
  });
});
