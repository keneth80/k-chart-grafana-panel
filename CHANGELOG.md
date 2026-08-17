# Changelog

## 1.0.1 (2026-08-17)

- Fixed narrow-panel layout so threshold labels remain fully visible while
  preserving a usable plot area.
- Fixed grouped Column charts so the first and last bars stay inside the plot
  area, including narrow multi-series panels and Grafana time-range edges.
- Added unit and Grafana E2E regression coverage for threshold-label and Column
  boundary calculations.
- Updated transitive build dependencies to patched releases accepted by the
  Grafana plugin validator.

## 1.0.0 (2026-08-02)

- Added a Grafana panel backed by `@keneth80/k-chart`.
- Added SVG, Canvas, and WebGL line renderer selection.
- Added Line, Column, Area, Scatter, and Candlestick chart type selection.
- Added SVG, Canvas, and WebGL Scatter rendering.
- Added automatic English and Korean OHLC field detection for Candlestick charts.
- Added explicit X, Y, categorical Series, and Candlestick OHLC field mapping.
- Added long-format `X / Series / Y` pivoting in the Grafana DataFrame adapter.
- Added Grafana standard field options for display names, units, decimals,
  Min/Max, colors, and thresholds.
- Added KChart axis titles, X-axis date/time/number formatting, dashboard
  timezone support, and threshold guide-line toggles.
- Added formatted Line, Area, Scatter, Column, and Candlestick tooltips.
- Added a visible shared-axis warning for incompatible mixed units.
- Added Grafana Data Links for hovered SVG, Canvas, and WebGL values, preserving
  original row context for field macros, time-range macros, and dashboard variables.
- Added a direct single-link trigger and Grafana context menu support for multiple links.
- Added distinct loading, streaming, configuration, query, empty-data, and runtime error states.
- Added WebGL availability detection and automatic Canvas fallback for Line and Scatter.
- Added per-series WebGL surface, shader-program validation, and context-loss monitoring.
- Added WebGL context-loss recovery plus guarded render, update, and resize lifecycles.
- Added retryable Grafana runtime error alerts and requested/active renderer diagnostics.
- Added deterministic plugin ZIP packaging, structure verification, checksums,
  Docker-based full Grafana plugin validation, signed release support, and
  provenance attestation verification.
- Isolated signing credentials to the protected release environment and added
  E2E failure reports plus Grafana server-log artifacts.
- Added an explicit `GRAFANA_SIGN_RELEASES` release gate so the same protected
  workflow supports unsigned initial review and signed post-approval releases.
- Fixed stale WebGL selections when switching to fixed-renderer chart types and
  kept multi-link menus compatible with both Grafana 12.3 and Grafana 13 APIs.
- Added Grafana DataFrame conversion for time-series and numeric-index data.
- Added legend, grid, tooltip, curve, animation, line width, null handling, and LTTB options.
