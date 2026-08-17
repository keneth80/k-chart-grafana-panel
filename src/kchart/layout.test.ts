import type { KChartDataModel, KChartPanelPoint } from './dataFrame';
import {
  fitGuideLinesToChartWidth,
  resolveChartLeftMargin,
  resolveColumnRenderData,
  resolveColumnXAxisBounds,
} from './layout';

const model = (xType: KChartDataModel['xType'], values: Array<Date | number>): KChartDataModel => ({
  xType,
  metrics: [],
  data: values.map((value): KChartPanelPoint => ({ __x: value })),
});

describe('KChart panel layout', () => {
  const columnLayout = { plotWidth: 300, segmentCount: 1 };

  it('reserves the rendered group width around time columns at the selected range edges', () => {
    const from = Date.parse('2026-01-01T00:00:00Z');
    const step = 30 * 60 * 1000;
    const to = from + step * 2;

    const bounds = resolveColumnXAxisBounds(
      model('time', [new Date(from), new Date(from + step), new Date(to)]),
      from,
      to,
      columnLayout
    );
    const min = Number(bounds?.min);
    const max = Number(bounds?.max);
    const minimumCenterRatio = 0.76 / (3 * 2);

    expect(min).toBeLessThan(from);
    expect(max).toBeGreaterThan(to);
    expect((from - min) / (max - min)).toBeGreaterThanOrEqual(minimumCenterRatio - 1e-6);
    expect((max - to) / (max - min)).toBeGreaterThanOrEqual(minimumCenterRatio - 1e-6);
  });

  it('keeps an existing empty time-range edge while padding the occupied edge', () => {
    const from = Date.parse('2026-01-01T00:00:00Z');
    const step = 30 * 60 * 1000;
    const to = from + step * 4;

    expect(
      resolveColumnXAxisBounds(
        model('time', [new Date(from + step), new Date(from + step * 2)]),
        from,
        to,
        columnLayout
      )
    ).toEqual({ min: new Date(from), max: new Date(to) });
  });

  it('pads numeric columns and gives a single point a finite visible slot', () => {
    const bounds = resolveColumnXAxisBounds(model('number', [0, 10, 20]), 0, 0, columnLayout);
    const min = Number(bounds?.min);
    const max = Number(bounds?.max);
    expect((0 - min) / (max - min)).toBeGreaterThanOrEqual(0.76 / (3 * 2) - 1e-6);
    expect((max - 20) / (max - min)).toBeGreaterThanOrEqual(0.76 / (3 * 2) - 1e-6);
    expect(resolveColumnXAxisBounds(model('number', [42]), 0, 0, columnLayout)).toEqual({ min: 41.5, max: 42.5 });
  });

  it('accounts for minimum bar widths and gaps in narrow multi-series panels', () => {
    const bounds = resolveColumnXAxisBounds(model('number', [0, 10, 20]), 0, 0, {
      plotWidth: 48,
      segmentCount: 8,
    });
    const min = Number(bounds?.min);
    const max = Number(bounds?.max);
    const nominalGroupWidth = (48 / 3) * 0.76;
    const actualGroupWidth = 2 * 8 + 2 * 7;
    expect(((0 - min) / (max - min)) * 48).toBeGreaterThanOrEqual(nominalGroupWidth / 2 - 1e-3);
    expect(((max - 20) / (max - min)) * 48).toBeGreaterThanOrEqual(
      actualGroupWidth - nominalGroupWidth / 2 - 1e-3
    );
  });

  it('ignores datasource samples outside the selected Grafana time range', () => {
    const from = Date.parse('2026-01-01T00:00:00Z');
    const to = from + 60 * 60 * 1000;
    const bounds = resolveColumnXAxisBounds(
      model('time', [new Date(from - 1000), new Date(from + 30 * 60 * 1000), new Date(to + 1000)]),
      from,
      to,
      columnLayout
    );
    expect(bounds).toEqual({ min: new Date(from), max: new Date(to) });
    const points = model('time', [new Date(from - 1000), new Date(from + 30 * 60 * 1000), new Date(to + 1000)]).data;
    expect(resolveColumnRenderData(points, 'time', from, to).map((point) => point.__x)).toEqual([
      new Date(from + 30 * 60 * 1000),
    ]);
  });

  it('reserves enough left margin for the complete threshold label', () => {
    expect(resolveChartLeftMargin(undefined, [], 400)).toBe(64);
    expect(resolveChartLeftMargin('Price', [], 400)).toBe(76);
    expect(resolveChartLeftMargin(undefined, [{ value: 115, label: 'Open ≥ 115.0' }], 400)).toBe(114);
  });

  it('keeps a usable plot area for very narrow panels and wide labels', () => {
    const guides = [{ value: 115, label: '대한민국 Wide Threshold ≥ 115.0' }];
    const fitted = fitGuideLinesToChartWidth(guides, 140);
    expect(fitted[0].label).toBe('≥115.0');
    expect(resolveChartLeftMargin(undefined, fitted, 140)).toBe(72);
    expect(resolveChartLeftMargin(undefined, guides, 400)).toBeGreaterThan(114);
  });
});
