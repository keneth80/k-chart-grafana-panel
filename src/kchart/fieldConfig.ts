import {
  ThresholdsMode,
  dateTimeFormat,
  formattedValueToString,
  getValueFormat,
  type GrafanaTheme2,
} from '@grafana/data';
import type { TimeZone } from '@grafana/schema';
import type { KChartFixedGuideLine } from '@keneth80/k-chart/core/contracts';
import type { KChartXAxisFormat } from '../types';
import type { KChartAxisField, KChartDataModel, KChartMetric, KChartValueConfig } from './dataFrame';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const formatConfiguredValue = (config: KChartValueConfig | undefined, value: unknown): string => {
  if (!finite(value)) {
    return value instanceof Date ? value.toISOString() : String(value ?? '');
  }

  if (config?.display) {
    try {
      return formattedValueToString(config.display(value, config.decimals));
    } catch {
      // A malformed external display processor should not prevent panel rendering.
    }
  }

  return formattedValueToString(getValueFormat(config?.unit)(value, config?.decimals));
};

export const formatXAxisValue = (
  value: unknown,
  format: KChartXAxisFormat,
  field: KChartAxisField | undefined,
  timeZone: TimeZone,
  xType: KChartDataModel['xType']
): string => {
  const resolvedDate = value instanceof Date ? value : finite(value) ? new Date(value) : undefined;
  if (xType === 'time' && format !== 'number' && resolvedDate && Number.isFinite(resolvedDate.getTime())) {
    const dateFormat =
      format === 'time'
        ? 'HH:mm:ss'
        : format === 'date'
          ? 'YYYY-MM-DD'
          : format === 'date-time'
            ? 'YYYY-MM-DD HH:mm'
            : 'YYYY-MM-DD HH:mm:ss';
    return dateTimeFormat(resolvedDate, { format: dateFormat, timeZone });
  }
  return formatConfiguredValue(field, value);
};

export const resolveAxisBounds = (metrics: KChartMetric[]): { min?: number; max?: number } => {
  const minimums = metrics.map((metric) => metric.min).filter(finite);
  const maximums = metrics.map((metric) => metric.max).filter(finite);
  return {
    min: minimums.length > 0 ? Math.min(...minimums) : undefined,
    max: maximums.length > 0 ? Math.max(...maximums) : undefined,
  };
};

export const resolveMetricColorValue = (data: KChartDataModel['data'], metric: KChartMetric): number | undefined => {
  let resolved: number | undefined;
  const seriesBy = metric.colorSeriesBy ?? 'last';
  const direction = seriesBy === 'last' ? -1 : 1;
  for (let index = seriesBy === 'last' ? data.length - 1 : 0; index >= 0 && index < data.length; index += direction) {
    const value = data[index][metric.key];
    if (!finite(value)) {
      continue;
    }
    if (seriesBy === 'last') {
      return value;
    }
    resolved =
      resolved === undefined ? value : seriesBy === 'min' ? Math.min(resolved, value) : Math.max(resolved, value);
  }
  return resolved;
};

export const sharedYAxisWarning = (metrics: KChartMetric[]): string | undefined => {
  // Grafana's implicit numeric unit and the explicit `short` unit render equivalently.
  const units = new Set(metrics.map((metric) => metric.unit ?? 'short'));
  return units.size > 1
    ? 'Mixed units share one Y-axis. Use Grafana field overrides with compatible units.'
    : undefined;
};

const dataRange = (model: KChartDataModel, metric: KChartMetric): { min?: number; max?: number } => {
  let min = metric.derivedSeries ? metric.min : (metric.rangeMin ?? metric.min);
  let max = metric.derivedSeries ? metric.max : (metric.rangeMax ?? metric.max);
  if (finite(min) && finite(max)) {
    return { min, max };
  }

  for (const point of model.data) {
    const value = point[metric.key];
    if (!finite(value)) {
      continue;
    }
    min = finite(min) ? Math.min(min, value) : value;
    max = finite(max) ? Math.max(max, value) : value;
  }
  return { min, max };
};

export const resolveThresholdGuideLines = (
  model: KChartDataModel,
  metrics: KChartMetric[],
  theme: GrafanaTheme2
): KChartFixedGuideLine[] => {
  const guides: KChartFixedGuideLine[] = [];
  const seen = new Set<string>();

  for (const metric of metrics) {
    const thresholds = metric.thresholds;
    if (!thresholds) {
      continue;
    }
    const range = thresholds.mode === ThresholdsMode.Percentage ? dataRange(model, metric) : undefined;

    for (const step of thresholds.steps) {
      if (!finite(step.value)) {
        continue;
      }
      let value = step.value;
      if (thresholds.mode === ThresholdsMode.Percentage) {
        if (!finite(range?.min) || !finite(range?.max)) {
          continue;
        }
        value = range.min + ((range.max - range.min) * step.value) / 100;
      }
      const color = theme.visualization.getColorByName(step.color);
      const labelValue = formatConfiguredValue(metric, value);
      const key = `${value}\u0000${color}\u0000${labelValue}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      guides.push({
        axis: 'y',
        value,
        label: metrics.length > 1 ? `${metric.displayName} ≥ ${labelValue}` : `≥ ${labelValue}`,
        color,
        width: 1,
        dasharray: '5 4',
        labelColor: theme.colors.text.primary,
        labelBackground: theme.colors.background.primary,
      });
    }
  }

  return guides.sort((left, right) => Number(left.value) - Number(right.value));
};
