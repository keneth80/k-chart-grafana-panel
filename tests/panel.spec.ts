import { test, expect } from '@grafana/plugin-e2e';

test('should display "No data" in case panel data is empty', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '2' });
  await expect(panelEditPage.panel.locator).toContainText('No data');
});

test('should display a KChart panel when data is passed to the panel', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  await expect(panelEditPage.panel.locator.getByTestId('kchart-panel')).toBeVisible();
});

test('should switch between the supported KChart chart types', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const chartType = panelEditPage.getCustomOptions('KChart Panel').getSelect('Chart type');
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');
  await panelEditPage.getCustomOptions('KChart Panel').getSelect('Renderer').selectOption('WebGL');
  await expect(panel).toHaveAttribute('data-renderer', 'webgl');

  for (const type of ['Column', 'Area', 'Scatter', 'Candlestick']) {
    await chartType.selectOption(type);
    await expect(panel).toHaveAttribute('data-chart-type', type.toLowerCase());

    if (type === 'Column') {
      await expect(panel).toHaveAttribute('data-renderer', 'svg');
      await expect(panel.locator('rect.kchart-grafana-columns')).toHaveCount(36);
    } else if (type === 'Area') {
      await expect(panel).toHaveAttribute('data-renderer', 'svg');
      await expect(panel.locator('path.kchart-grafana-series-0')).toHaveCount(1);
    } else if (type === 'Scatter') {
      await expect(panel).toHaveAttribute('data-renderer', 'webgl');
      expect(await panel.locator('canvas[class*="kchart-webgl-canvas"]').count()).toBeGreaterThan(0);
    }
  }

  await expect(panel).toHaveAttribute('data-renderer', 'canvas');
  await expect(panel.locator('canvas')).toHaveCount(1);
  await expect(panel).not.toContainText('Candlestick requires numeric fields named Open, High, Low and Close.');
});

test('should fall back to Canvas when WebGL is unavailable', async ({
  gotoPanelEditPage,
  page,
  readProvisionedDashboard,
}) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: string, ...args: unknown[]) {
      if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
        return null;
      }
      return Reflect.apply(originalGetContext, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');

  await panelEditPage.getCustomOptions('KChart Panel').getSelect('Renderer').selectOption('WebGL');

  await expect(panel).toHaveAttribute('data-requested-renderer', 'webgl');
  await expect(panel).toHaveAttribute('data-renderer', 'canvas');
  expect(await panel.locator('canvas').count()).toBeGreaterThan(0);
  await expect(panel.locator('canvas[class*="kchart-webgl-canvas"]')).toHaveCount(0);
  await expect(panelEditPage.panel.locator.getByTestId('kchart-renderer-fallback')).toContainText('switched to Canvas');
});

test('should recover with Canvas when the WebGL context is lost', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');

  await panelEditPage.getCustomOptions('KChart Panel').getSelect('Renderer').selectOption('WebGL');
  await expect(panel).toHaveAttribute('data-renderer', 'webgl');

  const webglCanvases = panel.locator('canvas[class*="kchart-webgl-canvas"]');
  expect(await webglCanvases.count()).toBeGreaterThan(1);
  await webglCanvases.nth(1).dispatchEvent('webglcontextlost');

  await expect(panel).toHaveAttribute('data-renderer', 'canvas');
  await expect(panelEditPage.panel.locator.getByTestId('kchart-renderer-fallback')).toContainText(
    'failed during render'
  );
  expect(await panel.locator('canvas').count()).toBeGreaterThan(0);
});

