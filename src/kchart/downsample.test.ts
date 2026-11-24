import { resolveDownsampleOptions } from './downsample';

describe('resolveDownsampleOptions', () => {
  it('keeps downsampling disabled unless the panel option is enabled', () => {
    expect(resolveDownsampleOptions(false, 'min-max', 8)).toBe(false);
  });

  it('preserves legacy boolean downsampling as LTTB when no strategy was saved', () => {
    expect(resolveDownsampleOptions(true)).toEqual({ strategy: 'lttb', pointsPerPixel: 4 });
  });

  it('uses automatic pixel-column downsampling when auto is explicitly selected', () => {
    expect(resolveDownsampleOptions(true, 'auto')).toEqual({ strategy: 'auto', pointsPerPixel: 4 });
  });

  it('preserves explicit strategies and bounds the density threshold', () => {
    expect(resolveDownsampleOptions(true, 'lttb', 0)).toEqual({ strategy: 'lttb', pointsPerPixel: 1 });
    expect(resolveDownsampleOptions(true, 'min-max', 20)).toEqual({ strategy: 'min-max', pointsPerPixel: 16 });
  });

  it.each(['scatter', 'candlestick', 'column'] as const)('never downsamples %s series', (chartType) => {
    expect(resolveDownsampleOptions(true, 'auto', 4, chartType)).toBe(false);
  });

  it.each(['line', 'area'] as const)('allows downsampling for %s series', (chartType) => {
    expect(resolveDownsampleOptions(true, 'auto', 4, chartType)).toEqual({
      strategy: 'auto',
      pointsPerPixel: 4,
    });
  });
});
