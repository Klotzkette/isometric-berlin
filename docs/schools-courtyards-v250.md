# Step 10 — schools and Choriner courtyards

Version 1.0.150 follows the owner's Heesestraße photographs and the institutional
and architectural references recorded by each site. It corrects specifically
identified earlier facade estimates rather than adding another competing window
grid. Complete retained measured building parts, roofs and courtyard openings
remain the geometric sources.

- Gymnasium Steglitz: actual storeys, raised Aula window groups, brick ornament
  and the independently identified courtyard sports hall.
- John-Lennon-Gymnasium: source-bound street facade with corrected floor and
  window arrangement.
- Choriner Höfe: the modern multi-building courtyard ensemble, distinguished
  from the separate Zehdenicker Straße 7A project near Weinbergspark.

Photographs are references only; no photograph, crop or photo texture is bundled.
Small facade dimensions and materials remain documented visual estimates, not a
new architectural survey. Exact supersession receipts preserve every unrelated
site and fail open if the audited earlier source changes.

Drawn mobile detail matches desktop. Minecraft receives separately orthogonal
construction. Existing recovery behavior, city coverage, tour stops, streaming
descriptors and live memory budgets are retained.

Site-specific source receipts, remaining estimates and geometry limits:

- [Gymnasium Steglitz](steglitz-school-v250.md)
- [John-Lennon-Gymnasium](lennon-v250.md)
- [Choriner Höfe and Zehdenicker Straße 7A](choriner-hoefe-v250.md)

Verification:

- Production TypeScript/Vite build and repository Ruff formatting/checks pass.
- All 10 new Python geometry/source regressions pass.
- Full collected Python suite: **1,644 passed, 4 skipped**, with two existing
  missing-CRS warnings. The later-added site tests also pass in the focused run.
- All 107 selected Bun tests pass, including the three new sites, their older
  integrations, GPU residency, recovery, startup and lossless-data regressions.
- Production Chrome inspection covers the school fronts, Steglitz courtyard hall
  and Choriner/Zehdenicker frontage in drawn and independent native modes.
  No page errors, WebGL errors or context losses occurred in the checked route.
- WebKit with the iPhone 13 profile keeps all three site overviews ready, with
  zero WebGL errors or context losses. It reports one preload-use timing warning;
  the initial console collector counted that warning as a failure, and the
  retained reviewed report explicitly separates it from runtime errors.
- Complete offline package: **930,702,495 bytes / 887.587 MiB**, below the
  unchanged 888 MiB limit; **4,647 files**. Official release-readiness checks and
  archive verification pass. The existing 2,151 streaming descriptors remain.

These are scoped regression checks, not a guarantee against every browser/driver
failure. No runtime limit was raised to accommodate the architectural details.
