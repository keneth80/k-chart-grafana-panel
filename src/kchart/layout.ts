import type { KChartFixedGuideLine } from '@keneth80/k-chart';
import type { KChartDataModel, KChartPanelPoint } from './dataFrame';

const BASE_LEFT_MARGIN = 64;
const TITLED_LEFT_MARGIN = 76;
const CHART_RIGHT_MARGIN = 24;
const MINIMUM_PLOT_WIDTH = 40;
const GUIDE_LABEL_OFFSET = 12;
const GUIDE_LABEL_EDGE_GAP = 4;
export const KCHART_COLUMN_GROUP_WIDTH_RATIO = 0.76;
export const KCHART_COLUMN_GAP = 2;
const KCHART_MINIMUM_COLUMN_WIDTH = 2;

const numericXValue = (value: Date | number): number => (value instanceof Date ? value.getTime() : value);

const sortedUniqueXValues = (model: KChartDataModel): number[] => {
  const values = model.data
    .map((point) => numericXValue(point.__x))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
};

interface DomainExtensions {
  left: number;
  right: number;
}

export interface KChartColumnLayout {
  plotWidth: number;
  segmentCount: number;
}

const resolveColumnDomainExtensions = (
  values: number[],
  domainMin: number,
  domainMax: number,
  layout: KChartColumnLayout
): DomainExtensions => {
  const span = domainMax - domainMin;
  if (!Number.isFinite(span) || span <= 0) {
    return { left: 0.5, right: 0.5 };
  }

  // Mirror createGroupedColumnSeries geometry, including its 2px minimum bar
  // width and fixed inter-series gaps. This matters in narrow Grafana panels,
  // where those pixel minimums can be wider than the proportional group band.
  const plotWidth = Math.max(1, layout.plotWidth);
  const segmentCount = Math.max(1, layout.segmentCount);
  const proportionalGroupWidth = (plotWidth / values.length) * KCHART_COLUMN_GROUP_WIDTH_RATIO;
  const minimumGroupWidth =
    KCHART_MINIMUM_COLUMN_WIDTH * segmentCount + KCHART_COLUMN_GAP * Math.max(0, segmentCount - 1);
  const actualGroupWidth = Math.max(proportionalGroupWidth, minimumGroupWidth);
  const leftGroupRatio = proportionalGroupWidth / (plotWidth * 2);
  const rightGroupRatio = (actualGroupWidth - proportionalGroupWidth / 2) / plotWidth;
  const leftGap = values[0] - domainMin;
  const rightGap = domainMax - values[values.length - 1];
  let left = 0;
  let right = 0;

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const expandedSpan = span + left + right;
    const nextLeft = Math.max(0, leftGroupRatio * expandedSpan - leftGap);
    const nextRight = Math.max(0, rightGroupRatio * expandedSpan - rightGap);
    if (Math.abs(nextLeft - left) + Math.abs(nextRight - right) <= span * 1e-9) {
      left = nextLeft;
      right = nextRight;
      break;
    }
    left = nextLeft;
    right = nextRight;
  }

  return { left, right };
};

export interface KChartColumnXAxisBounds {
  min: Date | number;
  max: Date | number;
}

export const resolveColumnRenderData = (
  data: KChartPanelPoint[],
  xType: KChartDataModel['xType'],
  timeRangeFrom: number,
  timeRangeTo: number
): KChartPanelPoint[] => {
  if (xType !== 'time') {
    return data;
  }
  const rangeMin = Math.min(timeRangeFrom, timeRangeTo);
  const rangeMax = Math.max(timeRangeFrom, timeRangeTo);
  return data.filter((point) => {
    const value = numericXValue(point.__x);
    return Number.isFinite(value) && value >= rangeMin && value <= rangeMax;
  });
};

/**
 * Continuous scales place the first column center directly on the domain edge.
 * Extend the domain just enough for the rendered group width so the complete
 * first and last groups remain inside the plot without changing source data.
 */
