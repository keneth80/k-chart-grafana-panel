import { FieldConfigProperty, FieldType, PanelPlugin } from '@grafana/data';
import type { KChartPanelOptions } from './types';
import { KChartPanel } from './components/KChartPanel';

export const plugin = new PanelPlugin<KChartPanelOptions>(KChartPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.DisplayName]: {},
      [FieldConfigProperty.Unit]: {},
      [FieldConfigProperty.Decimals]: {},
      [FieldConfigProperty.Min]: {},
      [FieldConfigProperty.Max]: {},
      [FieldConfigProperty.Color]: {},
      [FieldConfigProperty.Thresholds]: {},
      // Grafana 12.3 does not expose the Links standard-option editor at runtime.
      ...(FieldConfigProperty.Links ? { [FieldConfigProperty.Links]: {} } : {}),
    },
  })
  .setPanelOptions((builder) => {
    return builder
      .addSelect({
        path: 'chartType',
        name: 'Chart type',
        description: 'Choose the visualization that best matches the Grafana fields.',
        defaultValue: 'line',
        settings: {
          options: [
            { value: 'line', label: 'Line' },
            { value: 'column', label: 'Column' },
            { value: 'area', label: 'Area' },
            { value: 'scatter', label: 'Scatter' },
            { value: 'candlestick', label: 'Candlestick' },
          ],
        },
      })
      .addSelect({
        path: 'renderer',
        name: 'Renderer',
        description: 'Line and Scatter support SVG, Canvas and WebGL renderers.',
        defaultValue: 'svg',
        showIf: (options) => (options.chartType ?? 'line') === 'line' || options.chartType === 'scatter',
        settings: {
          options: [
            { value: 'svg', label: 'SVG' },
            { value: 'canvas', label: 'Canvas' },
            { value: 'webgl', label: 'WebGL' },
          ],
        },
      })
      .addFieldNamePicker({
        path: 'xField',
        name: 'X field',
        description: 'Leave empty to use the first time field or the row index automatically.',
        category: ['Field mapping'],
        settings: {
          filter: (field) => field.type === FieldType.time || field.type === FieldType.number,
          placeholderText: 'Auto',
          isClearable: true,
          noFieldsMessage: 'No time or numeric fields found',
        },
      })
      .addFieldNamePicker({
        path: 'yField',
        name: 'Y field',
        description: 'Leave empty to render every numeric field.',
        category: ['Field mapping'],
        showIf: (options) => (options.chartType ?? 'line') !== 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.number,
          placeholderText: 'All numeric fields',
          isClearable: true,
          noFieldsMessage: 'No numeric fields found',
        },
      })
      .addFieldNamePicker({
        path: 'seriesField',
        name: 'Series field',
        description: 'Optional categorical field used to split one Y field into multiple series.',
        category: ['Field mapping'],
        showIf: (options) => (options.chartType ?? 'line') !== 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.string,
          placeholderText: 'None',
          isClearable: true,
          noFieldsMessage: 'No string fields found',
        },
      })
      .addFieldNamePicker({
        path: 'openField',
        name: 'Open field',
        description: 'Leave empty to detect Open or 시가 automatically.',
        category: ['Candlestick fields'],
        showIf: (options) => options.chartType === 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.number,
          placeholderText: 'Auto',
          isClearable: true,
        },
      })
      .addFieldNamePicker({
        path: 'highField',
        name: 'High field',
        description: 'Leave empty to detect High or 고가 automatically.',
        category: ['Candlestick fields'],
        showIf: (options) => options.chartType === 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.number,
          placeholderText: 'Auto',
          isClearable: true,
        },
      })
      .addFieldNamePicker({
        path: 'lowField',
        name: 'Low field',
        description: 'Leave empty to detect Low or 저가 automatically.',
        category: ['Candlestick fields'],
        showIf: (options) => options.chartType === 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.number,
          placeholderText: 'Auto',
          isClearable: true,
        },
      })
      .addFieldNamePicker({
        path: 'closeField',
        name: 'Close field',
        description: 'Leave empty to detect Close or 종가 automatically.',
        category: ['Candlestick fields'],
        showIf: (options) => options.chartType === 'candlestick',
        settings: {
          filter: (field) => field.type === FieldType.number,
          placeholderText: 'Auto',
          isClearable: true,
        },
      })
      .addBooleanSwitch({
        path: 'showLegend',
        name: 'Show legend',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showGrid',
        name: 'Show grid',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'showTooltip',
        name: 'Show tooltip',
        defaultValue: true,
      })
      .addTextInput({
        path: 'xAxisTitle',
        name: 'X-axis title',
        description: 'Optional title rendered below the X axis.',
        category: ['Axes'],
        settings: {
          placeholder: 'None',
        },
      })
      .addTextInput({
        path: 'yAxisTitle',
        name: 'Y-axis title',
        description: 'Optional title rendered beside the Y axis.',
        category: ['Axes'],
        settings: {
          placeholder: 'None',
        },
      })
      .addSelect({
        path: 'xAxisFormat',
        name: 'X-axis format',
        description: 'Format time labels or use the selected numeric field unit.',
        category: ['Axes'],
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'time', label: 'Time (HH:mm:ss)' },
            { value: 'date', label: 'Date (YYYY-MM-DD)' },
            { value: 'date-time', label: 'Date and time' },
            { value: 'number', label: 'Number' },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'showThresholds',
        name: 'Show threshold lines',
        description: 'Render Grafana field thresholds as fixed KChart guide lines.',
        category: ['Thresholds'],
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'curve',
        name: 'Smooth SVG line',
        description: 'Curve interpolation is available for SVG Line and Area charts.',
        defaultValue: true,
        showIf: (options) => {
          const chartType = options.chartType ?? 'line';
          return chartType === 'area' || (chartType === 'line' && (options.renderer ?? 'svg') === 'svg');
        },
      })
      .addBooleanSwitch({
        path: 'animation',
        name: 'Animate updates',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'downsample',
        name: 'LTTB downsampling',
        description: 'Reduce dense Line and Area data while preserving visible peaks.',
        defaultValue: false,
        showIf: (options) => (options.chartType ?? 'line') === 'line' || options.chartType === 'area',
      })
      .addSliderInput({
        path: 'lineWidth',
        name: 'Line width',
        defaultValue: 2,
        showIf: (options) => (options.chartType ?? 'line') === 'line' || options.chartType === 'area',
        settings: {
          min: 1,
          max: 8,
          step: 1,
        },
      })
      .addRadio({
        path: 'nullMode',
        name: 'Null values',
        defaultValue: 'skip',
        settings: {
          options: [
            { value: 'skip', label: 'Skip invalid values' },
            { value: 'zero', label: 'Replace with zero' },
          ],
        },
      });
  });
