import { ThresholdsMode, type GrafanaTheme2 } from '@grafana/data';
import type { KChartDataModel, KChartMetric } from './dataFrame';
import {
  formatConfiguredValue,
  formatXAxisValue,
  resolveAxisBounds,
  resolveMetricColorValue,
  resolveThresholdGuideLines,
  sharedYAxisWarning,
} from './fieldConfig';

const metric = (overrides: Partial<KChartMetric> = {}): KChartMetric => ({
  key: '__metric_0',
  fieldName: 'Value',
  displayName: 'Value',
  ...overrides,
});

const model = (resolvedMetric: KChartMetric, values: number[]): KChartDataModel => ({
  xType: 'number',
  metrics: [resolvedMetric],
  data: values.map((value, index) => ({ __x: index, __kchart_baseline: 0, [resolvedMetric.key]: value })),
});

const theme = {
  visualization: {
    getColorByName: (color: string) => `resolved:${color}`,
  },
  colors: {
    text: { primary: '#fff' },
    background: { primary: '#111' },
  },
} as unknown as GrafanaTheme2;

describe('Grafana field configuration adapter', () => {
  it('formats Y values with Grafana units and decimals', () => {
    expect(formatConfiguredValue({ unit: 'percent', decimals: 1 }, 12.34)).toContain('12.3%');
  });

  it('does not treat numeric X values as timestamps in auto mode', () => {
    expect(formatXAxisValue(42, 'auto', undefined, 'utc', 'number')).toBe('42');
  });

  it('formats time X values with the selected date format', () => {
    expect(formatXAxisValue(new Date('2026-07-27T12:34:56Z'), 'date', undefined, 'utc', 'time')).toBe('2026-07-27');
  });

  it('applies the Grafana timezone to automatic time labels', () => {
    expect(formatXAxisValue(new Date('2026-07-27T12:34:56Z'), 'auto', undefined, 'Asia/Seoul', 'time')).toBe(
      '2026-07-27 21:34:56'
    );
  });

  it('combines configured shared-axis bounds without clipping configured fields', () => {
    expect(resolveAxisBounds([metric({ min: 10, max: 90 }), metric({ min: 0, max: 100 })])).toEqual({
      min: 0,
      max: 100,
    });
  });

  it('resolves value-based colors using Grafana seriesBy', () => {
    const values = [40, 90, 60];
    const minimumMetric = metric({ colorSeriesBy: 'min' });
    const maximumMetric = metric({ colorSeriesBy: 'max' });
    const lastMetric = metric({ colorSeriesBy: 'last' });

    expect(resolveMetricColorValue(model(minimumMetric, values).data, minimumMetric)).toBe(40);
    expect(resolveMetricColorValue(model(maximumMetric, values).data, maximumMetric)).toBe(90);
    expect(resolveMetricColorValue(model(lastMetric, values).data, lastMetric)).toBe(60);
  });

  it('uses the last finite value when a series ends with missing values', () => {
    const lastMetric = metric({ colorSeriesBy: 'last' });
    expect(
      resolveMetricColorValue(
        [
          { __x: 0, __kchart_baseline: 0, [lastMetric.key]: 42 },
          { __x: 1, __kchart_baseline: 0, [lastMetric.key]: undefined },
          { __x: 2, __kchart_baseline: 0, [lastMetric.key]: Number.NaN },
        ],
        lastMetric
      )
    ).toBe(42);
  });

  it('warns when incompatible units share one Y axis', () => {
    expect(sharedYAxisWarning([metric({ unit: 'percent' }), metric({ unit: 'bytes' })])).toContain('Mixed units');
    expect(sharedYAxisWarning([metric({ unit: 'percent' }), metric({ unit: 'percent' })])).toBeUndefined();
    expect(sharedYAxisWarning([metric(), metric({ unit: 'short' })])).toBeUndefined();
  });

  it('turns absolute Grafana thresholds into KChart guide lines', () => {
    const configuredMetric = metric({
      unit: 'percent',
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { color: 'green', value: Number.NEGATIVE_INFINITY },
          { color: 'red', value: 80 },
        ],
      },
    });

    expect(resolveThresholdGuideLines(model(configuredMetric, [50, 90]), [configuredMetric], theme)).toEqual([
      expect.objectContaining({ axis: 'y', value: 80, color: 'resolved:red', label: '≥ 80%' }),
    ]);
  });

  it('resolves percentage thresholds against the field range', () => {
    const configuredMetric = metric({
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { color: 'green', value: Number.NEGATIVE_INFINITY },
          { color: 'orange', value: 75 },
        ],
      },
    });

    expect(resolveThresholdGuideLines(model(configuredMetric, [20, 100]), [configuredMetric], theme)[0]).toEqual(
      expect.objectContaining({ value: 80, color: 'resolved:orange' })
    );
  });
});
