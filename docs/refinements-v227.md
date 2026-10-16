# Berlin district town halls — v1.0.127

Step 10 covers the town halls/administrative seats of the 23 boroughs before the
2001 reform. These sites also include the twelve present borough main seats.
See the [identity inventory and primary sources](townhall-inventory-v227.md).

The pass distinguishes historical brick and stone halls, modern administrative
blocks and campus arrangements. Actual source footprints, open courtyards,
building parts and roofs govern the models. Existing dedicated Steglitz and
Köpenick bodies remain authoritative. Published proposals and demolished
predecessors are not reconstructed as current buildings.

Berlin LoD2 is retained wherever available. Actual OSM polygons provide an
explicit fallback where official tile retrieval was unavailable. OSM tagged
heights/levels take precedence over a documented display estimate. These
fallbacks and unsurveyed facade subdivisions are not measured reconstructions.
Source licenses: Berlin dl-de/zero-2-0 and OSM ODbL; no photographic textures.
See [source coverage and limits](townhall-sources-v227.md) for retained geometry,
fallbacks and the six bounded peripheral support aprons.

Recognizable glazing, narrow frames, cornices, source-supported clock faces and
mapped entrance frames are static, batched fittings. Drawn windows share
geometry; native fittings are independently orthogonal. Mobile and desktop use
the same drawn detail. Existing residency/lifetime budgets and the 93-stop tour
are unchanged.

Only exactly receipted obsolete Tiergarten/Mitte facade estimates, four core
prisms and twenty-five surrounding-city owners yield to complete required
replacements. Detailed retained Mitte bodies remain authoritative. Their measured source edges and all unrelated rows
remain intact. Frozen historical fixtures are not rewritten; test-only reverse
receipts restore those rows while still auditing every unrelated live byte.

## Verification

- Main Python suite: 1,224 passed, 4 skipped; final source/receipt tests: 8 passed.
- Focused runtime tests: 35 passed; previous preservation/startup/recovery
  regressions: 83 passed. TypeScript, Ruff and production build pass.
- Release/package partition: 105 passed; readiness and local-package smoke pass.
- Production desktop Chrome: 56 views across all 23 sites, both geometry
  families and all visual modes; no page error, context loss or crash.
- Production mobile WebKit: all 23 drawn sites and the other drawn modes pass;
  direct native startup, all 23 native sites and return to drawn pass. Two
  deliberate context losses restore the same world, scene and camera.
- Actual render callbacks confirm both new families submit draws. Real walking
  succeeds in the open Tiergarten courtyard and on Hellersdorf's new support,
  with correct source-wall collision and roof heights in drawn/native modes.
- Complete extracted package: 875,826,465 bytes (835.253 MiB), within the unchanged
  836 MiB ceiling. Static facade fittings use about 1.24 MB drawn / 3.55 MB native.

One initial extended WebKit tour stalled in its JavaScriptCore Float32Array
allocation path when first switching to native after 31 drawn visits (no page
error or context-loss event); the owned test was interrupted. Direct native
startup and the separate native tour passed. The published v126 baseline passed the identical 56-view sequence and two
context recoveries. A second v227 extended run passed all 56 views, every mode transition and
two forced context recoveries; the isolated stall was not reproduced or attributed to a
confirmed cause. These are
browser-emulation checks, not a physical-phone or absolute no-crash guarantee.
