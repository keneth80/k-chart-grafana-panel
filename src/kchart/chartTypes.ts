import type { KChartMetric } from './dataFrame';

export interface KChartCandlestickMetrics {
  open: KChartMetric;
  high: KChartMetric;
  low: KChartMetric;
  close: KChartMetric;
}

export interface KChartCandlestickFieldMapping {
  openField?: string;
  highField?: string;
  lowField?: string;
  closeField?: string;
}

const roleAliases = {
  open: ['open', '시가'],
  high: ['high', '고가'],
  low: ['low', '저가'],
  close: ['close', '종가'],
} as const;

const nameParts = (value: string): string[] =>
  value
    .trim()
    .toLocaleLowerCase()
    .split(/[\s_.()[\]{}:/\\-]+/)
    .filter(Boolean);

const matchesRole = (metric: KChartMetric, aliases: readonly string[]): boolean => {
  const names = [metric.fieldName, metric.displayName].map(nameParts);
  return names.some((parts) => aliases.some((alias) => parts.includes(alias)));
};

const findMetric = (
  metrics: KChartMetric[],
  selection: string | undefined,
  aliases: readonly string[]
): KChartMetric | undefined => {
  const trimmed = selection?.trim();
  if (trimmed) {
    return metrics.find((metric) => metric.fieldName === trimmed || metric.displayName === trimmed);
  }
  return metrics.find((metric) => matchesRole(metric, aliases));
};

export const resolveCandlestickMetrics = (
  metrics: KChartMetric[],
  mapping: KChartCandlestickFieldMapping = {}
): KChartCandlestickMetrics | undefined => {
  const open = findMetric(metrics, mapping.openField, roleAliases.open);
  const high = findMetric(metrics, mapping.highField, roleAliases.high);
  const low = findMetric(metrics, mapping.lowField, roleAliases.low);
  const close = findMetric(metrics, mapping.closeField, roleAliases.close);

  return open && high && low && close ? { open, high, low, close } : undefined;
};

export const candlestickFieldError =
  'Candlestick requires Open, High, Low and Close numeric fields. Map them in panel options or use recognized field names.';
