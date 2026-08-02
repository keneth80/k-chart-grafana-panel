import {
  FieldType,
  getFieldDisplayName,
  type DataFrame,
  type DisplayProcessor,
  type Field,
  type FieldColorSeriesByMode,
  type FieldConfig,
  type ThresholdsConfig,
} from '@grafana/data';
import type { KChartNullMode } from '../types';

export type KChartPanelPoint = {
  __x: Date | number;
  [field: string]: Date | number | undefined;
};

export const KCHART_BASELINE_FIELD = '__kchart_baseline';

export interface KChartValueConfig {
  display?: DisplayProcessor;
  unit?: string;
  decimals?: number | null;
  min?: number;
  max?: number;
  rangeMin?: number;
  rangeMax?: number;
  thresholds?: ThresholdsConfig;
  color?: string;
  colorMode?: string;
  colorSeriesBy?: FieldColorSeriesByMode;
  derivedSeries?: boolean;
}

export interface KChartMetric extends KChartValueConfig {
  key: keyof KChartPanelPoint & string;
  fieldName: string;
  displayName: string;
  linkConfig?: FieldConfig;
  getLinks?: Field['getLinks'];
  linkRowByX?: Map<number, number>;
}

export interface KChartAxisField extends KChartValueConfig {
  fieldName: string;
  displayName: string;
}

export interface KChartDataModel {
  data: KChartPanelPoint[];
  metrics: KChartMetric[];
  xType: 'time' | 'number';
  xField?: KChartAxisField;
  error?: string;
}

