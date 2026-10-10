# Step 10 — old Mitte streets and Urania, v1.0.106

This bounded refinement covers source-tagged road markings and traffic signals
inside the frozen old Mitte district, excluding Wedding and Tiergarten, plus the
separately requested Urania facade and Bernar Venet arc. It adds no coverage or
tour stops and changes no city residency limit or mobile detail profile.

- [Transport source evidence, exact scope and geometry budgets](alt-mitte-transport-v206.md)
- [Urania, supplied photographs, measured shell and arc](urania-arc-v206.md)
- [Immutable v1.0.105 preservation audit](geometry-preservation-v206.md)

The road pass adds 29 positively tagged zebra crossing owners, 411 marked
crossing borders, 125 lane-marked ways and 305 mapped restriction polygons.
Every drawn ribbon and every orthogonal native paint pixel is contained within
both the source carriageway and old-district selection. Fourteen exact older
inferred marking axes are corrected only where explicit `lane_markings=no`
source evidence covers their entire course; original source data remains.
All other road surfaces, sidewalks, raised curbs and edges remain byte-identical.

A production-viewer check exposed older coarse grass obscuring the retained
road skins. The bounded correction removes only their independently proven
overlap: 28,158.58 m² across 1,914 original grass runs inside old Mitte. The
outside grass retains its original height, thickness and color; every source
road and pavement vertex remains unchanged. Offline preparation gives 2,294
run spans, 42 locally culled meshes and 8,955,576 additional buffer bytes.
Minecraft terrain is unchanged. The shared complement writer retains its old
default behavior, verified against the existing water, James-Simon-Galerie and
Hauptbahnhof tests.

All 262 previously represented old-Mitte signal anchors remain, with 168 missing
anchors added. The full drawn set is now 1,496 signals. Scoped heads face the
mapped approach direction, with thin forward lenses and visors. Native mode has
430 scoped block-native signals. Signal phases are illustrative, not real-time
junction information. Visible phase changes update at most four times per second
and invalidate only color rendering, never the shadow atlas. Hidden/offscreen
signals cause no color uploads. Reduced-motion and lights-off settings work in
both representations. A latched invalidation survives frame-cadence throttling.

Urania replaces only its documented inaccurate older proxies and matching coarse
source owner. Its complete measured shell, original high roof and neighboring
Lützowplatz detail remain; the photographed recess, column rhythm, mirror grid,
yellow UraniaBerlin panel and magenta Denksporthalle lettering are procedural.
Photograph-derived dimensions are estimates rather than claimed surveys. Neither
supplied photograph is bundled as a texture.

The portable archive remains complete: the final v206 package measures
868,322,114 bytes (828.10 MiB), with an archive-only ceiling of 829 MiB. This does
not raise live memory or scene-residency limits.

Constructor-only paint and model arrays use the existing exact weak decoding
cache; both modes retain full detail. Native paint is clipped and merged offline,
with no runtime rasterization or enlarged resident-city budget.

## Release verification

Focused tests cover source semantics and containment, actual pole clearance,
terrain, native axes, exact earlier anchors, retained non-Urania geometry,
recessed navigation, visible-only light cycles and deterministic regeneration.
The complete Python suite passed: 1,195 passed, 4 skipped. The complete Bun run
covered 3,165 tests: 3,155 passed initially; its ten historical ownership/count
expectations were reconciled through exact Urania transfer receipts without
changing the older reference hashes. All 121 tests in the five affected files
then passed, including all ten cases. Dedicated signal, paint, source and
preservation checks also passed. The ground-seam correction is verified separately
below because it followed the broad suite.

The final production build, release-readiness check and local-package smoke
check passed. The final Chrome and WebKit iPhone-profile viewer runs passed
in Day, Night, Snowstorm and Minecraft, with all 49 paint cells and both new
Urania/arc groups present, no page errors and no lost WebGL context. Screenshots
at Universitätsstraße, the Weinberg slope and Urania were inspected. WebKit's iPhone profile is an emulation,
not a physical iPhone memory-pressure test.

The final seam checks passed: two independent Python source/area tests, eight
Bun seam/water tests including upward cap winding, and the previous 30 water,
James-Simon-Galerie, Hauptbahnhof and initial-water regressions. The complete
source-JSON round-trip and production cache suite passed ten tests, including
single-literal packed complements. Ruff formatting/lint and TypeScript passed.