test('should apply explicit Grafana field mappings', async ({ gotoPanelEditPage, page, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const mapping = panelEditPage.getCustomOptions('Field mapping');
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');

  const selectField = async (label: string, fieldName: string) => {
    const input = mapping.getSelect(label).locator().getByRole('combobox');
    await input.click();
    await input.fill(fieldName);
    await page.getByRole('option', { name: fieldName, exact: true }).click();
  };

  await selectField('X field', 'Time');
  await selectField('Y field', 'Close');

  await expect(panel.locator('path.kchart-grafana-series-0')).toHaveCount(1);
  await expect(panel.locator('path.kchart-grafana-series-1')).toHaveCount(0);
  await expect(panel).toContainText('Close');
});

test('should reduce dense SVG paths while preserving their visible range', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
  request,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const densePanel = dashboard.panels.find((candidate) => candidate.id === 1);
  const denseTarget = densePanel?.targets[0] as { rawFrameContent?: string } | undefined;
  if (!densePanel || !denseTarget) {
    throw new Error('The provisioned line panel is missing its raw-frame target.');
  }

  const pointCount = 12000;
  const spikeIndex = Math.floor(pointCount * 0.45);
  denseTarget.rawFrameContent = JSON.stringify([
    {
      columns: [
        { text: 'Time', type: 'time' },
        { text: 'Close', type: 'number' },
      ],
      rows: Array.from({ length: pointCount }, (_, index) => [
        1609459200000 + index * 1000,
        index === spikeIndex ? 160 : index === spikeIndex + 1 ? 40 : 100 + Math.sin(index / 30) * 8,
      ]),
    },
  ]);
  densePanel.options = { ...densePanel.options, curve: false, downsample: false };
  const dashboardUid = `kchart-downsample-${Date.now()}`;
  Object.assign(dashboard, {
    id: null,
    title: `KChart downsampling ${Date.now()}`,
    uid: dashboardUid,
    version: 0,
  });
  const createDashboard = await request.post('/api/dashboards/db', {
    data: { dashboard, overwrite: false },
  });
  expect(createDashboard.ok(), await createDashboard.text()).toBe(true);

  try {
    const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
    const options = panelEditPage.getCustomOptions('KChart Panel');
    const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');
    const line = panel.locator('path.kchart-grafana-series-0');
    const readRenderedLine = () =>
      line.evaluate((element) => {
        const path = element as SVGPathElement;
        const pathData = path.getAttribute('d') ?? '';
        const bounds = path.getBBox();
        const start = path.getPointAtLength(0);
        const end = path.getPointAtLength(path.getTotalLength());
        return {
          bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
          end: { x: end.x, y: end.y },
          pathData,
          renderedPointCount: (pathData.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).length / 2,
          start: { x: start.x, y: start.y },
        };
      });

    await expect(line).toBeVisible();
    const fullResolution = await readRenderedLine();
    expect(fullResolution.renderedPointCount).toBeGreaterThan(pointCount * 0.9);

    await options.getSwitch('Enable downsampling').check();
    await options.getRadioGroup('Downsampling strategy').check('Pixel min/max');
    const pointsPerPixel = options.getSliderInput('Points per pixel');
    await pointsPerPixel.fill('1');
    await pointsPerPixel.press('Enter');

    await expect.poll(async () => (await readRenderedLine()).pathData).not.toBe(fullResolution.pathData);
    const downsampled = await readRenderedLine();
    expect(downsampled.renderedPointCount).toBeLessThan(fullResolution.renderedPointCount / 2);
    expect(downsampled.start.x).toBeCloseTo(fullResolution.start.x, 3);
    expect(downsampled.start.y).toBeCloseTo(fullResolution.start.y, 3);
    expect(downsampled.end.x).toBeCloseTo(fullResolution.end.x, 3);
    expect(downsampled.end.y).toBeCloseTo(fullResolution.end.y, 3);
    expect(downsampled.bounds.y).toBeCloseTo(fullResolution.bounds.y, 3);
    expect(downsampled.bounds.height).toBeCloseTo(fullResolution.bounds.height, 3);
  } finally {
    await request.delete(`/api/dashboards/uid/${dashboardUid}`);
  }
});

test('should update the Grafana time range only after selection zoom is enabled', async ({
  gotoPanelEditPage,
  page,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');
  const overlay = panel.locator('rect.kchart-tooltip-overlay');
  const timeRangeButton = page.getByRole('button', { name: /^Time range selected:/ });
  const xAxisTickLabels = panel.locator('.kchart-axis-bottom .tick text');
  const dragAcrossRange = async () => {
    const box = await overlay.boundingBox();
    if (!box) {
      throw new Error('The KChart interaction overlay was not rendered.');
    }
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, y, { steps: 10 });
  };

  await expect(overlay).toBeVisible();
  await expect(timeRangeButton).toBeVisible();
  const initialTimeRange = await timeRangeButton.innerText();
  const initialTickLabels = await xAxisTickLabels.allTextContents();
  expect(initialTickLabels.length).toBeGreaterThan(1);

  await dragAcrossRange();
  await expect(panel.locator('rect.kchart-zoom-selection')).toHaveCount(0);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(timeRangeButton).toHaveText(initialTimeRange);
  expect(await xAxisTickLabels.allTextContents()).toEqual(initialTickLabels);

  await panelEditPage.getCustomOptions('Interaction').getSwitch('Drag to zoom time range').check();
  await dragAcrossRange();
  const selection = panel.locator('rect.kchart-zoom-selection');
  await expect(selection).toHaveCount(1);
  expect(Number(await selection.getAttribute('width'))).toBeGreaterThan(8);
  await page.mouse.up();

  await expect.poll(() => timeRangeButton.innerText()).not.toBe(initialTimeRange);
  await expect.poll(() => xAxisTickLabels.allTextContents()).not.toEqual(initialTickLabels);
});

