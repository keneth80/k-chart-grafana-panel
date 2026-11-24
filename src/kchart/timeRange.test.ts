import { timeRangeFromDomain } from './timeRange';

describe('timeRangeFromDomain', () => {
  it('converts KChart date domains into Grafana epoch ranges', () => {
    expect(timeRangeFromDomain([new Date(1000), new Date(2000)])).toEqual({ from: 1000, to: 2000 });
  });

  it('rejects missing, reversed and non-finite domains', () => {
    expect(timeRangeFromDomain()).toBeUndefined();
    expect(timeRangeFromDomain([2, 1])).toBeUndefined();
    expect(timeRangeFromDomain([0, Number.NaN])).toBeUndefined();
  });
});
