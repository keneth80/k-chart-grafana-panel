import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ProvisionedPanel {
  id: number;
  type: string;
  title: string;
  options: {
    chartType: string;
    renderer: string;
  };
  targets: Array<{
    scenarioId?: string;
  }>;
}

interface ProvisionedDashboard {
  panels: ProvisionedPanel[];
}

const dashboard = JSON.parse(
  readFileSync(resolve(process.cwd(), 'provisioning/dashboards/dashboard.json'), 'utf8')
) as ProvisionedDashboard;

describe('provisioned KChart examples', () => {
  it('contains a rendered example for every supported chart type', () => {
    const expectedExamples = [
      { id: 1, chartType: 'line', renderer: 'svg' },
      { id: 3, chartType: 'area', renderer: 'svg' },
      { id: 4, chartType: 'column', renderer: 'svg' },
      { id: 5, chartType: 'scatter', renderer: 'webgl' },
      { id: 6, chartType: 'candlestick', renderer: 'canvas' },
    ];

    for (const expected of expectedExamples) {
      const panel = dashboard.panels.find(({ id }) => id === expected.id);

      expect(panel).toMatchObject({
        type: 'keneth80-kchart-panel',
        options: {
          chartType: expected.chartType,
          renderer: expected.renderer,
        },
      });
      expect(panel?.targets[0]?.scenarioId).toBe('raw_frame');
    }
  });

  it('keeps panel identifiers unique', () => {
    const panelIds = dashboard.panels.map(({ id }) => id);

    expect(new Set(panelIds).size).toBe(panelIds.length);
  });
});
