# Steglitz A103 bridge — Step 10, v1.0.126

The older ring-city export reused the central city's clipped OSM candidate
cache. This omitted 23 southern A103 ways although the original Berlin extract
contains them. The previous two flat motorway strips therefore ended near
Kieler Straße. This bounded supplement restores the missing mapped bridge and
southern approaches, and joins two existing northbound/southbound source ways
over a 150 m transition. All earlier road packets and cartographic projections
remain byte-identical. No existing owner is removed or transferred.

## Sources and limits

`geo_data/regierungsviertel/steglitz-motorway-v226-source.json` retains all
25 complete source ways, their original coordinates and tags, the raw extract
SHA-256, existing coverage and the mapped crossing roads. It derives from
[OpenStreetMap contributors, Geofabrik Berlin 29 September 2026](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
ODbL-1.0. Sixteen ways explicitly carry `bridge=yes` and `layer=1`.
Only the north approaches are clipped at z=6490; their complete original
vertices remain in the source archive. All generated geometry is inside
previously approved coverage; this adds zero coverage area.

The [federal bridge inventory](https://dserver.bundestag.de/btd/19/058/1905831.pdf)
identifies the A103 bridge over Albrechtstraße and the adjacent Kieler Straße /
Düppelmarkt structure separately from the Joachim-Tiburtius feeder and ramps.
The contractor's [Albrechtstraße bridge account](https://fuchs-bauen.de/referenzen/brueckensanierung-an-der-albrechtstrasse-berlin-8264998/)
confirms the existing prestressed structure and additional steel support work
carried out in 2023–24. Its text does not establish support coordinates; no
repeated speculative columns or reconstruction of that engineering work is
drawn. Berlin's [2025 bridge notice](https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2025/pressemitteilung.1599564.php)
confirms the distinct Joachim-Tiburtius feeder relationship to the A103.
That feeder is outside this correction and remains unchanged. These primary
texts were checked on 16 October 2026; their historical work dates are not a
claim about current closures. No external photograph was used or bundled.

The deck is a restrained recognition model, not an engineering survey. Valid
explicit OSM `width` takes priority over `est_width`, then lane-derived fallback.
Eighteen ways retain their mapped widths of 5, 6, 7, 7.5 or 11 m. Only seven
ways lack either width tag and use the established lane-derived estimate:
3.25 m per main-carriageway lane (3 m per ramp lane if needed). The evidence
records each `displayWidthM`, `widthSource` and original tag value separately;
an explicit mapped width is never replaced by a lane-count estimate. Tagged
widths remain OSM evidence, not a new kerb survey. Individual lane positions
are not surveyed. Full source bends are retained. No lane separator, turn
arrow, zebra crossing or guessed lamp
position is added. Narrow 0.18 m × 0.55 m parapets are estimated edge cues on
the mapped bridge portion, with source junctions and true ends open.

The existing flat surface is y=3.09. The deliberately documented bridge profile
is `(z,y) = (6490,3.09), (6640,9.4), (6895,9.4), (7060,3.09)`; joins between
these points are linear. The 0.4 m slab leaves six metres above the y=3 ground
at both mapped cross-street intersections. Clearance, thickness, ramp gradient
and neutral colours are display estimates, not measured elevations. The
separate native family uses two-metre orthogonal cells and quarter-metre
height steps over the same complete source course. It has no rotated smooth
deck or full-area high-resolution voxel sampling.

## Runtime and checks

Bounds are `[-3705.691,6490,-3118.251,7141.711]` in the existing viewer frame.
The missing bridge/approach corridor is about 500 m long; the limited northern
transition makes the total z extent 651.711 m. Rendered plan area is
18,980.703 m². The drawn family has 832 triangles and 1,140 parapet instances,
two renderables and 177,144 geometry/instance buffer bytes. The native family
has 757 deck runs and 1,140 parapet blocks, one renderable and 144,820 bytes.
These include geometry attributes, indices and instance arrays before the
existing v124 retirement/parking lifecycle. They do not claim total GPU driver
or JavaScript heap usage. Both have computed bounds, static transforms,
texture-free day/night materials, and the same full drawn detail on touch.
Existing residency limits and the 93-stop tour are unchanged.

`createSteglitzMotorwayV226(native)` participates in the existing optional
outline family. Constructor JSON fields are weakly retained through the
existing lossless-data plugin. The small navigation plan remains stable.
`steglitzMotorwayV226GroundAt(x,z,currentFootY,native)` returns the represented
deck only if the visitor's feet can reach it; it never raises the terrain below
the bridge. `steglitzMotorwayV226SolidAt` matches the finite slab and parapets.
Native support uses the actual rendered cell footprint and height.

The evidence receipt hashes the old outline data, full existing manifest and
all drawn/native city packets intersecting this corridor. Focused Python tests
check those bytes, complete source identities, source-plan coverage, both
underpasses and deterministic replay without the ignored raw cache. Bun tests
measure actual buffers and independent remounts, native cell support, open
underpasses and real flight-to-walking descent on and under the deck.

```sh
uv run python scripts/build_steglitz_motorway_v226.py
uv run pytest -q tests/test_steglitz_motorway_v226.py
cd src/app
bun test tests/steglitz-motorway-v226.test.ts
```

Review camera: eye `[-3195,150,7020]`, target `[-3415,9.4,6825]`, span 590 m.
Closer Albrechtstraße test: `x=-3443.2057,z=6869.0824`, deck y=9.4 (native
y=9.5), underpass y=3. The earlier comparison camera remains
`[-3340.73,8,6633.01]` with offset `[198,247.5,330]`.
