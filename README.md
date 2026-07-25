# KChart Grafana Panel

Grafana panel plugin powered by [`@keneth80/k-chart`](https://github.com/keneth80/k-chart).

The MVP renders Grafana numeric fields as multi-series line charts and lets dashboard authors switch between SVG, Canvas, and WebGL without changing the query.

## Data mapping

- The first `FieldType.time` field becomes the KChart time axis.
- Every numeric field becomes a selectable line series.
- Multiple Grafana data frames are merged by timestamp.
- `field.config.displayName` becomes the legend label.
- Fixed Grafana field colors are forwarded to KChart.
- Frames without a time field use their row index as a numeric X axis.
- Null values can be skipped or replaced with zero.

The adapter does not mutate Grafana data frames.

## Getting started

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Build and watch the plugin:

   ```bash
   npm run dev
   ```

3. Start the scaffolded Grafana development server:

   ```bash
   npm run server
   ```

4. Open [http://localhost:3000](http://localhost:3000) and select **KChart Panel**.

The Docker development environment permits the unsigned plugin ID `keneth80-kchart-panel`.

## Verification

```bash
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

## Current MVP

- SVG, Canvas, and WebGL line renderers
- Time-series and numeric-index X axes
- Multiple numeric fields and data frames
- Grafana dark/light theme styling
- Legend selection, tooltip, grid, curve, animation, and line width options
- Optional KChart LTTB downsampling
- `updateData`, `resize`, and `destroy` lifecycle integration

Maps, Three.js, CesiumJS, annotations, alert-state overlays, and Grafana data links are intentionally outside the first MVP.

## Distribution

Grafana requires distributed plugins to be signed. Local development does not require a signature.

- [Plugin signing](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Build automation](https://grafana.com/developers/plugin-tools/publish-a-plugin/build-automation)
- [Panel plugin data](https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/read-data-from-a-data-source)