export interface KChartFieldMapping {
  xField?: string;
  yField?: string;
  seriesField?: string;
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

const finiteNumber = (value: number | null | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const valueConfig = (field: Field): KChartValueConfig => ({
  display: field.display,
  unit: field.config.unit,
  decimals: field.config.decimals,
  min: finiteNumber(field.config.min),
  max: finiteNumber(field.config.max),
  rangeMin: finiteNumber(field.state?.range?.min),
  rangeMax: finiteNumber(field.state?.range?.max),
  thresholds: field.config.thresholds,
  color: field.config.color?.fixedColor,
  colorMode: field.config.color?.mode,
  colorSeriesBy: field.config.color?.seriesBy,
});

const metricLinks = (field: Field): Pick<KChartMetric, 'linkConfig' | 'getLinks' | 'linkRowByX'> => {
  const hasConfiguredLinks = (field.config.links?.length ?? 0) > 0;
  return {
    linkConfig: field.config,
    getLinks: hasConfiguredLinks ? field.getLinks : undefined,
    linkRowByX: hasConfiguredLinks ? new Map<number, number>() : undefined,
  };
};

const normalizedSelection = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const fieldMatches = (selection: string, frames: DataFrame[], frame: DataFrame, field: Field): boolean =>
  field.name === selection || metricName(frames, frame, field) === selection;

const findField = (
  frame: DataFrame,
  frames: DataFrame[],
  selection: string | undefined,
  predicate: (field: Field) => boolean
): Field | undefined => {
  if (!selection) {
    return frame.fields.find(predicate);
  }
  return frame.fields.find((field) => predicate(field) && fieldMatches(selection, frames, frame, field));
};

const emptyModel = (xType: KChartDataModel['xType'], error: string): KChartDataModel => ({
  data: [],
  metrics: [],
  xType,
  error,
});

const frameIdentity = (frame: DataFrame, frameIndex: number): string => {
  if (frame.refId && frame.name && frame.refId !== frame.name) {
    return `frame-ref-${frame.refId.length}-${encodeURIComponent(frame.refId)}-name-${frame.name.length}-${encodeURIComponent(frame.name)}`;
  }
  const identifier = frame.refId ?? frame.name;
  return identifier ? `frame-${encodeURIComponent(identifier)}` : `index-${frameIndex}`;
};

const categoryMetricKey = (identity: string, category: string): string => {
  const encodedCategory = encodeURIComponent(category);
  return `__series_${identity.length}_${identity}_${encodedCategory.length}_${encodedCategory}`;
};

export const buildKChartDataModel = (
  frames: DataFrame[],
  nullMode: KChartNullMode,
  mapping: KChartFieldMapping = {}
): KChartDataModel => {
  const xSelection = normalizedSelection(mapping.xField);
  const ySelection = normalizedSelection(mapping.yField);
  const seriesSelection = normalizedSelection(mapping.seriesField);
  const isAxisField = (field: Field) => field.type === FieldType.time || field.type === FieldType.number;
  const selectedXFields = frames.map((frame) => findField(frame, frames, xSelection, isAxisField));
  const hasTimeField = xSelection
    ? selectedXFields.some((field) => field?.type === FieldType.time)
    : frames.some((frame) => frame.fields.some((field) => field.type === FieldType.time));
  const xType: KChartDataModel['xType'] = hasTimeField ? 'time' : 'number';

  if (xSelection && selectedXFields.every((field) => !field)) {
    return emptyModel(xType, `X field "${xSelection}" was not found.`);
  }
  if (seriesSelection && !ySelection) {
    return emptyModel(xType, 'Select a Y field before selecting a Series field.');
  }

  const rows = new Map<number, KChartPanelPoint>();
  const metrics: KChartMetric[] = [];
  const compatibleFrames = frames.filter((frame) => {
    if (xSelection) {
      return Boolean(findField(frame, frames, xSelection, isAxisField));
    }
    return hasTimeField ? frame.fields.some((field) => field.type === FieldType.time) : true;
  });
  const frameIdentityBases = compatibleFrames.map(frameIdentity);
  const frameIdentityCounts = frameIdentityBases.reduce<Map<string, number>>((counts, identity) => {
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const categoryMetrics = new Map<string, KChartMetric>();
  let resolvedXField: KChartAxisField | undefined;
  let matchedYField = !ySelection;
  let matchedSeriesField = !seriesSelection;
  let matchedLongFormatFrame = !seriesSelection;
  let matchedDistinctYField = !ySelection;
  let matchedSameXYField = false;

  compatibleFrames.forEach((frame, frameIndex) => {
    const identityBase = frameIdentityBases[frameIndex];
    const identity =
      (frameIdentityCounts.get(identityBase) ?? 0) > 1 ? `${identityBase}-instance-${frameIndex}` : identityBase;
    const xField = xSelection
      ? findField(frame, frames, xSelection, isAxisField)
      : findField(frame, frames, undefined, (field) => field.type === FieldType.time);
    const yField = ySelection
      ? findField(frame, frames, ySelection, (field) => field.type === FieldType.number)
      : undefined;
    const seriesField = seriesSelection
      ? findField(frame, frames, seriesSelection, (field) => field.type === FieldType.string)
      : undefined;
    if (!resolvedXField && xField) {
      resolvedXField = {
        fieldName: xField.name,
        displayName: metricName(compatibleFrames, frame, xField),
        ...valueConfig(xField),
      };
    }
    matchedYField ||= Boolean(yField);
    matchedSeriesField ||= Boolean(seriesField);
    matchedLongFormatFrame ||= Boolean(yField && seriesField);
    if (yField) {
      matchedSameXYField ||= yField === xField;
      matchedDistinctYField ||= yField !== xField;
    }

    const numericFields = frame.fields.filter(
      (field) => field.type === FieldType.number && field !== xField && (!ySelection || field === yField)
    );
    const frameMetrics = seriesSelection
      ? []
      : numericFields.map((field) => {
          const metricIndex = metrics.length;
          const key = `__metric_${metricIndex}`;
          metrics.push({
            key,
            fieldName: field.name,
            displayName: metricName(compatibleFrames, frame, field),
            ...valueConfig(field),
            ...metricLinks(field),
          });
          return { field, key, metric: metrics[metricIndex] };
        });

    for (let rowIndex = 0; rowIndex < frame.length; rowIndex += 1) {
      const rawX = xField ? valueAt(xField, rowIndex) : rowIndex;
      const resolvedTime = xField?.type === FieldType.time ? timeValue(rawX) : undefined;
      const resolvedNumber = xField?.type === FieldType.number ? numericValue(rawX, 'skip') : undefined;
      if (
        (xField?.type === FieldType.time && !resolvedTime) ||
        (xField?.type === FieldType.number && resolvedNumber === undefined)
      ) {
        continue;
      }

      const xValue = resolvedTime ?? resolvedNumber ?? rowIndex;
      const xKey = resolvedTime ? resolvedTime.getTime() : Number(xValue);
      const row = rows.get(xKey) ?? {
        __x: xValue,
        [KCHART_BASELINE_FIELD]: 0,
      };
      let hasMetricValue = false;

      if (seriesSelection && yField && seriesField) {
        const rawCategory = valueAt(seriesField, rowIndex);
        if (rawCategory !== null && rawCategory !== undefined && rawCategory !== '') {
          const category = String(rawCategory);
          const categoryKey = `${identity}\u0000${category}`;
          let metric = categoryMetrics.get(categoryKey);
          if (!metric) {
            const frameLabel = frame.name ?? frame.refId ?? `Frame ${frameIndex + 1}`;
            const displayName = compatibleFrames.length > 1 ? `${frameLabel}: ${category}` : category;
            metric = {
              key: categoryMetricKey(identity, category),
              fieldName: category,
              displayName,
              ...valueConfig(yField),
              ...metricLinks(yField),
              derivedSeries: true,
            };
            categoryMetrics.set(categoryKey, metric);
            metrics.push(metric);
          }
          row[metric.key] = numericValue(valueAt(yField, rowIndex), nullMode);
          metric.linkRowByX?.set(xKey, rowIndex);
          hasMetricValue = true;
        }
      }

      frameMetrics.forEach(({ field, key, metric }) => {
        if (rowIndex >= field.values.length) {
          return;
        }
        row[key] = numericValue(valueAt(field, rowIndex), nullMode);
        metric.linkRowByX?.set(xKey, rowIndex);
        hasMetricValue = true;
      });
      if (hasMetricValue) {
        rows.set(xKey, row);
      }
    }
  });

  if (!matchedYField && ySelection) {
    return emptyModel(xType, `Y field "${ySelection}" was not found or is not numeric.`);
  }
  if (!matchedDistinctYField && matchedSameXYField) {
    return emptyModel(xType, 'X and Y fields must be different.');
  }
  if (!matchedSeriesField && seriesSelection) {
    return emptyModel(xType, `Series field "${seriesSelection}" was not found or is not text.`);
  }
  if (!matchedLongFormatFrame) {
    return emptyModel(xType, 'X, Y and Series fields must exist in the same data frame.');
  }

  return {
    data: Array.from(rows.values()).sort((left, right) => {
      const leftValue = left.__x instanceof Date ? left.__x.getTime() : left.__x;
      const rightValue = right.__x instanceof Date ? right.__x.getTime() : right.__x;
      return leftValue - rightValue;
    }),
    metrics: seriesSelection
      ? [...metrics].sort(
          (left, right) => left.displayName.localeCompare(right.displayName) || left.key.localeCompare(right.key)
        )
      : metrics,
    xType,
    xField: resolvedXField,
  };
};
