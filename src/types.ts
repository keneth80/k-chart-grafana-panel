export type KChartRenderer = 'svg' | 'canvas' | 'webgl';
export type KChartNullMode = 'skip' | 'zero';

export interface KChartPanelOptions {
  renderer: KChartRenderer;
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  curve: boolean;
  animation: boolean;
  downsample: boolean;
  lineWidth: number;
  nullMode: KChartNullMode;
}
