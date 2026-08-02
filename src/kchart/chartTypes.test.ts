import type { KChartMetric } from './dataFrame';
import { resolveCandlestickMetrics } from './chartTypes';

const metric = (fieldName: string, displayName = fieldName): KChartMetric => ({
  key: `__${fieldName}`,
  fieldName,
  displayName,
});

describe('resolveCandlestickMetrics', () => {
  it('maps conventional English OHLC field names', () => {
    const resolved = resolveCandlestickMetrics([metric('Open'), metric('High'), metric('Low'), metric('Close')]);

    expect(resolved).toEqual({
      open: expect.objectContaining({ fieldName: 'Open' }),
      high: expect.objectContaining({ fieldName: 'High' }),
      low: expect.objectContaining({ fieldName: 'Low' }),
      close: expect.objectContaining({ fieldName: 'Close' }),
    });
  });

  it('recognizes Korean OHLC aliases and Grafana display-name prefixes', () => {
    const resolved = resolveCandlestickMetrics([
      metric('value_1', '주가 시가'),
      metric('value_2', '주가 고가'),
      metric('value_3', '주가 저가'),
      metric('value_4', '주가 종가'),
    ]);

    expect(resolved?.open.displayName).toBe('주가 시가');
    expect(resolved?.close.displayName).toBe('주가 종가');
  });

  it('returns undefined when any required OHLC field is missing', () => {
    expect(resolveCandlestickMetrics([metric('Open'), metric('High'), metric('Close')])).toBeUndefined();
  });

  it('does not match role names embedded inside unrelated words', () => {
    expect(
      resolveCandlestickMetrics([metric('Reopen'), metric('Highlight'), metric('Below'), metric('Disclosure')])
    ).toBeUndefined();
  });

  it('uses explicit OHLC field mappings before name detection', () => {
    const resolved = resolveCandlestickMetrics([metric('a'), metric('b'), metric('c'), metric('d')], {
      openField: 'a',
      highField: 'b',
      lowField: 'c',
      closeField: 'd',
    });

    expect(resolved).toEqual({
      open: expect.objectContaining({ fieldName: 'a' }),
      high: expect.objectContaining({ fieldName: 'b' }),
      low: expect.objectContaining({ fieldName: 'c' }),
      close: expect.objectContaining({ fieldName: 'd' }),
    });
  });

  it('allows explicit and automatic OHLC mapping to be mixed', () => {
    const resolved = resolveCandlestickMetrics([metric('price_a'), metric('High'), metric('Low'), metric('Close')], {
      openField: 'price_a',
    });

    expect(resolved?.open.fieldName).toBe('price_a');
    expect(resolved?.close.fieldName).toBe('Close');
  });
});
