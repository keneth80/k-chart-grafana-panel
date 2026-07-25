import { FieldType, toDataFrame } from '@grafana/data';
import { buildKChartDataModel } from './dataFrame';

describe('buildKChartDataModel', () => {
  it('converts Grafana time and numeric fields into KChart rows', () => {
    const frame = toDataFrame({
      name: 'CPU',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        {
          name: 'Usage',
          type: FieldType.number,
          values: [12, 18],
          config: { displayName: 'CPU usage' },
        },
      ],
    });

    const model = buildKChartDataModel([frame], 'skip');

    expect(model.xType).toBe('time');
    expect(model.metrics).toEqual([
      expect.objectContaining({ key: '__metric_0', displayName: 'CPU usage' }),
    ]);
    expect(model.data).toEqual([
      { __x: new Date(1000), __metric_0: 12 },
      { __x: new Date(2000), __metric_0: 18 },
    ]);
  });

  it('merges metrics by timestamp and replaces nulls with zero', () => {
    const first = toDataFrame({
      name: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [1, null] },
      ],
    });
    const second = toDataFrame({
      name: 'B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [3, 4] },
      ],
    });

    const model = buildKChartDataModel([first, second], 'zero');

    expect(model.metrics.map((metric) => metric.displayName)).toEqual(['A', 'B']);
    expect(model.data).toEqual([
      { __x: new Date(1000), __metric_0: 1, __metric_1: 3 },
      { __x: new Date(2000), __metric_0: 0, __metric_1: 4 },
    ]);
  });

  it('skips invalid values without manufacturing zeroes', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [null, 7] },
      ],
    });

    expect(buildKChartDataModel([frame], 'skip').data).toEqual([
      { __x: new Date(1000), __metric_0: undefined },
      { __x: new Date(2000), __metric_0: 7 },
    ]);
  });

  it('ignores non-time frames when the result contains time-series frames', () => {
    const timed = toDataFrame({
      name: 'Timed',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Value', type: FieldType.number, values: [8] },
      ],
    });
    const indexed = toDataFrame({
      name: 'Indexed',
      fields: [{ name: 'Value', type: FieldType.number, values: [99] }],
    });

    const model = buildKChartDataModel([timed, indexed], 'skip');

    expect(model.metrics).toEqual([
      expect.objectContaining({ key: '__metric_0', displayName: 'Timed' }),
    ]);
    expect(model.data).toEqual([{ __x: new Date(1000), __metric_0: 8 }]);
  });

  it('uses Grafana field labels to distinguish metric names', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [12],
          labels: { host: 'api-01' },
        },
      ],
    });

    const model = buildKChartDataModel([frame], 'skip');

    expect(model.metrics[0].displayName).toContain('api-01');
  });

  it('keeps the last value when a metric contains duplicate timestamps', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000] },
        { name: 'Value', type: FieldType.number, values: [4, 9] },
      ],
    });

    expect(buildKChartDataModel([frame], 'skip').data).toEqual([
      { __x: new Date(1000), __metric_0: 9 },
    ]);
  });
});
