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
      expect.objectContaining({
        key: '__metric_0',
        fieldName: 'Usage',
        displayName: 'CPU usage',
      }),
    ]);
    expect(model.data).toEqual([
      { __x: new Date(1000), __kchart_baseline: 0, __metric_0: 12 },
      { __x: new Date(2000), __kchart_baseline: 0, __metric_0: 18 },
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
      { __x: new Date(1000), __kchart_baseline: 0, __metric_0: 1, __metric_1: 3 },
      { __x: new Date(2000), __kchart_baseline: 0, __metric_0: 0, __metric_1: 4 },
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
      { __x: new Date(1000), __kchart_baseline: 0, __metric_0: undefined },
      { __x: new Date(2000), __kchart_baseline: 0, __metric_0: 7 },
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

    expect(model.metrics).toEqual([expect.objectContaining({ key: '__metric_0', displayName: 'Timed' })]);
    expect(model.data).toEqual([{ __x: new Date(1000), __kchart_baseline: 0, __metric_0: 8 }]);
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

  it('carries Grafana unit, color, bounds and thresholds into metric metadata', () => {
    const thresholds = {
      mode: 'absolute' as const,
      steps: [
        { color: 'green', value: Number.NEGATIVE_INFINITY },
        { color: 'red', value: 80 },
      ],
    };
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        {
          name: 'Usage',
          type: FieldType.number,
          values: [75],
          config: {
            unit: 'percent',
            decimals: 1,
            min: 0,
            max: 100,
            color: { mode: 'fixed', fixedColor: 'orange' },
            thresholds,
          },
        },
      ],
    });

    expect(buildKChartDataModel([frame], 'skip').metrics[0]).toEqual(
      expect.objectContaining({
        unit: 'percent',
        decimals: 1,
        min: 0,
        max: 100,
        color: 'orange',
        colorMode: 'fixed',
        thresholds,
      })
    );
  });

  it('keeps Grafana Data Link suppliers and source row indexes with each metric', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        {
          name: 'Usage',
          type: FieldType.number,
          values: [75, 80],
          config: { links: [{ title: 'Details', url: '/details/${__value.raw}' }] },
        },
      ],
    });
    const getLinks = jest.fn(() => []);
    frame.fields[1].getLinks = getLinks;

    const resolvedMetric = buildKChartDataModel([frame], 'skip').metrics[0];

    expect(resolvedMetric.getLinks).toBe(getLinks);
    expect(resolvedMetric.linkConfig?.links).toHaveLength(1);
    expect(resolvedMetric.linkRowByX).toEqual(
      new Map([
        [1000, 0],
        [2000, 1],
      ])
    );
  });

  it('keeps the last value when a metric contains duplicate timestamps', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000] },
        { name: 'Value', type: FieldType.number, values: [4, 9] },
      ],
    });

    expect(buildKChartDataModel([frame], 'skip').data).toEqual([
      { __x: new Date(1000), __kchart_baseline: 0, __metric_0: 9 },
    ]);
  });

  it('uses explicitly selected numeric X and Y fields', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Index', type: FieldType.number, values: [10, 20] },
        { name: 'Temperature', type: FieldType.number, values: [21, 23] },
        { name: 'Humidity', type: FieldType.number, values: [40, 44] },
      ],
    });

    const model = buildKChartDataModel([frame], 'skip', {
      xField: 'Index',
      yField: 'Humidity',
    });

    expect(model.xType).toBe('number');
    expect(model.metrics.map((metric) => metric.fieldName)).toEqual(['Humidity']);
    expect(model.data).toEqual([
      { __x: 10, __kchart_baseline: 0, __metric_0: 40 },
      { __x: 20, __kchart_baseline: 0, __metric_0: 44 },
    ]);
  });

  it('pivots Time, Series and Value long-format fields into KChart series', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000, 2000, 2000] },
        { name: 'Host', type: FieldType.string, values: ['api-01', 'api-02', 'api-01', 'api-02'] },
        { name: 'Value', type: FieldType.number, values: [11, 17, 13, 19] },
      ],
    });

    const model = buildKChartDataModel([frame], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(model.metrics.map((metric) => metric.displayName)).toEqual(['api-01', 'api-02']);
    expect(model.data).toEqual([
      {
        __x: new Date(1000),
        __kchart_baseline: 0,
        '__series_7_index-0_6_api-01': 11,
        '__series_7_index-0_6_api-02': 17,
      },
      {
        __x: new Date(2000),
        __kchart_baseline: 0,
        '__series_7_index-0_6_api-01': 13,
        '__series_7_index-0_6_api-02': 19,
      },
    ]);
  });

  it('returns a clear mapping error when a selected field is unavailable', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Value', type: FieldType.number, values: [7] },
      ],
    });

    expect(buildKChartDataModel([frame], 'skip', { yField: 'Missing' }).error).toBe(
      'Y field "Missing" was not found or is not numeric.'
    );
    expect(buildKChartDataModel([frame], 'skip', { seriesField: 'Host' }).error).toBe(
      'Select a Y field before selecting a Series field.'
    );
  });

  it('keeps identical category names from separate frames as distinct series', () => {
    const first = toDataFrame({
      name: 'Query A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [11] },
      ],
    });
    const second = toDataFrame({
      name: 'Query B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [19] },
      ],
    });

    const model = buildKChartDataModel([first, second], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(model.metrics.map((metric) => metric.displayName)).toEqual(['Query A: api-01', 'Query B: api-01']);
    expect(model.data).toEqual([
      {
        __x: new Date(1000),
        __kchart_baseline: 0,
        '__series_15_frame-Query%20A_6_api-01': 11,
        '__series_15_frame-Query%20B_6_api-01': 19,
      },
    ]);
  });

  it('keeps long-format metric keys and order stable when category arrival order changes', () => {
    const first = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000] },
        { name: 'Host', type: FieldType.string, values: ['api-02', 'api-01'] },
        { name: 'Value', type: FieldType.number, values: [17, 11] },
      ],
    });
    const second = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01', 'api-02'] },
        { name: 'Value', type: FieldType.number, values: [11, 17] },
      ],
    });
    const mapping = { xField: 'Time', yField: 'Value', seriesField: 'Host' };

    const firstModel = buildKChartDataModel([first], 'skip', mapping);
    const secondModel = buildKChartDataModel([second], 'skip', mapping);

    expect(firstModel.metrics.map(({ key, displayName }) => ({ key, displayName }))).toEqual(
      secondModel.metrics.map(({ key, displayName }) => ({ key, displayName }))
    );
    expect(firstModel.metrics.map((metric) => metric.key)).toEqual([
      '__series_7_index-0_6_api-01',
      '__series_7_index-0_6_api-02',
    ]);
  });

  it('keeps each long-format category linked to its original source row', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01', 'api-02'] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [11, 17],
          config: { links: [{ title: 'Host details', url: '/hosts/${__value.raw}' }] },
        },
      ],
    });
    frame.fields[2].getLinks = jest.fn(() => []);

    const resolved = buildKChartDataModel([frame], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(resolved.metrics.map((item) => item.linkRowByX?.get(1000))).toEqual([0, 1]);
  });

  it('keeps named long-format frame keys stable when Grafana reorders frames', () => {
    const queryA = toDataFrame({
      name: 'Query A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [11] },
      ],
    });
    const queryB = toDataFrame({
      name: 'Query B',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [19] },
      ],
    });
    const mapping = { xField: 'Time', yField: 'Value', seriesField: 'Host' };

    const firstModel = buildKChartDataModel([queryA, queryB], 'skip', mapping);
    const reorderedModel = buildKChartDataModel([queryB, queryA], 'skip', mapping);

    expect(firstModel.metrics.map(({ key, displayName }) => ({ key, displayName }))).toEqual(
      reorderedModel.metrics.map(({ key, displayName }) => ({ key, displayName }))
    );
  });

  it('keeps frames with the same refId distinct when their names differ', () => {
    const first = toDataFrame({
      refId: 'A',
      name: 'Primary',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [11] },
      ],
    });
    const second = toDataFrame({
      refId: 'A',
      name: 'Secondary',
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
        { name: 'Value', type: FieldType.number, values: [19] },
      ],
    });

    const model = buildKChartDataModel([first, second], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(model.metrics.map((metric) => metric.key)).toEqual([
      '__series_28_frame-ref-1-A-name-7-Primary_6_api-01',
      '__series_30_frame-ref-1-A-name-9-Secondary_6_api-01',
    ]);
  });

  it('adds a collision suffix when frame identity metadata is identical', () => {
    const makeFrame = (value: number) =>
      toDataFrame({
        refId: 'A',
        name: 'Shared',
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          { name: 'Host', type: FieldType.string, values: ['api-01'] },
          { name: 'Value', type: FieldType.number, values: [value] },
        ],
      });

    const model = buildKChartDataModel([makeFrame(11), makeFrame(19)], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(new Set(model.metrics.map((metric) => metric.key)).size).toBe(2);
    expect(model.metrics.map((metric) => metric.key)).toEqual([
      '__series_38_frame-ref-1-A-name-6-Shared-instance-0_6_api-01',
      '__series_38_frame-ref-1-A-name-6-Shared-instance-1_6_api-01',
    ]);
  });

  it('keeps frame and category tuple boundaries collision-free', () => {
    const makeFrame = (name: string, category: string, value: number) =>
      toDataFrame({
        name,
        fields: [
          { name: 'Time', type: FieldType.time, values: [1000] },
          { name: 'Host', type: FieldType.string, values: [category] },
          { name: 'Value', type: FieldType.number, values: [value] },
        ],
      });

    const model = buildKChartDataModel([makeFrame('A', 'B_C', 11), makeFrame('A_B', 'C', 19)], 'skip', {
      xField: 'Time',
      yField: 'Value',
      seriesField: 'Host',
    });

    expect(new Set(model.metrics.map((metric) => metric.key)).size).toBe(2);
  });

  it('does not allocate row provenance for fields without configured links', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000, 2000] },
        { name: 'Value', type: FieldType.number, values: [11, 19] },
      ],
    });
    frame.fields[1].getLinks = jest.fn(() => []);

    const model = buildKChartDataModel([frame], 'skip');

    expect(model.metrics[0].getLinks).toBeUndefined();
    expect(model.metrics[0].linkRowByX).toBeUndefined();
  });

  it('requires Y and Series mappings to exist in the same frame', () => {
    const yFrame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Value', type: FieldType.number, values: [11] },
      ],
    });
    const seriesFrame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1000] },
        { name: 'Host', type: FieldType.string, values: ['api-01'] },
      ],
    });

    expect(
      buildKChartDataModel([yFrame, seriesFrame], 'skip', {
        xField: 'Time',
        yField: 'Value',
        seriesField: 'Host',
      }).error
    ).toBe('X, Y and Series fields must exist in the same data frame.');
  });

  it('rejects using the same numeric field for X and Y', () => {
    const frame = toDataFrame({
      fields: [{ name: 'Value', type: FieldType.number, values: [11, 12] }],
    });

    expect(
      buildKChartDataModel([frame], 'skip', {
        xField: 'Value',
        yField: 'Value',
      }).error
    ).toBe('X and Y fields must be different.');
  });
});
