import { PanelPlugin } from '@grafana/data';
import type { KChartPanelOptions } from './types';
import { KChartPanel } from './components/KChartPanel';

export const plugin = new PanelPlugin<KChartPanelOptions>(KChartPanel).setPanelOptions((builder) => {
  return builder
    .addSelect({
      path: 'renderer',
      name: 'Renderer',
      description: 'Choose SVG for inspection, Canvas for dense lines, or WebGL for large datasets.',
      defaultValue: 'svg',
      settings: {
        options: [
          { value: 'svg', label: 'SVG' },
          { value: 'canvas', label: 'Canvas' },
          { value: 'webgl', label: 'WebGL' },
        ],
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
    .addBooleanSwitch({
      path: 'curve',
      name: 'Smooth SVG line',
      description: 'Curve interpolation is available for the SVG renderer.',
      defaultValue: true,
    })
    .addBooleanSwitch({
      path: 'animation',
      name: 'Animate updates',
      defaultValue: false,
    })
    .addBooleanSwitch({
      path: 'downsample',
      name: 'LTTB downsampling',
      description: 'Reduce dense line data before rendering while preserving visible peaks.',
      defaultValue: false,
    })
    .addSliderInput({
      path: 'lineWidth',
      name: 'Line width',
      defaultValue: 2,
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
