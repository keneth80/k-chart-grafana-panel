import type { Field, FieldConfig, LinkModel } from '@grafana/data';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { KChartMetric, KChartPanelPoint } from './dataFrame';

export interface KChartDataLinkTarget {
  metricKey: string;
  data: KChartPanelPoint;
}

export interface KChartResolvedDataLinks {
  config: FieldConfig;
  links: Array<LinkModel<Field>>;
  metric?: KChartMetric;
}

export interface KChartDataLinkMenuTriggerProps {
  role: 'button';
  tabIndex: 0;
  'aria-haspopup': 'menu';
  onClick: (event: ReactMouseEvent<Element>) => void;
  onKeyDown: (event: ReactKeyboardEvent<Element>) => void;
}

interface KChartDataLinkMenuApi {
  openMenu?: (event: ReactMouseEvent<Element>) => void;
  triggerProps?: KChartDataLinkMenuTriggerProps;
}

export const resolveDataLinkMenuTriggerProps = ({
  openMenu,
  triggerProps,
}: KChartDataLinkMenuApi): KChartDataLinkMenuTriggerProps | undefined => {
  if (triggerProps || !openMenu) {
    return triggerProps;
  }

  // Grafana 12.3 exposes openMenu directly; Grafana 13 adds ready-made
  // triggerProps. Keep one focusable trigger working across both APIs.
  return {
    role: 'button',
    tabIndex: 0,
    'aria-haspopup': 'menu',
    onClick: (event) => openMenu(event),
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        (event.currentTarget as HTMLElement).click();
      }
    },
  };
};

export const pointXKey = (point: KChartPanelPoint): number =>
  point.__x instanceof Date ? point.__x.getTime() : point.__x;

export const dataLinkTargetKey = (target: KChartDataLinkTarget): string =>
  `${target.metricKey}:${pointXKey(target.data)}`;

export const resolveDataLinks = (
  metrics: KChartMetric[],
  target: KChartDataLinkTarget | undefined
): KChartResolvedDataLinks => {
  if (!target) {
    return { config: {}, links: [] };
  }

  const metric = metrics.find((item) => item.key === target.metricKey);
  const rowIndex = metric?.linkRowByX?.get(pointXKey(target.data));
  if (!metric?.getLinks || rowIndex === undefined) {
    return { config: metric?.linkConfig ?? {}, links: [], metric };
  }

  try {
    return {
      config: metric.linkConfig ?? {},
      links: metric.getLinks({ valueRowIndex: rowIndex }) ?? [],
      metric,
    };
  } catch {
    // A malformed user-defined link should not break chart rendering.
    return { config: metric.linkConfig ?? {}, links: [], metric };
  }
};