export const resolveColumnXAxisBounds = (
  model: KChartDataModel,
  timeRangeFrom: number,
  timeRangeTo: number,
  layout: KChartColumnLayout
): KChartColumnXAxisBounds | undefined => {
  let values = sortedUniqueXValues(model);
  if (values.length === 0) {
    return undefined;
  }

  if (model.xType === 'time') {
    const rangeMin = Math.min(timeRangeFrom, timeRangeTo);
    const rangeMax = Math.max(timeRangeFrom, timeRangeTo);
    // Grafana data sources may return an extra sample outside the dashboard
    // interval. It must not widen the selected time range or compress its data.
    values = values.filter((value) => value >= rangeMin && value <= rangeMax);
    if (values.length === 0) {
      return { min: new Date(rangeMin), max: new Date(rangeMax) };
    }
    const extension = resolveColumnDomainExtensions(values, rangeMin, rangeMax, layout);
    return {
      min: new Date(rangeMin - extension.left),
      max: new Date(rangeMax + extension.right),
    };
  }

  const domainMin = values[0];
  const domainMax = values[values.length - 1];
  const extension = resolveColumnDomainExtensions(values, domainMin, domainMax, layout);
  return {
    min: domainMin - extension.left,
    max: domainMax + extension.right,
  };
};

const guideLabelWidth = (label: string): number => {
  const coreWidth = Math.max(28, label.length * 7 + 14);
  const estimatedTextWidth = Array.from(label).reduce((width, character) => {
    if (character.charCodeAt(0) > 0xff) {
      return width + 11;
    }
    return width + (/[MW@#%]/.test(character) ? 9 : 7);
  }, 0);

  // KChart centers text using coreWidth. Reserve any estimated glyph overhang
  // as well as the background rectangle used by the core renderer.
  return Math.max(coreWidth, (coreWidth + estimatedTextWidth) / 2);
};

const maximumLeftMargin = (chartWidth: number): number =>
  Math.max(0, chartWidth - CHART_RIGHT_MARGIN - MINIMUM_PLOT_WIDTH);

const compactGuideLabel = (label: string, availableWidth: number): string | undefined => {
  if (guideLabelWidth(label) <= availableWidth) {
    return label;
  }

  const threshold = label.match(/([≥≤><=])\s*(.+)$/u);
  let compact = threshold ? `${threshold[1]}${threshold[2]}` : label;
  if (guideLabelWidth(compact) <= availableWidth) {
    return compact;
  }

  const characters = Array.from(compact);
  while (characters.length > 1 && guideLabelWidth(`…${characters.join('')}`) > availableWidth) {
    characters.shift();
  }
  compact = `…${characters.join('')}`;
  return guideLabelWidth(compact) <= availableWidth ? compact : undefined;
};

/** Keep threshold values visible without allowing labels to consume the plot. */
export const fitGuideLinesToChartWidth = (
  guideLines: KChartFixedGuideLine[],
  chartWidth: number
): KChartFixedGuideLine[] => {
  const availableLabelWidth = maximumLeftMargin(chartWidth) - GUIDE_LABEL_OFFSET - GUIDE_LABEL_EDGE_GAP;
  return guideLines.map((guide) => {
    if (!guide.label) {
      return guide;
    }
    return { ...guide, label: compactGuideLabel(guide.label, availableLabelWidth) };
  });
};

/** Match KChart's fixed-guide label sizing and reserve its left-side offset. */
export const resolveChartLeftMargin = (
  yAxisTitle: string | undefined,
  guideLines: KChartFixedGuideLine[],
  chartWidth: number
): number => {
  const base = yAxisTitle?.trim() ? TITLED_LEFT_MARGIN : BASE_LEFT_MARGIN;
  const widestLabel = guideLines.reduce(
    (width, guide) => Math.max(width, guide.label ? guideLabelWidth(guide.label) : 0),
    0
  );

  const requested = Math.max(base, Math.ceil(widestLabel + GUIDE_LABEL_OFFSET + GUIDE_LABEL_EDGE_GAP));
  const maximum = maximumLeftMargin(chartWidth);
  return Math.min(requested, maximum);
};
