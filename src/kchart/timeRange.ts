import type { AbsoluteTimeRange } from '@grafana/data';

const domainValue = (value: number | Date): number => (value instanceof Date ? value.getTime() : Number(value));

export const timeRangeFromDomain = (domain?: Array<number | Date>): AbsoluteTimeRange | undefined => {
  if (!domain || domain.length < 2) {
    return undefined;
  }

  const from = domainValue(domain[0]);
  const to = domainValue(domain[domain.length - 1]);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return undefined;
  }
  return { from, to };
};
