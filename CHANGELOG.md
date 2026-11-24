# Changelog

## 1.0.7 (2026-11-24)

- Serialized the Grafana 12.3 release browser suite to avoid the minimum
  supported server timing out while several option editors initialize at once;
  the current Grafana suite remains parallel.

## 1.0.6 (2026-11-24)

- Updated `@keneth80/k-chart` from 1.26.0 to 1.28.0 and exposed adaptive
  Auto, pixel min/max, and LTTB downsampling with configurable points per pixel,
  while migrating dashboards saved with the earlier boolean option to preserve
  their LTTB behavior.
- Added an opt-in time-axis drag selection that updates Grafana's dashboard
  time range through the standard panel callback.
- Preserved duplicate Scatter X values, stable-sorted only out-of-order input,
  and kept point-level Data Links bound to their original source rows.
- Improved sparse-series tooltip lookup and distinguished all-null data from
  finite chart data without discarding line gaps.
- Kept chart controllers mounted through loading and query-error overlays,
  and updated dynamic series colors only when their resolved style changes.
- Hardened tagged releases with exact tag/version checks, quality gates on the
  tagged commit, pinned workflow actions and images, Grafana 12.3/13.1 browser
  tests, provenance attestation, and incomplete-draft cleanup.

## 1.0.5 (2026-10-25)

- Reissued the approved plugin through the protected Grafana release
  environment so the catalog package includes its cryptographic signature.
- Updated vulnerable transitive build dependencies required by the current
  Grafana plugin validator without changing the runtime bundle.
- Preserved the chart behavior and runtime dependency versions from 1.0.4.

## 1.0.4 (2026-09-07)

- Expanded the provisioned dashboard with working Line, Area, Column, Scatter,
  and Candlestick examples using compatible SVG, WebGL, and Canvas renderers.
- Added deterministic coverage that keeps the complete supported chart example
  set and its renderer assignments from drifting.
- Documented the provisioned example dashboard for local plugin evaluation.
- Updated transitive `fast-uri` and `qs` packages to releases accepted by the
  current Grafana security validator.

## 1.0.3 (2026-09-01)

- Updated `@keneth80/k-chart` from 1.21.0 to 1.26.0, including bounded
  worker rendering, coalesced zoom updates, and faster numeric LTTB
  processing.
- Verified the existing Grafana chart types, renderer fallbacks, field
  mappings, axis options, and Data Links against KChart 1.26.0.
- Kept the panel's existing boolean downsampling option on its compatible
  LTTB behavior; the new pixel-column min/max strategy is available in the
  dependency for a future panel option update but is not exposed yet.

## 1.0.2 (2026-08-18)

- Removed the issue-tracker metadata link that the Grafana catalog validator
  could not retrieve reliably during the initial plugin review.
- Preserved the v1.0.1 narrow-panel threshold and Column boundary fixes.

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
