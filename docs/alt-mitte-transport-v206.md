# Alt-Mitte road paint and signal approaches — v206

Step 10 refines transport presentation within the frozen pre-2001 Mitte
selection from v169. Wedding and Tiergarten are outside this pass. The exact
ALKIS polygon and its documented 310 m² historical-boundary qualification remain
unchanged. Road surfaces, curbs, sidewalks, buildings, all earlier source arrays
and the 93-place tour remain intact.

The retained 29 September 2026 Geofabrik Berlin PBF supplies geometry and tags,
© OpenStreetMap contributors, ODbL-1.0. The bounded source receipt contains 9,762
complete relevant way/node records, including unsimplified coordinates. Raw
source geometry can cross the selection edge; every delivered paint ribbon and
every native pixel is tested wholly inside the selection and source carriageway.
The source, boundary, existing street and signal payloads, core ground grid and
outer-ground profile retain independent SHA-256 receipts.

## Source distinctions and finite coverage

The OSM [crossing-marking specification](https://wiki.openstreetmap.org/wiki/Key:crossing:markings)
distinguishes zebra bars from dashed/solid crossing borders and from absent or
unspecified markings. A signal tag alone does not justify zebra paint. This pass
renders 29 explicitly tagged zebra crossing owners and 411 explicitly tagged
dashed crossing owners. Separate nodes already covered by a crossing way are
deduplicated (223 nodes). Unknown styles, unmarked crossings, elevated routes and
two crossing nodes without a connected road receive no invented paint.

The [lane-marking specification](https://wiki.openstreetmap.org/wiki/Key:lane_markings)
provides the positive/negative evidence. Only 125 ways explicitly carrying
`lane_markings=yes` and a usable mapped lane count receive additional dividers.
Thirteen overlapping axes already represented by DistrictStreets are retained
without a duplicate. Fourteen exact older inferred marking axes lie entirely
within 20 cm of source roads explicitly tagged `lane_markings=no`; the small
correction receipt identifies their legacy array index and every supporting OSM
way. Only these false inferred marks are suppressed. The original JSON, source
arrays and all road surfaces remain unchanged.

Another 305 source-mapped, closed, striped road-restriction polygons receive
contained outlines and hatching. Their exclusion footprint is source geometry;
hatch angle and spacing are display estimates. Unsupported symbols, zigzags and
shark-tooth stop lines are retained in the source receipt without guessing their
appearance. [Road-marking tag reference](https://wiki.openstreetmap.org/wiki/Key:road_marking).

This is a bounded evidence-based improvement, not a complete current survey of
every painted stripe. Untagged paint is not inferred. Crossing widths without a
width tag use an explicit 3 m display width; zebra bars/gaps use 0.5 m. Lane dash
spacing, small paint widths, hatch spacing and colors are display conventions.

## Signals, placement and ground

The scoped signal set contains 430 real OSM source nodes. All 262 previously
represented source and physical positions remain exact; 168 missing source nodes
are added. New centerline control nodes use the existing safe-verge method and
retain at least 0.5 m road clearance after decimetre quantisation when relocated.
Source positions remain distinct from physical pole display estimates. Every
non-island pole is outside the resolved source carriageway; directly tagged
refuge islands keep their separate status.

The [signal-direction specification](https://wiki.openstreetmap.org/wiki/Key:traffic_signals:direction)
controls 232 approaches on connected source ways. Another 135 use tagged one-way
traffic direction. For 63, the direction is explicitly a right-hand-traffic
display inference from the chosen verge. Heads face arriving traffic along the
road tangent, instead of facing sideways from the verge toward the centerline.
This does not claim surveyed pole hardware or live signal state. Animated phases
are an illustrative cycle, not real junction control or a synchronized traffic
simulation.

The source core ground-height cells are copied losslessly into a bounded 137 KiB
crop. Core drawn paint uses the same bilinear samples as the delivered road
skins; native paint uses the same nearest-height cells as the ground blocks.
Outside the original core, both modes use the retained outer ground datum and
the shared official Weinberg relief field. Native runs split at every possible
4 m terrain step and at the core/outer ownership seam. Paint lifts are 0.205 m
above the core drawn baseline, 0.025 m above native core ground and 0.115 m above
outer ground, clearing their existing road skins. Pole bases follow the same
ground owners. No new district terrain or broad asphalt plate is generated.

## Rendering and tests

The payload has 49 independently culled 512 m cells. Drawn presentation uses
16,545 indexed paint ribbons / 66,180 vertices / 1,191,240 geometry-buffer bytes.
Minecraft uses 29,562 orthogonal paint rectangles / 118,248 vertices / 2,128,464
bytes. Native quarter-metre pixels are clipped offline by their full footprint
against source road, district and, for restriction hatching, the exact owner.
Adjacent pixels are merged losslessly. Neither factory creates the other mode's
geometry. Touch and pointer use identical detail. No textures, per-frame paint
work, new city residency budget, hidden solid fill or per-object update loop is
introduced.

### Exact drawn grass / road seams

Visual review at Universitätsstraße found an older source-ownership conflict:
4 m coarse grass blocks use one height per original run, while retained exact
roads use their source triangles draped over the smooth height grid. In a few
places the grass top therefore occluded an already present road. The new paint
was on that exact road (about 6.6 cm above its triangles), not floating over a
missing road. This correction removes only the proven false coarse grass volume
under those existing road/pavement triangles where the grass is at least 5 mm
higher. All original road vertices, source files and unrelated terrain remain.

`build_alt_mitte_ground_seams_v206.py` retains SHA-256 receipts for every input
and records the original source grass run, unchanged height, exact overlap area
and road owner. Its offline intersection is limited to old Mitte inside the
original core: 28,158.578 m², 1,914 source runs, 5,401 cells grouped into 2,294
contiguous spans. Outside each overlap, the retained grass complement keeps the
original X/Z boundary, height and color. Existing authored holes and differently
graded hosts win. Native Minecraft is unchanged.

The runtime reuses the existing exact land-complement writer with optional span
and expected-top fields; legacy water and foundation records retain their
one-cell behavior. The shared wire-format/material flag is not water provenance.
The wrapper has separate names and ownership metadata. On the full source-ground
fixture the fixed addition uses 42 independently culled meshes, 223,992 exactly
indexed vertices and 8,933,688 geometry bytes, plus 21,888 extra instance bytes
from splitting unaffected remainders. Assembly measured about 95 ms locally.
The runtime JSON is 1,970,837 bytes; the source audit is 428,807 bytes. No terrain
pipeline, texture, city residency setting or device-quality branch is added.

`createAltMitteTransportV206(native)` returns the paint family.
`withAltMitteTrafficV206(street)` merges by exact OSM identity, retaining every
unrelated signal and the complete original source array. The resulting drawn
set contains 1,496 signals. `altMitteSignalPayloadV206()` supplies only the 430
scoped records to the native signal factory. The separate tiny
`altMitteTransportCorrectionsV206.json` supplies the fourteen precise legacy
marking exclusions.

Useful visual checks in viewer X/Z metres: Münzstraße zebra way `1071007437`
near `[2481.3,-574.8]`; Auguststraße way `1184813621` near `[1673.4,-845.8]`;
Fehrbelliner Straße way `1215067169` near `[2188.3,-1588.2]` tests the Weinberg
slope; Universitätsstraße way `1447255646` near `[1415.0,14.5]` tests the core.

Focused verification independently checks positive tagging, full-ribbon/full-
native-pixel road containment, historical scope, native orthogonality and terrain,
all 262 preserved signal anchors, new-pole clearance, heading polarity, exact
legacy correction ownership and fixed memory counts.

```sh
uv run python scripts/build_alt_mitte_transport_v206.py
uv run pytest tests/test_alt_mitte_transport_v206.py -q
bun test src/app/tests/alt-mitte-transport-v206.test.ts
uv run python scripts/build_alt_mitte_ground_seams_v206.py
uv run pytest tests/test_alt_mitte_ground_seams_v206.py -q
bun test src/app/tests/alt-mitte-ground-seams-v206.test.ts src/app/tests/drawn-water-boundary.test.ts
```

Use `--extract` only to recreate the committed bounded source receipt from the
retained PBF/GPKG. Normal regeneration uses the committed receipt and ground
sources. Root release integration owns animation, versioning and broad browser
verification.
