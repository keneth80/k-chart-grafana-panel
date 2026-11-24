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

export interface KChartMetricPointIndex {
  finitePoints: KChartPanelPoint[];
  duplicatePointsByX: ReadonlyMap<number, KChartPanelPoint[]>;
}

export interface KChartMetric extends KChartValueConfig {
  key: keyof KChartPanelPoint & string;
  fieldName: string;
  displayName: string;
  finitePoints?: KChartPanelPoint[];
  pointIndex?: KChartMetricPointIndex;
  colorValue?: number;
  linkConfig?: FieldConfig;
  getLinks?: Field['getLinks'];
  linkRowByX?: Map<number, number>;
  linkRowByPoint?: WeakMap<KChartPanelPoint, number>;
}

export interface KChartAxisField extends KChartValueConfig {
  fieldName: string;
  displayName: string;
}

export interface KChartDataModel {
  data: KChartPanelPoint[];
  metrics: KChartMetric[];
  xType: 'time' | 'number';
  hasFiniteData: boolean;
  xField?: KChartAxisField;
  error?: string;
}

export interface KChartFieldMapping {
  xField?: string;
  yField?: string;
  seriesField?: string;
  preserveDuplicateX?: boolean;
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

const metricLinks = (field: Field): Pick<KChartMetric, 'linkConfig' | 'getLinks' | 'linkRowByX' | 'linkRowByPoint'> => {
  const hasConfiguredLinks = (field.config.links?.length ?? 0) > 0;
  return {
    linkConfig: field.config,
    getLinks: hasConfiguredLinks ? field.getLinks : undefined,
    linkRowByX: hasConfiguredLinks ? new Map<number, number>() : undefined,
    linkRowByPoint: hasConfiguredLinks ? new WeakMap<KChartPanelPoint, number>() : undefined,
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
  hasFiniteData: false,
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

const comparableX = (point: KChartPanelPoint): number => (point.__x instanceof Date ? point.__x.getTime() : point.__x);

const ensureSortedRows = (data: KChartPanelPoint[]): KChartPanelPoint[] => {
  for (let index = 1; index < data.length; index += 1) {
    if (comparableX(data[index - 1]) > comparableX(data[index])) {
      return data.sort((left, right) => comparableX(left) - comparableX(right));
    }
  }
  return data;
};

const usesValueBasedColor = (metric: KChartMetric): boolean =>
  Boolean(metric.colorMode && metric.colorMode !== 'fixed' && !metric.colorMode.startsWith('palette-'));

const pointIndexesByData = new WeakMap<KChartPanelPoint[], ReadonlyMap<string, KChartMetricPointIndex>>();

export const getMetricPointIndex = (data: KChartPanelPoint[], metricKey: string): KChartMetricPointIndex | undefined =>
  pointIndexesByData.get(data)?.get(metricKey);

export const getFiniteMetricPoints = (data: KChartPanelPoint[], metricKey: string): KChartPanelPoint[] | undefined =>
  getMetricPointIndex(data, metricKey)?.finitePoints;

type KChartPositionScale = (value: Date | number) => unknown;

export const findNearestMetricPoint = (
  pointIndex: KChartMetricPointIndex,
  metricKey: string,
  targetX: number,
  mouseX: number,
  mouseY: number,
  xScale: KChartPositionScale,
  yScale: KChartPositionScale
): { data: KChartPanelPoint; x: number; y: number; distance: number } | undefined => {
  const finitePoints = pointIndex.finitePoints;
  let low = 0;
  let high = finitePoints.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (comparableX(finitePoints[middle]) < targetX) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  let nearest: { data: KChartPanelPoint; x: number; y: number; distance: number } | undefined;
  let previousCandidateX: number | undefined;
  for (let xOffset = 0; xOffset < 2; xOffset += 1) {
    const candidateIndex = xOffset === 0 ? low - 1 : low;
    if (candidateIndex < 0 || candidateIndex >= finitePoints.length) {
      continue;
    }
    const point = finitePoints[candidateIndex];
    const candidateX = comparableX(point);
    if (candidateX === previousCandidateX) {
      continue;
    }
    previousCandidateX = candidateX;

    const x = Number(xScale(point.__x));
    const pointsByY = pointIndex.duplicatePointsByX.get(candidateX);
    if (!pointsByY) {
      const y = Number(yScale(point[metricKey] as number));
      const distance = Math.hypot(x - mouseX, y - mouseY);
      if (!nearest || distance < nearest.distance) {
        nearest = { data: point, x, y, distance };
      }
      continue;
    }

    const firstY = Number(yScale(pointsByY[0][metricKey] as number));
    const lastY = Number(yScale(pointsByY[pointsByY.length - 1][metricKey] as number));
    const ascending = firstY <= lastY;
    let yLow = 0;
    let yHigh = pointsByY.length;
    while (yLow < yHigh) {
      const middle = (yLow + yHigh) >>> 1;
      const projected = Number(yScale(pointsByY[middle][metricKey] as number));
      if (ascending ? projected < mouseY : projected > mouseY) {
        yLow = middle + 1;
      } else {
        yHigh = middle;
      }
    }

    for (let yOffset = 0; yOffset < 2; yOffset += 1) {
      const yIndex = yOffset === 0 ? yLow - 1 : yLow;
      if (yIndex < 0 || yIndex >= pointsByY.length) {
        continue;
      }
      const candidate = pointsByY[yIndex];
      const y = Number(yScale(candidate[metricKey] as number));
      const distance = Math.hypot(x - mouseX, y - mouseY);
      if (!nearest || distance < nearest.distance) {
        nearest = { data: candidate, x, y, distance };
      }
    }
  }

  return nearest;
};

const populateMetricCaches = (data: KChartPanelPoint[], metrics: KChartMetric[]): boolean => {
  let hasFiniteData = false;
  const pointIndexesByMetric = new Map<string, KChartMetricPointIndex>();
  const accumulators = new Map(
    metrics.map((metric) => [
      metric.key,
      {
        metric,
        finitePoints: [] as KChartPanelPoint[],
        colorValue: undefined as number | undefined,
      },
    ])
  );

  // Iterate values that actually exist on each row. Long-format data usually
  // has one metric key per row, so this remains linear instead of N rows x M
  // derived categories.
  for (const point of data) {
    for (const key in point) {
      const accumulator = accumulators.get(key);
      if (!accumulator) {
        continue;
      }
      const value = point[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }
      accumulator.finitePoints.push(point);
      hasFiniteData = true;
      if (usesValueBasedColor(accumulator.metric)) {
        const seriesBy = accumulator.metric.colorSeriesBy ?? 'last';
        accumulator.colorValue =
          accumulator.colorValue === undefined
            ? value
            : seriesBy === 'min'
              ? Math.min(accumulator.colorValue, value)
              : seriesBy === 'max'
                ? Math.max(accumulator.colorValue, value)
                : value;
      }
    }
  }

  for (const metric of metrics) {
    const accumulator = accumulators.get(metric.key)!;
    const finitePoints = accumulator.finitePoints;
    const duplicatePointsByX = new Map<number, KChartPanelPoint[]>();
    for (let start = 0; start < finitePoints.length;) {
      const x = comparableX(finitePoints[start]);
      let end = start + 1;
      while (end < finitePoints.length && comparableX(finitePoints[end]) === x) {
        end += 1;
      }
      if (end - start > 1) {
        duplicatePointsByX.set(
          x,
          finitePoints
            .slice(start, end)
            .sort((left, right) => (left[metric.key] as number) - (right[metric.key] as number))
        );
      }
      start = end;
    }
    const pointIndex = { finitePoints, duplicatePointsByX };
    pointIndexesByMetric.set(metric.key, pointIndex);
    Object.defineProperties(metric, {
      finitePoints: { value: finitePoints, enumerable: false, configurable: true },
      pointIndex: { value: pointIndex, enumerable: false, configurable: true },
      colorValue: { value: accumulator.colorValue, enumerable: false, configurable: true },
    });
  }

  pointIndexesByData.set(data, pointIndexesByMetric);
  return hasFiniteData;
};

export const buildKChartDataModel = (
  frames: DataFrame[],
  nullMode: KChartNullMode,
  mapping: KChartFieldMapping = {}
): KChartDataModel => {
  const xSelection = normalizedSelection(mapping.xField);
  const ySelection = normalizedSelection(mapping.yField);
  const seriesSelection = normalizedSelection(mapping.seriesField);
  const preserveDuplicateX = mapping.preserveDuplicateX === true;
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
  const duplicateRows: KChartPanelPoint[] = [];
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
      const row = (preserveDuplicateX ? undefined : rows.get(xKey)) ?? {
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
          const value = numericValue(valueAt(yField, rowIndex), nullMode);
          row[metric.key] = value;
          metric.linkRowByX?.set(xKey, rowIndex);
          metric.linkRowByPoint?.set(row, rowIndex);
          hasMetricValue = true;
        }
      }

      frameMetrics.forEach(({ field, key, metric }) => {
        if (rowIndex >= field.values.length) {
          return;
        }
        const value = numericValue(valueAt(field, rowIndex), nullMode);
        row[key] = value;
        metric.linkRowByX?.set(xKey, rowIndex);
        metric.linkRowByPoint?.set(row, rowIndex);
        hasMetricValue = true;
      });
      if (hasMetricValue) {
        if (preserveDuplicateX) {
          duplicateRows.push(row);
        } else {
          rows.set(xKey, row);
        }
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

  const data = ensureSortedRows(preserveDuplicateX ? duplicateRows : Array.from(rows.values()));
  const sortedMetrics = seriesSelection
    ? [...metrics].sort(
        (left, right) => left.displayName.localeCompare(right.displayName) || left.key.localeCompare(right.key)
      )
    : metrics;

  return {
    data,
    metrics: sortedMetrics,
    xType,
    hasFiniteData: populateMetricCaches(data, sortedMetrics),
    xField: resolvedXField,
  };
};