test('should apply Grafana field styles and KChart axis options', async ({
  gotoPanelEditPage,
  page,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');

  await expect(panel).toContainText('Observed at');
  await expect(panel).toContainText('Price');
  await expect(panel.locator('path.kchart-grafana-series-0')).toHaveCSS('stroke', 'rgb(255, 45, 149)');
  await expect(panel.locator('g.kchart-fixed-guide-line-y')).toHaveCount(1);
  await expect(panel.locator('g.kchart-fixed-guide-line-label')).toContainText('115.0');
  const panelBox = await panel.boundingBox();
  const thresholdBox = await panel.locator('g.kchart-fixed-guide-line-label').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(thresholdBox).not.toBeNull();
  expect(thresholdBox!.x).toBeGreaterThanOrEqual(panelBox!.x);

  await panelEditPage.getStandardOptions().getUnitPicker('Unit').selectOption('Misc > Percent (0-100)');
  await expect(panel.locator('.kchart-axis-left')).toContainText('%');

  const lineHoverPoint = await panel.locator('path.kchart-grafana-series-0').evaluate((element) => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const matrix = path.getScreenCTM();
    if (!matrix) {
      throw new Error('Line series screen transform is unavailable.');
    }
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  });
  await page.mouse.move(lineHoverPoint.x, lineHoverPoint.y);
  await expect(panel.locator('.kchart-tooltip')).toContainText('%');

  const chartType = panelEditPage.getCustomOptions('KChart Panel').getSelect('Chart type');
  await chartType.selectOption('Column');
  const columns = panel.locator('rect.kchart-grafana-columns');
  const columnBoxes = await columns.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    })
  );
  const xAxisBox = await panel.locator('.kchart-axis-bottom path.domain').boundingBox();
  expect(xAxisBox).not.toBeNull();
  expect(Math.min(...columnBoxes.map((box) => box.left))).toBeGreaterThanOrEqual(xAxisBox!.x - 1);
  expect(Math.max(...columnBoxes.map((box) => box.right))).toBeLessThanOrEqual(xAxisBox!.x + xAxisBox!.width + 1);
  await columns.first().hover({ force: true });
  await expect(panel.locator('.kchart-tooltip')).toContainText('%');

  await chartType.selectOption('Candlestick');
  const canvas = panel.locator('canvas').first();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) {
    throw new Error('Candlestick canvas was not rendered.');
  }
  const candleTooltip = panel.locator('.kchart-tooltip');
  let candleTooltipVisible = false;
  for (const xRatio of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    for (const yRatio of [0.15, 0.22, 0.3, 0.38]) {
      await page.mouse.move(canvasBox.x + canvasBox.width * xRatio, canvasBox.y + canvasBox.height * yRatio);
      if ((await candleTooltip.textContent())?.includes('%')) {
        candleTooltipVisible = true;
        break;
      }
    }
    if (candleTooltipVisible) {
      break;
    }
  }
  expect(candleTooltipVisible).toBe(true);
  await expect(candleTooltip).toBeVisible();
  await expect(candleTooltip).toContainText('%');

  await panelEditPage.getCustomOptions('Thresholds').getSwitch('Show threshold lines').uncheck();
  await expect(panel.locator('g.kchart-fixed-guide-line-y')).toHaveCount(0);
});

test('should resolve Grafana Data Links for the hovered chart point', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'dashboard.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  const panel = panelEditPage.panel.locator.getByTestId('kchart-panel');

  await panel.locator('path.kchart-grafana-series-0').hover({ force: true });

  const trigger = panelEditPage.panel.locator.getByTestId('kchart-data-links');
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('Open data link');

  const link = trigger.locator('xpath=..');
  const href = await link.getAttribute('href');
  const title = await link.getAttribute('title');
  const selectedField = title?.replace(/^Inspect /, '');

  expect(selectedField).toMatch(/^(Open|Close)$/);
  expect(new URL(href ?? '', 'http://localhost').searchParams.get('var-kchart_field')).toBe(selectedField);
  await expect(link).toHaveAttribute('href', /var-kchart_value=\d+/);
  await expect(link).toHaveAttribute('href', /from=\d+/);
  await expect(link).toHaveAttribute('href', /to=\d+/);
});
