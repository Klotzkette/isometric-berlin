# Hermann-Ehlers-Platz fountain — v248

This finite addition occupies exactly the already retained fountain opening of
v247, OpenStreetMap way **775414456**. Its centre is world
`[-3546.898371, 6806.497311]`; it adds no plaza redesign or wider street coverage.
The complete source boundary remains unchanged, as do the nearby U-Bahn opening,
Spiegelwand, trees, buildings, old Steglitz details and all original packets.

## Evidence and measured limits

[The primary survey by Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/brunnenanlage-5560/),
by Susanne Kähler and Jörg Kuhn, describes the 1986 installation as a red clinker
rim with two recesses towards its base, a concrete basin, a central fountain and
two smaller jets. It gives a rim height of 0.60 m and width of 0.65 m. The
catalogue's 12 × 7 m overall dimensions differ from the retained OSM contour's
9.779 × 5.354 m oriented envelope. This discrepancy is recorded explicitly:
the mapped boundary wins spatially, and no enlarged proxy covers the preserved
plaza paving. The contour is not rounded, rescaled or simplified.

The [district project record](https://mein.berlin.de/vorhaben/2024-00949/),
last edited 20 April 2026, still describes a proposed redesign. The later
proposed flush water feature is therefore not substituted for the retained
fountain. Three restrained static opaque jet forms indicate the documented
arrangement, without claiming current pump operation.

Only source text and the retained OpenStreetMap geometry were used; no BiB
photograph, photo-derived colour, image pixels, protected plan or photographic
texture was used. OpenStreetMap credit remains © OpenStreetMap contributors,
ODbL-1.0. Source features, exact world rings, earlier source and packet SHA-256
receipts are in `hermann-ehlers-fountain-v248-evidence.json`. Both actual original
packet families were decoded: the only geometry under this opening was the old
green ground at Y=3.0, so no existing fountain is obscured or replaced.

## Geometry and integration

`hermannEhlersFountainV248.json` supplies the existing `surfaces`, `boxes` and
`nativeRows` shapes. Root adds these to the existing Steglitz shell/instance
batches, without including the new horizontal surface triangulation in the
architectural edge pass. There is no additional draw call, descriptor, material,
texture, animation loop or mobile reduction.

The exact upper rim is at Y=3.625, 0.60 m above the existing plaza finish.
Recessed lower edge strips, concrete inner faces, quiet opaque water at Y=3.18
and three small jet forms make the basin legible. The 0.08/0.16 m lower recesses,
small edge-strip thickness, water level, jet heights/spacing and colours are
explicit display estimates. The mapped upper ring and water surface are exact
polygon triangulations. Concrete and brick solids remain distinct from water
and jet colours for the separate local navigation adapter.

Native geometry is independently constructed from every completely contained
0.25 m source cell at each tier. Eight rectangle partition directions are
considered offline; the smallest exact partition is retained. No cell is
removed, added across the source boundary, or inserted across the open interior.
The concrete basin under the water is a shallow physical support, not a hidden
filled fountain block.

Payload: **23,337 B**, **88 drawn boxes + 47 triangles**, **217 native boxes**.
Additional GPU attributes are **11,764 B drawn / 16,492 B native**, within the
unchanged overall Steglitz limits. Shared primitives/materials are reused.

## Verification

Three Python tests check deterministic rebuilds, preservation hashes, exact
v247 opening equality, full source-vertex retention, complete rim/water union,
triangle orientation, source-bound edge strips and independent native occupancy
without overlaps or missing cells. Two Bun tests check both real instance
constructors, finite matrices, native orthogonality, heights, texture-free
materials and actual attribute memory. The local navigation and combined model
budgets are verified by the separate integration tests.

Suggested close view: eye `[-3531, 14, 6832]`, target `[-3546.9, 3.5, 6806.5]`.

## Adjacent U-Bahn access: audited, deliberately unchanged

The second v247 opening is centred at world `[-3570.418864, 6800.527137]`.
The retained source contains node **573213378**, named Rathaus Steglitz, at
13.3211355 / 52.4569948 with `railway=subway_entrance`, `level=-1` and
`wheelchair=no`. Stair way **346265207** records 42 steps, a handrail and bicycle
ramp between levels −1 and 0; parallel way **1105054188** records a metal
escalator. The [BVG station page and its official local map](https://www.bvg.de/de/verbindungen/stationsuebersicht/s-u-rathaus-steglitz)
confirm the station/access context but do not establish a detailed above-ground
railing or canopy profile. Current packets retain continuous ground at Y=3 in
this opening, so a faithful descending stair would require an explicitly scoped
terrain/opening correction. No false raised stair, speculative canopy or sign
placed at the underground node is added in this small release.
