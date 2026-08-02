import type { Field, LinkModel } from '@grafana/data';
import type { KChartMetric, KChartPanelPoint } from './dataFrame';
import { dataLinkTargetKey, pointXKey, resolveDataLinkMenuTriggerProps, resolveDataLinks } from './dataLinks';

const point = (x: number | Date): KChartPanelPoint => ({ __x: x, __kchart_baseline: 0, __metric_0: 42 });

const metric = (getLinks?: Field['getLinks']): KChartMetric => ({
  key: '__metric_0',
  fieldName: 'Value',
  displayName: 'Value',
  linkConfig: { links: [{ title: 'Details', url: '/details/${__value.raw}' }] },
  getLinks,
  linkRowByX: new Map([[1_000, 3]]),
});

describe('Grafana data link adapter', () => {
  it('normalizes numeric and Date X values to stable lookup keys', () => {
    expect(pointXKey(point(1_000))).toBe(1_000);
    expect(pointXKey(point(new Date(1_000)))).toBe(1_000);
    expect(dataLinkTargetKey({ metricKey: '__metric_0', data: point(new Date(1_000)) })).toBe('__metric_0:1000');
  });

  it('resolves links with the original Grafana row index', () => {
    const link: LinkModel<Field> = {
      href: '/details/42?var-service=checkout',
      title: 'Details',
      target: '_self',
      origin: {} as Field,
    };
    const getLinks = jest.fn(() => [link]);
    const resolvedMetric = metric(getLinks);

    expect(
      resolveDataLinks([resolvedMetric], { metricKey: resolvedMetric.key, data: point(new Date(1_000)) }).links
    ).toEqual([link]);
    expect(getLinks).toHaveBeenCalledWith({ valueRowIndex: 3 });
  });

  it('returns no links when the point cannot be mapped to a source row', () => {
    const resolvedMetric = metric(jest.fn(() => []));
    expect(resolveDataLinks([resolvedMetric], { metricKey: resolvedMetric.key, data: point(2_000) }).links).toEqual([]);
  });

  it('isolates malformed user link suppliers', () => {
    const resolvedMetric = metric(() => {
      throw new Error('invalid link');
    });
    expect(resolveDataLinks([resolvedMetric], { metricKey: resolvedMetric.key, data: point(1_000) }).links).toEqual([]);
  });

  it('uses Grafana 13 trigger props when they are available', () => {
    const triggerProps = {
      role: 'button' as const,
      tabIndex: 0 as const,
      'aria-haspopup': 'menu' as const,
      onClick: jest.fn(),
      onKeyDown: jest.fn(),
    };

    expect(resolveDataLinkMenuTriggerProps({ triggerProps, openMenu: jest.fn() })).toBe(triggerProps);
  });

  it('adapts the Grafana 12.3 openMenu API to a clickable trigger', () => {
    const openMenu = jest.fn();
    const triggerProps = resolveDataLinkMenuTriggerProps({ openMenu });
    const clickEvent = {} as React.MouseEvent<Element>;
    triggerProps?.onClick(clickEvent);
    expect(openMenu).toHaveBeenCalledWith(clickEvent);

    const element = document.createElement('span');
    const click = jest.spyOn(element, 'click');
    const preventDefault = jest.fn();
    triggerProps?.onKeyDown({
      key: 'Enter',
      currentTarget: element,
      preventDefault,
    } as unknown as React.KeyboardEvent<Element>);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
