export type KChartRenderer = 'svg' | 'canvas' | 'webgl';
export type KChartChartType = 'line' | 'column' | 'area' | 'scatter' | 'candlestick';
export type KChartNullMode = 'skip' | 'zero';
export type KChartXAxisFormat = 'auto' | 'time' | 'date' | 'date-time' | 'number';

export interface KChartPanelOptions {
  chartType: KChartChartType;
  renderer: KChartRenderer;
  xField?: string;
  yField?: string;
  seriesField?: string;
  openField?: string;
  highField?: string;
  lowField?: string;
  closeField?: string;
  showLegend: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  curve: boolean;
  animation: boolean;
  downsample: boolean;
  lineWidth: number;
  nullMode: KChartNullMode;
  xAxisTitle?: string;
  yAxisTitle?: string;
  xAxisFormat: KChartXAxisFormat;
  showThresholds: boolean;
}
