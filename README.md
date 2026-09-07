# KChart Grafana Panel

Grafana panel plugin powered by [`@keneth80/k-chart`](https://github.com/keneth80/k-chart).

The panel renders Grafana numeric fields as Line, Column, Area, Scatter, or
Candlestick charts. Line and Scatter let dashboard authors switch between SVG,
Canvas, and WebGL without changing the query.

## Chart types

| Chart type  | Renderer           | Data requirement                                        |
| ----------- | ------------------ | ------------------------------------------------------- |
| Line        | SVG, Canvas, WebGL | One or more numeric fields                              |
| Column      | SVG                | One or more numeric fields                              |
| Area        | SVG                | One or more numeric fields                              |
| Scatter     | SVG, Canvas, WebGL | One or more numeric fields                              |
| Candlestick | Canvas             | Numeric fields named `Open`, `High`, `Low`, and `Close` |

Candlestick field matching is case-insensitive and also recognizes the Korean
aliases `시가`, `고가`, `저가`, and `종가`. Each OHLC role can also be mapped
explicitly from the panel editor.

## Data mapping

- The first `FieldType.time` field becomes the KChart time axis.
- Every numeric field becomes a metric series. Line, Area, and Scatter expose
  individual legend toggles; grouped Column currently uses one legend group.
- Multiple Grafana data frames are merged by timestamp.
- `field.config.displayName` becomes the legend label.
- Grafana fixed, threshold, gradient, and continuous field colors are forwarded
  to KChart. Value-based colors respect Grafana's `seriesBy` setting.
- Frames without a time field use their row index as a numeric X axis.
- Null values can be skipped or replaced with zero.
- Optional **X field** and **Y field** selectors override automatic mapping.
- Optional **Series field** pivots long-format `X / Series / Y` rows into one
  KChart series per category value.
- When several query frames contain the same category, frame names are prefixed
  so their values remain separate instead of overwriting one another.

All mapping selectors are clearable. Leaving them empty preserves automatic
mapping, so existing dashboards continue to work without option migration.

The adapter does not mutate Grafana data frames.

## Field styles and axes

The panel enables Grafana's standard field configuration editors and applies
them to KChart without requiring duplicate panel settings.

| Grafana field option | KChart behavior                                                        |
| -------------------- | ---------------------------------------------------------------------- |
| Display name         | Legend and tooltip series name                                         |
| Unit / Decimals      | Y-axis ticks and Line, Column, Scatter, Area, and Candlestick tooltips |
| Min / Max            | Shared Y-axis domain                                                   |
| Color scheme         | Series stroke, fill, or point color                                    |
| Thresholds           | Fixed horizontal guide lines when **Show threshold lines** is enabled  |
| Data links           | Links resolved for the currently hovered data point                    |

Candlestick keeps semantic up/down colors; the standard field Color setting
applies to Line, Area, Scatter, and Column series.

The **Axes** group adds optional X/Y titles and an X-axis label format (`Auto`,
time, date, date-time, or number). Time labels use the active Grafana dashboard
timezone.

KChart Panel currently uses one shared Y-axis. Fields on the same panel should
therefore use compatible units; mixed units render a warning instead of
silently implying that the first field's unit applies to every series. Separate
panels or normalize the query until multi-axis support is added. For long-format
`X / Series / Y` data, derived categories inherit the selected Y field's unit,
color mode, bounds, and thresholds. Category-specific Grafana field overrides
are not available because categories are values rather than Grafana fields.

## Data links and dashboard variables

Configure links from the Grafana panel editor under **Field > Data links**.
Hover a rendered point or column to select its original query row. When the
field has a link, KChart shows an **Open data link** trigger in the lower-right
corner of the panel. A single link opens directly; multiple links use Grafana's
standard **Data links** context menu.

KChart delegates interpolation to Grafana's prepared field link supplier, so
standard data-link macros and dashboard template variables work together:

```text
/d/target-dashboard?var-host=${__field.name}&var-value=${__value.raw}&var-service=${service}&from=${__from}&to=${__to}
```

- `${__value.raw}` resolves from the hovered source row, not a reduced value.
- `${__field.name}` and other Grafana field/data macros remain available.
- `${service}` resolves an existing dashboard template variable.
- `${__from}` and `${__to}` preserve the active dashboard time range.
- Long-format category series inherit the mapped Y field's links while keeping
  each category row's value context.

Data links are supported across SVG, Canvas, and WebGL renderers. Grafana field
actions are not included yet. Keep **Show tooltip** enabled because the tooltip
hit-test identifies the source point used by the link.

When **Null values** is set to `Zero`, the chart may display a substituted zero
while Data Link macros still resolve the original source-row value. This keeps
Grafana link semantics intact and avoids sending a synthetic value.

## Runtime recovery and renderer fallback

KChart Panel keeps the chart container mounted while data is loading or a
renderer reports an error. Initial loading, streaming-without-data,
configuration errors, data-source errors, and runtime rendering failures use
separate Grafana status views.

For Line and Scatter charts, selecting WebGL enables automatic recovery:

- If the browser cannot create a WebGL context, the panel renders with Canvas.
- Every generated WebGL series surface and shader program is validated and
  monitored independently.
- If WebGL throws while rendering, updating, resizing, or loses its context,
  the panel destroys the failed controller and rebuilds once with Canvas.
- A visible status message identifies the fallback, while
  `data-requested-renderer` and `data-renderer` expose requested and active
  renderers for diagnostics and browser tests.
- If both renderers fail, the chart shows an actionable error with a **Retry**
  button instead of crashing the dashboard.

Detailed errors are written to the browser console without including query
data. Asynchronous worker and animation failures that KChart handles internally
cannot yet be surfaced by the plugin; a future KChart core error callback will
complete that path.

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

The provisioned **Provisioned KChart Panel dashboard** includes Line, Area,
Column, Scatter, and Candlestick examples using their compatible SVG, WebGL,
and Canvas renderers.

The Docker development environment permits the unsigned plugin ID `keneth80-kchart-panel`.
If port 3000 is already in use, run `GRAFANA_PORT=3010 npm run server` and open
`http://localhost:3010`.

## Verification

```bash
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

The panel uses concrete KChart core and line-renderer entry points so unrelated
maps, hierarchy charts, and datasets are not included in the plugin bundle.
See [Bundle optimization verification](docs/bundle-optimization.md) for the
measured result, repeatable commands, and a manual Grafana checklist.

## Current capabilities

- Line and Scatter with SVG, Canvas, and WebGL renderers
- SVG Column and Area charts
- Canvas Candlestick charts with automatic OHLC field detection
- Explicit X, Y, categorical Series, and Candlestick OHLC field mapping
- Long-format `Time / Series / Value` data pivoting
- Grafana units, decimals, Min/Max, colors, and thresholds
- Grafana Data Links with point-level values, time range, and dashboard variables
- WebGL availability detection, Canvas fallback, context-loss recovery, and retryable runtime errors
- Axis titles, X-axis time/number formats, and dashboard timezone formatting
- Time-series and numeric-index X axes
- Multiple numeric fields and data frames
- Grafana dark/light theme styling
- Legend selection, tooltip, grid, curve, animation, and line width options
- Optional KChart LTTB downsampling
- `updateData`, `resize`, and `destroy` lifecycle integration

Maps, Three.js, CesiumJS, annotations, alert-state overlays, and Grafana field
actions are outside the current panel scope.

## Distribution

Grafana requires distributed plugins to be signed. Local development does not require a signature.

### Build and validate a distribution ZIP

Create an unsigned development package and verify its structure:

```bash
npm run package:plugin
npm run verify:package
npm run validate:plugin
npm run validate:plugin:full
```

The generated archive, SHA-256 checksum, unpacked plugin, and package metadata
are written to `artifacts/`. The archive has one top-level directory matching
the plugin ID, as required by Grafana. `validate:plugin` is the fast NPX check;
`validate:plugin:full` runs Grafana's Docker validator with the additional
security scanners available in that image. The validator image currently ships
for `linux/amd64`; Apple Silicon runs it through Docker's architecture emulation.

For a signed build, first obtain approval and an access-policy token from
Grafana, then run:

```bash
export GRAFANA_ACCESS_POLICY_TOKEN="..."
npm run build
npm run sign
REQUIRE_SIGNED=1 npm run package:dist
npm run verify:package
```

Never commit the access-policy token. Create a protected GitHub Environment
named `grafana-release`, require reviewer approval, and store the token as its
`GRAFANA_ACCESS_POLICY_TOKEN` environment secret. Scope the access policy to the
`keneth80` realm and `plugins:write` only. Version tags matching `v*` run the
release workflow, which creates a draft release, publishes and verifies build
provenance, then validates the final ZIP.
Pull requests and main-branch pushes never receive signing credentials: they
create an unsigned package and run the Docker Grafana plugin validator.

Before Grafana grants signing access for a new public plugin, leave the
`grafana-release` environment variable `GRAFANA_SIGN_RELEASES` unset (or set it
to `false`). The protected tag workflow then creates the unsigned draft release
Grafana expects for initial review, even when a token is already stored. After
Grafana approves the plugin for signing, set `GRAFANA_SIGN_RELEASES=true`; later
tags then require the token and verify that the package is signed. If package,
provenance, or validator checks fail after the build action creates its draft,
the workflow removes that invalid draft while leaving the tag available for
diagnosis.
Failed E2E jobs retain Playwright reports, traces, and the Grafana server log as
GitHub Actions artifacts for diagnosis.

The plugin ID prefix must match an existing Grafana Cloud account. Before the
first public submission, create or select the `keneth80` Grafana Cloud account;
otherwise the official validator reports the plugin ID as unregistered.

- [Plugin signing](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin)
- [Build automation](https://grafana.com/developers/plugin-tools/publish-a-plugin/build-automation)
- [Panel plugin data](https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/read-data-from-a-data-source)
