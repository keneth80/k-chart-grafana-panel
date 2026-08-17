import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GrafanaTheme2, LoadingState, PanelProps, TimeRange } from '@grafana/data';
import type { TimeZone } from '@grafana/schema';
import { PanelDataErrorView } from '@grafana/runtime';
import {
  Alert,
  Button,
  DataLinksContextMenu,
  ErrorBoundaryAlert,
  LoadingPlaceholder,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { css } from '@emotion/css';
import { createKChart } from '@keneth80/k-chart/core/create-kchart';
import type {
  KChartAxis,
  KChartController,
  KChartSeries,
  KChartSeriesTooltipContext,
} from '@keneth80/k-chart/core/contracts';
import { createCanvasCandlestickSeries } from '@keneth80/k-chart/series/canvas-candlestick';
import { createCanvasLineSeries } from '@keneth80/k-chart/series/canvas-line';
import { createCanvasPointSeries } from '@keneth80/k-chart/series/canvas-point';
import { createAreaSeries } from '@keneth80/k-chart/series/svg-area';
import { createGroupedColumnSeries } from '@keneth80/k-chart/series/svg-bar';
import { createLineSeries } from '@keneth80/k-chart/series/svg-line';
import { createScatterSeries } from '@keneth80/k-chart/series/svg-scatter';
import { createWebglLineSeries } from '@keneth80/k-chart/series/webgl-line';
import { createWebglPointSeries } from '@keneth80/k-chart/series/webgl-point';
import {
  candlestickFieldError,
  resolveCandlestickMetrics,
  type KChartCandlestickFieldMapping,
} from '../kchart/chartTypes';
import {
  buildKChartDataModel,
  KCHART_BASELINE_FIELD,
  type KChartDataModel,
  type KChartMetric,
  type KChartPanelPoint,
} from '../kchart/dataFrame';
import {
  dataLinkTargetKey,
  resolveDataLinkMenuTriggerProps,
  resolveDataLinks,
  type KChartDataLinkTarget,
} from '../kchart/dataLinks';
import {
  formatConfiguredValue,
  formatXAxisValue,
  resolveAxisBounds,
  resolveMetricColorValue,
  resolveThresholdGuideLines,
  sharedYAxisWarning,
} from '../kchart/fieldConfig';
import {
  KCHART_COLUMN_GAP,
  KCHART_COLUMN_GROUP_WIDTH_RATIO,
  fitGuideLinesToChartWidth,
  resolveChartLeftMargin,
  resolveColumnRenderData,
  resolveColumnXAxisBounds,
} from '../kchart/layout';
import {
  assertWebglRenderSurface,
  readableError,
  renderWithRendererFallback,
  supportsWebglFallback,
  type KChartRenderPhase,
} from '../kchart/renderRecovery';
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
  state: css`
    display: grid;
    width: 100%;
    height: 100%;
    padding: ${theme.spacing(2)};
    place-items: center;

    > * {
      width: min(520px, 100%);
    }
  `,
  chart: css`
    position: absolute;
    inset: 0;
  `,
  warning: css`
    position: absolute;
    z-index: 8;
    top: 6px;
    right: 8px;
    max-width: min(420px, calc(100% - 16px));
    padding: 4px 8px;
    color: ${theme.colors.warning.text};
    background: ${theme.colors.warning.transparent};
    border: 1px solid ${theme.colors.warning.border};
    border-radius: 4px;
    font-size: 11px;
    pointer-events: none;
  `,
  fallback: css`
    position: absolute;
    z-index: 8;
    top: 6px;
    left: 8px;
    max-width: min(420px, calc(100% - 16px));
    padding: 4px 8px;
    color: ${theme.colors.warning.text};
    background: ${theme.colors.warning.transparent};
    border: 1px solid ${theme.colors.warning.border};
    border-radius: 4px;
    font-size: 11px;
  `,
  loading: css`
    position: absolute;
    z-index: 8;
    top: 8px;
    left: 8px;
    padding: 4px 8px;
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 4px;
    font-size: 11px;

    > div {
      margin: 0;
    }
  `,
  runtimeError: css`
    position: absolute;
    z-index: 12;
    inset: 0;
    display: grid;
    padding: ${theme.spacing(2)};
    place-items: center;
    background: ${theme.colors.background.canvas};

    > * {
      width: min(560px, 100%);
    }
  `,
  dataLink: css`
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 4px 9px;
    color: ${theme.colors.text.primary};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 4px;
    box-shadow: ${theme.shadows.z2};
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  `,
  dataLinkPosition: css`
    position: absolute;
    z-index: 9;
    right: 8px;
    bottom: 8px;
  `,
});

