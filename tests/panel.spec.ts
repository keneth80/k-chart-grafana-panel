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
