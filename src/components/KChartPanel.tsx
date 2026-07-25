import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { GrafanaTheme2, PanelProps, TimeRange } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';
import {
  createCanvasLineSeries,
  createKChart,
  createLineSeries,
  createWebglLineSeries,
  type KChartAxis,
  type KChartController,
  type KChartSeries,
  type KChartSeriesTooltipContext,
} from '@keneth80/k-chart';
import {
  buildKChartDataModel,
  type KChartDataModel,
  type KChartMetric,
  type KChartPanelPoint,
} from '../kchart/dataFrame';
import type { KChartPanelOptions } from '../types';

interface Props extends PanelProps<KChartPanelOptions> {}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    position: relative;
    overflow: hidden;
    color: ${theme.colors.text.primary};
    font-family: ${theme.typography.fontFamily};

    .kchart-svg {
      display: block;
      overflow: visible;
    }

    .kchart-axis text,
    .kchart-axis-title,
    .kchart-legend text {
      fill: ${theme.colors.text.secondary};
      font-family: ${theme.typography.fontFamily};
      font-size: 12px;
    }

    .kchart-axis path,
    .kchart-axis line {
      stroke: ${theme.colors.border.medium};
    }

    .kchart-grid line {
      stroke: ${theme.colors.border.weak};
      stroke-opacity: 0.55;
    }

    .kchart-tooltip {
      position: absolute;
      z-index: 10;
      pointer-events: none;
      padding: 8px 10px;
      color: ${theme.colors.text.primary};
      background: ${theme.colors.background.primary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: 4px;
      box-shadow: ${theme.shadows.z2};
      font-size: 12px;
    }
  `,
  empty: css`
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: ${theme.colors.text.secondary};
  `,
});

const palette = ['blue', 'green', 'orange', 'red', 'purple', 'yellow', 'light-blue', 'semi-dark-green'];

const seriesColor = (metric: KChartMetric, index: number, theme: GrafanaTheme2): string =>
  theme.visualization.getColorByName(metric.color ?? palette[index % palette.length]);

const comparableX = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

const indexedTooltip =
  (metric: KChartMetric) =>
  (context: KChartSeriesTooltipContext<KChartPanelPoint>) => {
    const xScale = context.scales.find((scale) => scale.field === '__x')?.scale;
    const yScale = (
      context.scales.find((scale) => scale.field === metric.key) ??
      context.scales.find((scale) => scale.placement === 'left' || scale.placement === 'right')
    )?.scale;
    if (!xScale || !yScale || typeof xScale.invert !== 'function' || context.data.length === 0) {
      return undefined;
    }

    const inverted = xScale.invert(context.mouseX) as Date | number;
    const target = comparableX(inverted);
    let low = 0;
    let high = context.data.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (comparableX(context.data[middle].__x) < target) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    let nearest:
      | {
          data: KChartPanelPoint;
          x: number;
          y: number;
          distance: number;
        }
      | undefined;
    const start = Math.max(0, low - 2);
    const end = Math.min(context.data.length - 1, low + 2);
    for (let index = start; index <= end; index += 1) {
      const point = context.data[index];
      const value = point[metric.key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }
      const x = Number(xScale(point.__x));
      const y = Number(yScale(value));
      const distance = Math.hypot(x - context.mouseX, y - context.mouseY);
      if (!nearest || distance < nearest.distance) {
        nearest = { data: point, x, y, distance };
      }
    }

    return nearest
      ? {
          ...nearest,
          color: context.color,
        }
      : undefined;
  };

const createSeries = (
  metric: KChartMetric,
  index: number,
  options: KChartPanelOptions,
  theme: GrafanaTheme2
): KChartSeries<KChartPanelPoint> => {
  const common = {
    selector: `kchart-grafana-series-${index}`,
    displayName: metric.displayName,
    xField: '__x' as const,
    yField: metric.key,
    color: seriesColor(metric, index, theme),
    downsample: options.downsample,
  };

  let series: KChartSeries<KChartPanelPoint>;
  if (options.renderer === 'canvas') {
    series = createCanvasLineSeries<KChartPanelPoint>({
      ...common,
      lineWidth: options.lineWidth,
    });
  } else if (options.renderer === 'webgl') {
    series = createWebglLineSeries<KChartPanelPoint>({
      ...common,
      lineWidth: options.lineWidth,
    });
  } else {
    series = createLineSeries<KChartPanelPoint>({
      ...common,
      curve: options.curve,
      strokeWidth: options.lineWidth,
    });
  }

  return {
    ...series,
    tooltip: indexedTooltip(metric),
  };
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const tooltipValue = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : String(value ?? '');

const createAxes = (
  model: KChartDataModel,
  width: number,
  height: number,
  timeRange: TimeRange
): Array<KChartAxis<KChartPanelPoint>> => [
  {
    field: '__x',
    type: model.xType === 'time' ? 'time' : 'number',
    placement: 'bottom',
    min: model.xType === 'time' ? new Date(timeRange.from.valueOf()) : undefined,
    max: model.xType === 'time' ? new Date(timeRange.to.valueOf()) : undefined,
    tickCount: Math.max(2, Math.floor(width / 110)),
  },
  {
    field: model.metrics[0].key,
    domainFields: model.metrics.map((metric) => metric.key),
    type: 'number',
    placement: 'left',
    tickCount: Math.max(2, Math.floor(height / 70)),
  },
];

export const KChartPanel: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  timeRange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<KChartController<KChartPanelPoint> | null>(null);
  const renderedDataRef = useRef<KChartPanelPoint[] | null>(null);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const model = useMemo(
    () => buildKChartDataModel(data.series, options.nullMode),
    [data.series, options.nullMode]
  );
  const renderContextRef = useRef({ model, options, theme, width, height, timeRange });
  const renderedSizeRef = useRef({ width, height });
  const xTickCount = Math.max(2, Math.floor(width / 110));
  const yTickCount = Math.max(2, Math.floor(height / 70));
  const timeRangeFrom = timeRange.from.valueOf();
  const timeRangeTo = timeRange.to.valueOf();

  useLayoutEffect(() => {
    renderContextRef.current = { model, options, theme, width, height, timeRange };
  });

  const structureKey = useMemo(
    () =>
      JSON.stringify({
        renderer: options.renderer,
        curve: options.curve,
        lineWidth: options.lineWidth,
        downsample: options.downsample,
        showLegend: options.showLegend,
        showGrid: options.showGrid,
        showTooltip: options.showTooltip,
        animation: options.animation,
        xType: model.xType,
        metrics: model.metrics,
        theme: theme.isDark,
        xTickCount,
        yTickCount,
        timeRangeFrom,
        timeRangeTo,
      }),
    [
      model.metrics,
      model.xType,
      options.animation,
      options.curve,
      options.downsample,
      options.lineWidth,
      options.renderer,
      options.showGrid,
      options.showLegend,
      options.showTooltip,
      theme.isDark,
      xTickCount,
      yTickCount,
      timeRangeFrom,
      timeRangeTo,
    ]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const context = renderContextRef.current;
    if (!container || context.model.metrics.length === 0) {
      return undefined;
    }

    const series = context.model.metrics.map((metric, index) =>
      createSeries(metric, index, context.options, context.theme)
    );
    const controller = createKChart<KChartPanelPoint>({
      selector: container,
      data: context.model.data,
      width: context.width,
      height: context.height,
      margin: {
        top: context.options.showLegend ? 54 : 20,
        right: 24,
        bottom: 48,
        left: 64,
      },
      axes: createAxes(context.model, context.width, context.height, context.timeRange),
      series,
      grid: {
        visible: context.options.showGrid,
        x: false,
        y: context.options.showGrid,
      },
      legend: {
        visible: context.options.showLegend,
        placement: 'top',
        selectable: true,
      },
      tooltip: {
        visible: context.options.showTooltip,
        formatter: ({ series: tooltipSeries, x, y, color }) =>
          `<strong style="color:${escapeHtml(color)}">${escapeHtml(
            tooltipSeries.displayName ?? tooltipSeries.selector
          )}</strong><br/>x: ${escapeHtml(tooltipValue(x))}<br/>y: ${escapeHtml(tooltipValue(y))}`,
      },
      animation: context.options.animation,
      className: context.theme.isDark ? 'kchart-theme-dark' : 'kchart-theme-light',
    }).render();

    controllerRef.current = controller;
    renderedDataRef.current = context.model.data;
    renderedSizeRef.current = { width: context.width, height: context.height };

    return () => {
      controller.destroy();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [structureKey]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || renderedDataRef.current === model.data) {
      return;
    }
    renderedDataRef.current = model.data;
    controller.updateData(model.data);
  }, [model.data]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (
      !controller ||
      (renderedSizeRef.current.width === width && renderedSizeRef.current.height === height)
    ) {
      return;
    }
    renderedSizeRef.current = { width, height };
    controller.resize({ width, height });
  }, [height, width]);

  if (data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} />;
  }

  if (model.metrics.length === 0) {
    return <div className={styles.empty}>Add at least one numeric field to render a KChart line.</div>;
  }

  return (
    <div
      ref={containerRef}
      data-testid="kchart-panel"
      className={styles.wrapper}
      style={{ width, height }}
    />
  );
};
