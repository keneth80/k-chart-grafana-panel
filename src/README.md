# KChart Panel

KChart Panel brings the hybrid rendering pipeline from
[`@keneth80/k-chart`](https://github.com/keneth80/k-chart) to Grafana dashboards.
The same query can be rendered as Line, Column, Area, Scatter, or Candlestick.
Line and Scatter support SVG, Canvas, and WebGL renderer selection.

## Data mapping

- The first Grafana time field becomes the horizontal time axis.
- Every numeric field becomes a KChart metric series. Line, Area, and Scatter
  expose individual legend toggles; grouped Column uses one legend group.
- Multiple query frames are merged by timestamp.
- Grafana display names, units, decimals, Min/Max, colors, and thresholds are
  preserved.
- Frames without a time field use their row index as the horizontal axis.
- Null values can be skipped or replaced with zero.
- **X field** and **Y field** can override the automatic field selection.
- **Series field** splits long-format rows into a separate series per category.

## Panel options

- **Chart type**: Line, Column, Area, Scatter, or Candlestick
- **Renderer**: SVG, Canvas, or WebGL for Line and Scatter
- **X field**, **Y field**, and optional categorical **Series field**
- **Open**, **High**, **Low**, and **Close field** overrides for Candlestick
- **Show legend**, **Show grid**, and **Show tooltip**
- Optional **X-axis title**, **Y-axis title**, and **X-axis format**
- **Show threshold lines** converts Grafana thresholds into KChart guide lines
- Grafana **Data links** resolve against the currently hovered source row
- With `nullMode: zero`, Data Link macros use the original source-row value rather
  than the zero substituted only for rendering
- **Smooth SVG line** for the SVG renderer
- **Animate updates**
- **LTTB downsampling** for dense line data
- **Line width**
- **Null values**: skip invalid values or replace with zero

## Runtime states

The panel distinguishes initial loading, streaming without data, query errors,
invalid field mappings, empty numeric data, and renderer failures. Runtime
errors keep the chart surface mounted and provide a **Retry** action.

WebGL Line and Scatter automatically fall back to Canvas when WebGL is
unavailable, throws during rendering, fails during update/resize, or emits a
`webglcontextlost` event. Each series canvas and committed shader program is
validated and monitored rather than assuming one healthy surface represents
the whole chart. The panel displays the active fallback renderer and keeps the
dashboard usable. Errors
from asynchronous workers that KChart handles internally require a future
KChart core error callback.

Candlestick expects numeric fields named `Open`, `High`, `Low`, and `Close`.
Field matching is case-insensitive and also accepts `시가`, `고가`, `저가`, and
`종가`. Any role can be selected explicitly when query field names use another
convention. Empty field selectors keep automatic mapping enabled.

The panel uses one shared Y-axis. Use compatible units across visible numeric
fields; mixed units display a warning. Grafana Unit and Decimals format Y-axis
ticks and every chart tooltip, while Min/Max define the shared axis domain.
Fixed, threshold, gradient, and continuous color modes are supported. In
long-format data, category series inherit the mapped Y field configuration.

Configure Data Links in Grafana's **Field** options. Hover a chart point to
show the panel's link trigger. The link supplier receives the original row
index, so `${__value.raw}`, `${__field.name}`, `${__from}`, `${__to}`, and
dashboard variables such as `${service}` are interpolated by Grafana. One link
opens directly; multiple links use Grafana's standard context menu.
Keep **Show tooltip** enabled so the chart can identify the source point for
the link.

For live examples and the underlying chart API, visit the
[KChart Playground](https://k-chart-playground.vercel.app/).

## Requirements

- Grafana 12.3 or later
- A Grafana query that returns at least one numeric field

The plugin does not mutate Grafana data frames. Maps, Three.js, CesiumJS,
annotations, alert-state overlays, and Grafana field actions are outside the
first release.
