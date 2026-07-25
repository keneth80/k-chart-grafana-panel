# Bundle optimization verification

## What changed

The panel imports only the KChart modules it uses:

```ts
import {createKChart} from '@keneth80/k-chart/core/create-kchart';
import type {KChartSeries} from '@keneth80/k-chart/core/contracts';
import {createLineSeries} from '@keneth80/k-chart/series/svg-line';
import {createCanvasLineSeries} from '@keneth80/k-chart/series/canvas-line';
import {createWebglLineSeries} from '@keneth80/k-chart/series/webgl-line';
```

The previous root/category imports also bundled unrelated globe, map, graph,
tree, Sankey, dashboard, and distribution renderers together with
`world-atlas` data.

## Measured result

Production `dist/module.js` on the same workstation:

| Build | Raw size |
| --- | ---: |
| Root KChart import | 597,858 bytes |
| Granular renderer imports | 217,824 bytes |
| Reduction | 380,034 bytes (63.6%) |

The optimized bundle is below Webpack's 244 KiB recommended asset threshold.

## Automated verification

Install the KChart version that contains granular exports, then run:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:ci
npm run build
npm run bundle:report
```

Run the real Grafana integration test:

```bash
GRAFANA_PORT=3010 npm run server
```

In another terminal:

```bash
GRAFANA_URL=http://127.0.0.1:3010 npm run e2e
```

Stop the test server when finished:

```bash
docker compose down
```

## Manual Grafana checklist

Open `http://127.0.0.1:3010` and verify:

1. Add the KChart panel with Grafana TestData time-series data.
2. Switch Renderer between SVG, Canvas, and WebGL.
3. Toggle legend, grid, tooltip, animation, and LTTB downsampling.
4. Hover the line and confirm the nearest timestamp and value appear.
5. Change the dashboard time range and confirm the x-axis follows it.
6. Resize the panel and confirm the chart fills the panel without clipping.
7. Remove the query and confirm the No data state is displayed.
