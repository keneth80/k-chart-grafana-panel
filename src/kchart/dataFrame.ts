import { FieldType, getFieldDisplayName, type DataFrame, type Field } from '@grafana/data';
import type { KChartNullMode } from '../types';

export type KChartPanelPoint = {
  __x: Date | number;
  [field: string]: Date | number | undefined;
};

export interface KChartMetric {
  key: string;
  displayName: string;
  color?: string;
}

export interface KChartDataModel {
  data: KChartPanelPoint[];
  metrics: KChartMetric[];
  xType: 'time' | 'number';
}

const valueAt = (field: Field, index: number): unknown => {
  const values = field.values as unknown as {
    get?: (valueIndex: number) => unknown;
    [valueIndex: number]: unknown;
  };
  return typeof values.get === 'function' ? values.get(index) : values[index];
};

const numericValue = (value: unknown, nullMode: KChartNullMode): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return nullMode === 'zero' ? 0 : undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return nullMode === 'zero' ? 0 : undefined;
  }
  return numeric;
};

const timeValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : undefined;
  }

  const timestamp = typeof value === 'number' ? value : Date.parse(String(value));
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
};

const metricName = (frames: DataFrame[], frame: DataFrame, field: Field): string =>
  getFieldDisplayName(field, frame, frames);

export const buildKChartDataModel = (
  frames: DataFrame[],
  nullMode: KChartNullMode
): KChartDataModel => {
  const hasTimeField = frames.some((frame) => frame.fields.some((field) => field.type === FieldType.time));
  const rows = new Map<number, KChartPanelPoint>();
  const metrics: KChartMetric[] = [];
  const compatibleFrames = hasTimeField
    ? frames.filter((frame) => frame.fields.some((field) => field.type === FieldType.time))
    : frames;

  compatibleFrames.forEach((frame) => {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    const numericFields = frame.fields.filter((field) => field.type === FieldType.number);
    const frameMetrics = numericFields.map((field) => {
      const metricIndex = metrics.length;
      const key = `__metric_${metricIndex}`;
      metrics.push({
        key,
        displayName: metricName(compatibleFrames, frame, field),
        color: field.config.color?.fixedColor,
      });
      return { field, key };
    });

    for (let rowIndex = 0; rowIndex < frame.length; rowIndex += 1) {
      const resolvedTime = timeField ? timeValue(valueAt(timeField, rowIndex)) : undefined;
      if (hasTimeField && !resolvedTime) {
        continue;
      }

      const xKey = resolvedTime ? resolvedTime.getTime() : rowIndex;
      const row = rows.get(xKey) ?? {
        __x: resolvedTime ?? rowIndex,
      };
      let hasMetricValue = false;
      frameMetrics.forEach(({ field, key }) => {
        if (rowIndex >= field.values.length) {
          return;
        }
        row[key] = numericValue(valueAt(field, rowIndex), nullMode);
        hasMetricValue = true;
      });
      if (hasMetricValue) {
        rows.set(xKey, row);
      }
    }
  });

  return {
    data: Array.from(rows.values()).sort((left, right) => {
      const leftValue = left.__x instanceof Date ? left.__x.getTime() : left.__x;
      const rightValue = right.__x instanceof Date ? right.__x.getTime() : right.__x;
      return leftValue - rightValue;
    }),
    metrics,
    xType: hasTimeField ? 'time' : 'number',
  };
};