const palette = ['blue', 'green', 'orange', 'red', 'purple', 'yellow', 'light-blue', 'semi-dark-green'];

const seriesColor = (metric: KChartMetric, index: number, theme: GrafanaTheme2, data: KChartPanelPoint[]): string => {
  if (metric.colorMode === 'fixed' && metric.color) {
    return theme.visualization.getColorByName(metric.color);
  }

  // Grafana's display processor resolves both palette and by-value modes. Passing
  // the configured series statistic also keeps threshold/continuous modes correct.
  const colorValue = resolveMetricColorValue(data, metric) ?? 0;
  let displayColor: string | undefined;
  try {
    displayColor = metric.display?.(colorValue)?.color;
  } catch {
    // A third-party display processor must not prevent the panel from rendering.
  }
  return theme.visualization.getColorByName(displayColor ?? metric.color ?? palette[index % palette.length]);
};

const comparableX = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

const indexedTooltip = (metric: KChartMetric) => (context: KChartSeriesTooltipContext<KChartPanelPoint>) => {
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

type TooltipTargetHandler = (metric: KChartMetric, data: KChartPanelPoint) => void;

const createMetricSeries = (
  metric: KChartMetric,
  index: number,
  options: KChartPanelOptions,
  theme: GrafanaTheme2,
  data: KChartPanelPoint[]
): KChartSeries<KChartPanelPoint> => {
  const chartType = options.chartType ?? 'line';
  const common = {
    selector: `kchart-grafana-series-${index}`,
    displayName: metric.displayName,
    xField: '__x' as const,
    yField: metric.key,
    color: seriesColor(metric, index, theme, data),
    downsample: options.downsample,
  };

  let series: KChartSeries<KChartPanelPoint>;
  if (chartType === 'area') {
    series = createAreaSeries<KChartPanelPoint>({
      ...common,
      curve: options.curve,
      fillOpacity: 0.16,
      strokeWidth: options.lineWidth,
    });
  } else if (chartType === 'scatter' && options.renderer === 'canvas') {
    series = createCanvasPointSeries<KChartPanelPoint>({
      ...common,
      radius: 3.5,
    });
  } else if (chartType === 'scatter' && options.renderer === 'webgl') {
    series = createWebglPointSeries<KChartPanelPoint>({
      ...common,
      pointSize: 7,
    });
  } else if (chartType === 'scatter') {
    series = createScatterSeries<KChartPanelPoint>({
      ...common,
      radius: 3.5,
      stroke: theme.colors.background.primary,
      strokeWidth: 1,
    });
  } else if (options.renderer === 'canvas') {
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

const createChartSeries = (
  model: KChartDataModel,
  options: KChartPanelOptions,
  theme: GrafanaTheme2,
  timeZone: TimeZone,
  onTooltipTarget: TooltipTargetHandler
): Array<KChartSeries<KChartPanelPoint>> => {
  const chartType = options.chartType ?? 'line';

  if (chartType === 'column') {
    const segments = model.metrics.map((metric, index) => ({
      field: metric.key,
      // The invisible separator keeps duplicate Grafana display names addressable.
      label: `${metric.displayName}\u2063${index}`,
      color: seriesColor(metric, index, theme, model.data),
    }));
    const grouped = createGroupedColumnSeries<KChartPanelPoint>({
      selector: 'kchart-grafana-columns',
      displayName: 'Values',
      xField: '__x',
      segments,
      groupWidthRatio: KCHART_COLUMN_GROUP_WIDTH_RATIO,
      gap: KCHART_COLUMN_GAP,
      radius: 2,
    });
    const groupedTooltip = grouped.tooltip;
    return [
      {
        ...grouped,
        tooltip: (context) => {
          const hit = groupedTooltip?.(context);
          if (!hit) {
            return hit;
          }
          const metricIndex = segments.findIndex((segment) =>
            hit.html?.startsWith(`<strong>${segment.label}</strong>`)
          );
          const metric = model.metrics[metricIndex];
          if (!metric) {
            return hit;
          }
          onTooltipTarget(metric, hit.data);
          return {
            ...hit,
            html: `<strong style="color:${escapeHtml(hit.color)}">${escapeHtml(metric.displayName)}</strong><br/>x: ${escapeHtml(
              formatXAxisValue(hit.data.__x, options.xAxisFormat ?? 'auto', model.xField, timeZone, model.xType)
            )}<br/>y: ${escapeHtml(formatConfiguredValue(metric, hit.data[metric.key]))}`,
          };
        },
      },
    ];
  }

  if (chartType === 'candlestick') {
    const metrics = resolveCandlestickMetrics(model.metrics, {
      openField: options.openField,
      highField: options.highField,
      lowField: options.lowField,
      closeField: options.closeField,
    });
    if (!metrics) {
      return [];
    }

    const candlestick = createCanvasCandlestickSeries<KChartPanelPoint>({
      selector: 'kchart-grafana-candlestick',
      displayName: 'OHLC',
      xField: '__x',
      openField: metrics.open.key,
      highField: metrics.high.key,
      lowField: metrics.low.key,
      closeField: metrics.close.key,
      colorMode: 'open-close',
      upColor: theme.visualization.getColorByName('green'),
      downColor: theme.visualization.getColorByName('red'),
      neutralColor: theme.colors.text.secondary,
      wickColor: theme.colors.text.secondary,
      borderColor: theme.colors.border.strong,
      minCandleWidth: 3,
      maxCandleWidth: 22,
    });
    const candlestickTooltip = candlestick.tooltip;
    return [
      {
        ...candlestick,
        tooltip: (context) => {
          const hit = candlestickTooltip?.(context);
          if (!hit) {
            return hit;
          }
          onTooltipTarget(metrics.close, hit.data);
          return {
            ...hit,
            html: [
              `<strong style="color:${escapeHtml(hit.color)}">OHLC</strong>`,
              `x: ${escapeHtml(
                formatXAxisValue(hit.data.__x, options.xAxisFormat ?? 'auto', model.xField, timeZone, model.xType)
              )}`,
              `open: ${escapeHtml(formatConfiguredValue(metrics.open, hit.data[metrics.open.key]))}`,
              `high: ${escapeHtml(formatConfiguredValue(metrics.high, hit.data[metrics.high.key]))}`,
              `low: ${escapeHtml(formatConfiguredValue(metrics.low, hit.data[metrics.low.key]))}`,
              `close: ${escapeHtml(formatConfiguredValue(metrics.close, hit.data[metrics.close.key]))}`,
            ].join('<br/>'),
          };
        },
      },
    ];
  }

  return model.metrics.map((metric, index) => createMetricSeries(metric, index, options, theme, model.data));
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const createAxes = (
  model: KChartDataModel,
  domainMetrics: KChartMetric[],
  chartType: KChartPanelOptions['chartType'],
  width: number,
  height: number,
  timeRange: TimeRange,
  timeZone: TimeZone,
  options: KChartPanelOptions,
  leftMargin: number
): Array<KChartAxis<KChartPanelPoint>> => {
  const bounds = resolveAxisBounds(domainMetrics);
  const xAxisFormat = options.xAxisFormat ?? 'auto';
  const xTickFormat = (value: unknown) => formatXAxisValue(value, xAxisFormat, model.xField, timeZone, model.xType);
  const columnBounds =
    chartType === 'column'
      ? resolveColumnXAxisBounds(model, timeRange.from.valueOf(), timeRange.to.valueOf(), {
          plotWidth: Math.max(1, width - leftMargin - 24),
          segmentCount: domainMetrics.length,
        })
      : undefined;

  return [
    {
      field: '__x',
      type: model.xType === 'time' ? 'time' : 'number',
      placement: 'bottom',
      min: columnBounds?.min ?? (model.xType === 'time' ? new Date(timeRange.from.valueOf()) : undefined),
      max: columnBounds?.max ?? (model.xType === 'time' ? new Date(timeRange.to.valueOf()) : undefined),
      tickCount: Math.max(2, Math.floor(width / 110)),
      tickFormat: xTickFormat,
      title: options.xAxisTitle?.trim() || undefined,
    },
    {
      field: domainMetrics[0].key,
      domainFields:
        chartType === 'column'
          ? [...domainMetrics.map((metric) => metric.key), KCHART_BASELINE_FIELD]
          : domainMetrics.map((metric) => metric.key),
      type: 'number',
      placement: 'left',
      tickCount: Math.max(2, Math.floor(height / 70)),
      min: bounds.min,
      max: bounds.max,
      tickFormat: (value: unknown) => formatConfiguredValue(domainMetrics[0], value),
      title: options.yAxisTitle?.trim() || undefined,
    },
  ];
};

const candlestickMapping = (options: KChartPanelOptions): KChartCandlestickFieldMapping => ({
  openField: options.openField,
  highField: options.highField,
  lowField: options.lowField,
  closeField: options.closeField,
});

interface RuntimeIssue {
  phase: KChartRenderPhase;
  message: string;
}

const runtimeIssueMessage = (phase: KChartRenderPhase): string => {
  if (phase === 'update') {
    return 'KChart could not apply the latest data. Retry the render or choose another renderer.';
  }
  if (phase === 'resize') {
    return 'KChart could not resize this panel. Retry after the panel size is stable.';
  }
  return 'KChart could not render this panel. Retry or choose another renderer.';
};

const logRuntimeError = (phase: KChartRenderPhase | 'react', renderer: string, error: unknown): void => {
  console.error('[KChart Panel] rendering failure', {
    phase,
    renderer,
    message: readableError(error),
    error,
  });
};

const KChartPanelContent: React.FC<Props> = ({
  options,
  data,
  width,
  height,
  fieldConfig,
  id,
  timeRange,
  timeZone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<KChartController<KChartPanelPoint> | null>(null);
  const renderedDataRef = useRef<KChartPanelPoint[] | null>(null);
  const activeRendererRef = useRef(options.renderer);
  const recoveringRef = useRef(false);
  const rendererOverrideRef = useRef<KChartPanelOptions['renderer']>();
  const rendererSelectionKeyRef = useRef(`${options.chartType ?? 'line'}:${options.renderer}`);
  const activeDataLinkKeyRef = useRef<string>();
  const [dataLinkTarget, setDataLinkTarget] = useState<KChartDataLinkTarget>();
  const [activeRenderer, setActiveRenderer] = useState(options.renderer);
  const [fallbackNotice, setFallbackNotice] = useState<string>();
  const [runtimeIssue, setRuntimeIssue] = useState<RuntimeIssue>();
  const [retryGeneration, setRetryGeneration] = useState(0);
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const chartType = options.chartType ?? 'line';
  const rendererSelectionKey = `${chartType}:${options.renderer}`;
  const model = useMemo(() => {
    // Grafana may update field overrides without replacing data.series.
    void fieldConfig;
    return buildKChartDataModel(data.series, options.nullMode, {
      xField: options.xField,
      yField: chartType === 'candlestick' ? undefined : options.yField,
      seriesField: chartType === 'candlestick' ? undefined : options.seriesField,
    });
  }, [chartType, data.series, fieldConfig, options.nullMode, options.seriesField, options.xField, options.yField]);
  const renderModel = useMemo(() => {
    if (chartType !== 'column') {
      return model;
    }
    const renderData = resolveColumnRenderData(
      model.data,
      model.xType,
      timeRange.from.valueOf(),
      timeRange.to.valueOf()
    );
    return renderData === model.data ? model : { ...model, data: renderData };
  }, [chartType, model, timeRange]);
  const candlestickMetrics = useMemo(
    () =>
      chartType === 'candlestick'
        ? resolveCandlestickMetrics(model.metrics, {
            openField: options.openField,
            highField: options.highField,
            lowField: options.lowField,
            closeField: options.closeField,
          })
        : undefined,
    [chartType, model.metrics, options.closeField, options.highField, options.lowField, options.openField]
  );
  const chartError =
    model.error ?? (chartType === 'candlestick' && !candlestickMetrics ? candlestickFieldError : undefined);
  const axisWarning = sharedYAxisWarning(model.metrics);
  const handleTooltipTarget = useCallback<TooltipTargetHandler>((metric, point) => {
    if (!metric.getLinks) {
      activeDataLinkKeyRef.current = undefined;
      setDataLinkTarget(undefined);
      return;
    }
    const target = { metricKey: metric.key, data: point };
    const targetKey = dataLinkTargetKey(target);
    if (activeDataLinkKeyRef.current !== targetKey) {
      activeDataLinkKeyRef.current = targetKey;
      setDataLinkTarget(target);
    }
  }, []);
  const activeDataLinks = useMemo(
    () => resolveDataLinks(model.metrics, dataLinkTarget),
    [dataLinkTarget, model.metrics]
  );
  const renderContextRef = useRef({ model: renderModel, options, theme, width, height, timeRange, timeZone });
  const renderedSizeRef = useRef({ width, height });
  const xTickCount = Math.max(2, Math.floor(width / 110));
  const yTickCount = Math.max(2, Math.floor(height / 70));
  const timeRangeFrom = timeRange.from.valueOf();
  const timeRangeTo = timeRange.to.valueOf();

  useLayoutEffect(() => {
    renderContextRef.current = { model: renderModel, options, theme, width, height, timeRange, timeZone };
  });

  useLayoutEffect(() => {
    if (rendererSelectionKeyRef.current !== rendererSelectionKey) {
      rendererSelectionKeyRef.current = rendererSelectionKey;
      rendererOverrideRef.current = undefined;
    }
  }, [rendererSelectionKey]);

  const structureKey = useMemo(
    () =>
      JSON.stringify({
        chartType,
        renderer: options.renderer,
        curve: options.curve,
        lineWidth: options.lineWidth,
        downsample: options.downsample,
        showLegend: options.showLegend,
        showGrid: options.showGrid,
        showTooltip: options.showTooltip,
        animation: options.animation,
        openField: options.openField,
        highField: options.highField,
        lowField: options.lowField,
        closeField: options.closeField,
        xAxisTitle: options.xAxisTitle,
        yAxisTitle: options.yAxisTitle,
        xAxisFormat: options.xAxisFormat,
        showThresholds: options.showThresholds,
        xType: model.xType,
        xField: model.xField,
        metrics: model.metrics,
        theme: theme.isDark,
        xTickCount,
        yTickCount,
        timeRangeFrom,
        timeRangeTo,
        timeZone,
        layoutWidth: Math.round(width),
        retryGeneration,
      }),
    [
      chartType,
      model.metrics,
      model.xField,
      model.xType,
      options.animation,
      options.closeField,
      options.curve,
      options.downsample,
      options.highField,
      options.lineWidth,
      options.lowField,
      options.openField,
      options.renderer,
      options.showGrid,
      options.showLegend,
      options.showThresholds,
      options.showTooltip,
      options.xAxisFormat,
      options.xAxisTitle,
      options.yAxisTitle,
      theme.isDark,
      timeZone,
      xTickCount,
      yTickCount,
      timeRangeFrom,
      timeRangeTo,
      retryGeneration,
      width,
    ]
  );

  const destroyCurrentController = useCallback(() => {
    const controller = controllerRef.current;
    controllerRef.current = null;
    if (controller) {
      try {
        controller.destroy();
      } catch (error) {
        logRuntimeError('render', activeRendererRef.current, error);
      }
    }
    containerRef.current?.replaceChildren();
  }, []);

  const recoverFromLifecycleFailure = useCallback(
    (phase: KChartRenderPhase, error: unknown) => {
      if (recoveringRef.current) {
        return;
      }
      recoveringRef.current = true;
      const failedRenderer = activeRendererRef.current;
      destroyCurrentController();
      logRuntimeError(phase, failedRenderer, error);

      if (supportsWebglFallback(chartType, failedRenderer)) {
        rendererOverrideRef.current = 'canvas';
        activeRendererRef.current = 'canvas';
        setActiveRenderer('canvas');
        setRuntimeIssue(undefined);
        setFallbackNotice(`WebGL failed during ${phase}. KChart switched to Canvas.`);
        setRetryGeneration((generation) => generation + 1);
        return;
      }

      setRuntimeIssue({ phase, message: runtimeIssueMessage(phase) });
    },
    [chartType, destroyCurrentController]
  );

  const retryRender = useCallback(() => {
    recoveringRef.current = false;
    rendererOverrideRef.current = undefined;
    setRuntimeIssue(undefined);
    setFallbackNotice(undefined);
    setRetryGeneration((generation) => generation + 1);
  }, []);

  useLayoutEffect(() => {
    let effectActive = true;
    const publishState = (update: () => void) => {
      queueMicrotask(() => {
        if (effectActive) {
          update();
        }
      });
    };
    const container = containerRef.current;
    const context = renderContextRef.current;
    if (!container || context.model.metrics.length === 0 || chartError) {
      return undefined;
    }

    const contextChartType = context.options.chartType ?? 'line';
    const contextCandlestickMetrics =
      contextChartType === 'candlestick'
        ? resolveCandlestickMetrics(context.model.metrics, candlestickMapping(context.options))
        : undefined;
    const contextDomainMetrics = contextCandlestickMetrics
      ? [
          contextCandlestickMetrics.open,
          contextCandlestickMetrics.high,
          contextCandlestickMetrics.low,
          contextCandlestickMetrics.close,
        ]
      : context.model.metrics;
    const requestedRenderer = rendererOverrideRef.current ?? context.options.renderer;
    container.replaceChildren();

    let renderAttempt;
    try {
      renderAttempt = renderWithRendererFallback(
        contextChartType,
        requestedRenderer,
        (renderer) => {
          const renderOptions = { ...context.options, renderer };
          const series = createChartSeries(
            context.model,
            renderOptions,
            context.theme,
            context.timeZone,
            handleTooltipTarget
          );
          const resolvedThresholdGuideLines =
            renderOptions.showThresholds === false
              ? []
              : resolveThresholdGuideLines(context.model, contextDomainMetrics, context.theme);
          const thresholdGuideLines = fitGuideLinesToChartWidth(resolvedThresholdGuideLines, context.width);
          const leftMargin = resolveChartLeftMargin(
            renderOptions.yAxisTitle,
            thresholdGuideLines,
            context.width
          );
          const chart = createKChart<KChartPanelPoint>({
            selector: container,
            data: context.model.data,
            width: context.width,
            height: context.height,
            margin: {
              top: renderOptions.showLegend ? 54 : 20,
              right: 24,
              bottom: renderOptions.xAxisTitle?.trim() ? 64 : 48,
              left: leftMargin,
            },
            axes: createAxes(
              context.model,
              contextDomainMetrics,
              contextChartType,
              context.width,
              context.height,
              context.timeRange,
              context.timeZone,
              renderOptions,
              leftMargin
            ),
            series,
            grid: {
              visible: renderOptions.showGrid,
              x: false,
              y: renderOptions.showGrid,
            },
            legend: {
              visible: renderOptions.showLegend,
              placement: 'top',
              selectable: true,
            },
            tooltip: {
              visible: renderOptions.showTooltip,
              formatter: ({ data, series: tooltipSeries, x, y, color }) => {
                const selectorMatch = /^kchart-grafana-series-(\d+)$/.exec(tooltipSeries.selector);
                const metric = selectorMatch
                  ? context.model.metrics[Number(selectorMatch[1])]
                  : (context.model.metrics.find((item) => item.displayName === tooltipSeries.displayName) ??
                    context.model.metrics[0]);
                if (metric) {
                  handleTooltipTarget(metric, data);
                }
                return `<strong style="color:${escapeHtml(color)}">${escapeHtml(
                  tooltipSeries.displayName ?? tooltipSeries.selector
                )}</strong><br/>x: ${escapeHtml(
                  formatXAxisValue(
                    x,
                    renderOptions.xAxisFormat ?? 'auto',
                    context.model.xField,
                    context.timeZone,
                    context.model.xType
                  )
                )}<br/>y: ${escapeHtml(formatConfiguredValue(metric, y))}`;
              },
            },
            guideLines: {
              visible: renderOptions.showThresholds !== false,
              y: thresholdGuideLines,
            },
            animation: renderOptions.animation,
            className: context.theme.isDark ? 'kchart-theme-dark' : 'kchart-theme-light',
          });
          try {
            const controller = chart.render();
            if (renderer === 'webgl') {
              assertWebglRenderSurface(container);
            }
            return controller;
          } catch (error) {
            try {
              chart.destroy();
            } catch (destroyError) {
              logRuntimeError('render', renderer, destroyError);
            }
            throw error;
          }
        },
        () => container.replaceChildren()
      );
    } catch (error) {
      container.replaceChildren();
      logRuntimeError('render', requestedRenderer, error);
      publishState(() => {
        setRuntimeIssue({ phase: 'render', message: runtimeIssueMessage('render') });
        setActiveRenderer(requestedRenderer);
      });
      return () => {
        effectActive = false;
      };
    }

    const controller = renderAttempt.value;
    const rendererWasOverridden = requestedRenderer !== context.options.renderer;
    activeRendererRef.current = renderAttempt.activeRenderer;
    recoveringRef.current = false;
    rendererOverrideRef.current =
      renderAttempt.didFallback || rendererWasOverridden ? renderAttempt.activeRenderer : undefined;
    publishState(() => {
      setActiveRenderer(renderAttempt.activeRenderer);
      setRuntimeIssue(undefined);
      if (renderAttempt.didFallback) {
        setFallbackNotice(
          renderAttempt.primaryError
            ? 'WebGL render failed. KChart switched to Canvas.'
            : 'WebGL is unavailable. KChart switched to Canvas.'
        );
      } else if (!rendererWasOverridden) {
        setFallbackNotice(undefined);
      }
    });
    if (renderAttempt.primaryError) {
      logRuntimeError('render', renderAttempt.requestedRenderer, renderAttempt.primaryError);
    }

    controllerRef.current = controller;
    renderedDataRef.current = context.model.data;
    renderedSizeRef.current = { width: context.width, height: context.height };
    const webglCanvases =
      renderAttempt.activeRenderer === 'webgl'
        ? Array.from(container.querySelectorAll<HTMLCanvasElement>('canvas[class*="kchart-webgl-canvas"]'))
        : [];
    const handleWebglContextLost = (event: Event) => {
      event.preventDefault();
      recoverFromLifecycleFailure('render', new Error('WebGL context was lost.'));
    };
    for (const canvas of webglCanvases) {
      canvas.addEventListener('webglcontextlost', handleWebglContextLost);
    }

    return () => {
      effectActive = false;
      for (const canvas of webglCanvases) {
        canvas.removeEventListener('webglcontextlost', handleWebglContextLost);
      }
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        try {
          controller.destroy();
        } catch (error) {
          logRuntimeError('render', renderAttempt.activeRenderer, error);
        }
      }
    };
  }, [chartError, handleTooltipTarget, recoverFromLifecycleFailure, structureKey]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || renderedDataRef.current === renderModel.data) {
      return;
    }
    try {
      controller.updateData(renderModel.data);
      renderedDataRef.current = renderModel.data;
    } catch (error) {
      recoverFromLifecycleFailure('update', error);
    }
  }, [recoverFromLifecycleFailure, renderModel.data]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || (renderedSizeRef.current.width === width && renderedSizeRef.current.height === height)) {
      return;
    }
    try {
      controller.resize({ width, height });
      renderedSizeRef.current = { width, height };
    } catch (error) {
      recoverFromLifecycleFailure('resize', error);
    }
  }, [height, recoverFromLifecycleFailure, width]);

  const waitingForInitialData =
    data.series.length === 0 &&
    (data.state === LoadingState.NotStarted ||
      data.state === LoadingState.Loading ||
      data.state === LoadingState.Streaming);

  if (waitingForInitialData) {
    return (
      <div className={styles.state} style={{ width, height }} data-testid="kchart-loading-state">
        <LoadingPlaceholder
          text={data.state === LoadingState.Streaming ? 'Waiting for stream data...' : 'Loading KChart data...'}
        />
      </div>
    );
  }

  if (data.state === LoadingState.Error || data.series.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} />;
  }

  if (chartError) {
    return (
      <div className={styles.state} style={{ width, height }} data-testid="kchart-configuration-error">
        <Alert title="KChart configuration error" severity="warning">
          {chartError}
        </Alert>
      </div>
    );
  }

  if (model.metrics.length === 0) {
    return (
      <div className={styles.state} style={{ width, height }} data-testid="kchart-empty-state">
        <Alert title="No numeric fields" severity="info">
          Add at least one numeric field to render a KChart panel.
        </Alert>
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={{ width, height }}>
      <div
        ref={containerRef}
        data-testid="kchart-panel"
        data-chart-type={chartType}
        data-renderer={activeRenderer}
        data-requested-renderer={options.renderer}
        className={styles.chart}
      />
      {data.state === LoadingState.Loading && !fallbackNotice && (
        <div className={styles.loading} data-testid="kchart-updating-state">
          <LoadingPlaceholder text="Updating..." />
        </div>
      )}
      {fallbackNotice && (
        <div className={styles.fallback} data-testid="kchart-renderer-fallback" role="status">
          {fallbackNotice}
        </div>
      )}
      {axisWarning && (
        <div className={styles.warning} data-testid="kchart-shared-axis-warning">
          {axisWarning}
        </div>
      )}
      {activeDataLinks.links.length > 0 && (
        <DataLinksContextMenu
          links={() => activeDataLinks.links}
          style={{ position: 'absolute', zIndex: 9, right: 8, bottom: 8 }}
        >
          {({ openMenu, targetClassName, triggerProps }) => {
            const compatibleTriggerProps = resolveDataLinkMenuTriggerProps({ openMenu, triggerProps });
            return (
              <span
                {...compatibleTriggerProps}
                className={`${styles.dataLink} ${compatibleTriggerProps ? styles.dataLinkPosition : ''} ${targetClassName ?? ''}`}
                data-testid="kchart-data-links"
              >
                {activeDataLinks.links.length > 1 ? 'Data links' : 'Open data link'} ·{' '}
                {activeDataLinks.metric?.displayName}
              </span>
            );
          }}
        </DataLinksContextMenu>
      )}
      {runtimeIssue && (
        <div className={styles.runtimeError} data-testid="kchart-runtime-error">
          <Alert
            title={`KChart ${runtimeIssue.phase} error`}
            severity="error"
            action={
              <Button size="sm" variant="secondary" onClick={retryRender}>
                Retry
              </Button>
            }
          >
            {runtimeIssue.message}
          </Alert>
        </div>
      )}
    </div>
  );
};

export const KChartPanel: React.FC<Props> = (props) => (
  <ErrorBoundaryAlert
    boundaryName="kchart-panel"
    title="KChart panel failed"
    dependencies={[props.options, props.data, props.width, props.height]}
    errorLogger={(error) => logRuntimeError('react', props.options.renderer, error)}
  >
    <KChartPanelContent {...props} />
  </ErrorBoundaryAlert>
);
