# KChart Panel

KChart Panel brings the hybrid rendering pipeline from
[`@keneth80/k-chart`](https://github.com/keneth80/k-chart) to Grafana dashboards.
The same query can be rendered with SVG, Canvas, or WebGL from the panel options.

## Data mapping

- The first Grafana time field becomes the horizontal time axis.
- Every numeric field becomes a selectable KChart line series.
- Multiple query frames are merged by timestamp.
- Grafana display names and fixed field colors are preserved.
- Frames without a time field use their row index as the horizontal axis.
- Null values can be skipped or replaced with zero.

## Panel options

- **Renderer**: SVG, Canvas, or WebGL
- **Show legend**, **Show grid**, and **Show tooltip**
- **Smooth SVG line** for the SVG renderer
- **Animate updates**
- **LTTB downsampling** for dense line data
- **Line width**
- **Null values**: skip invalid values or replace with zero

For live examples and the underlying chart API, visit the
[KChart Playground](https://k-chart-playground.vercel.app/).

## Requirements

- Grafana 12.3 or later
- A Grafana query that returns at least one numeric field

The plugin does not mutate Grafana data frames. Maps, Three.js, CesiumJS,
annotations, alert-state overlays, and Grafana data links are outside the first
release.
