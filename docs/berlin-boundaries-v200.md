# Berlin boundary hairlines — v1.0.100

Two independent, non-collidable cartographic overlays preserve the complete
official source course. They do not add ground, structures, a district fill or
new tour stops.

The muted grey-green line is the **current state boundary** from
`alkis_land:landesgrenze`, one complete ALKIS multipolygon feature. All five
source rings and all 9,581 source vertices remain. The measured source perimeter
is 234.414 km. The [official metadata](https://daten.berlin.de/datensaetze/alkis-berlin-landesgrenze-wfs-07b1347b)
identifies Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und
Wohnen and dl-de/zero-2-0; metadata update 22 September 2026.

The thin red line is the complete **mapped Grenzmauer layer for 1989**:
`berlinermauer:a_grenzmauer`, 118 features, including 116 Vorderlandmauer features
and two features explicitly called `Unterwassergrenze`. These two historical
water-boundary sections total 1.981 km; the annotation does not imply a concrete
wall across the water. All 1,686 source vertices and every separate part remain.
Summed source length is 161.991 km, including approximately 8.5 m of overlapping
mapped segments. No union, simplification or fabricated gap connection is used.

The historical line is **not** the contemporary state border, the
Hinterlandmauer, or the separate `c_politischegrenze` layer. The latter consists
of 34 expressly differing political-border pieces and is not mixed into the
red line. Mapped openings remain openings.

[Official historical metadata](https://daten.berlin.de/datensaetze/verlauf-der-berliner-mauer-1989-wfs-3dcda64c)
credits Forum für Geschichte und Gegenwart e.V., made available through
Geoportal Berlin under dl-de/zero-2-0. The
[official explanatory sheet](https://gdi.berlin.de/data/berlinermauer/docs/mauer.pdf)
describes hand digitization from aerial imagery of 25 April 1989 on
1:5,000/1:10,000 mapping and warns that this is a preliminary representation, not
a cadastral survey. “Complete” here means every feature delivered by that source,
not a claim that every historic physical opening is known exactly.

## Geometry, ownership and reproduction

`scripts/build_berlin_boundaries_v200.py` requests WFS 2.0 in EPSG:25833 without
a bounding-box filter and checks `numberMatched == numberReturned == features`:
one state feature and all 118 historical features. Original full feature
responses are retained losslessly in
`geo_data/regierungsviertel/berlin-boundaries-v200-source.json.gz`. Service URLs,
feature counts, individual part/vertex ranges, raw-response hashes and the
receipt hash are in `berlin-boundaries-v200-evidence.json`.

Every source XZ vertex is preserved at double precision in the constructor
source. Straight source segments are only subdivided collinearly to a maximum
of 24 m for terrain sampling. No line crosses from one source part to another.
Rendering uses the existing `terrainGroundAt` helper plus a 22 cm display offset;
outside its measured terrain the existing y=3 m outline baseline applies.
The native mode keeps the exact geographic XZ course for this cartographic
overlay and samples its native terrain height. It adds no smooth building double.

`createBerlinBoundariesV200(native=false)` in `BerlinBoundariesV200.ts` creates
exactly two indexed `LineSegments` objects: state opacity 0.40, historic red
opacity 0.64, one-pixel width, no depth write/test and no photographic texture.
This follows the existing unobtrusive Ringbahn overlay convention. Positions and
indices together occupy **459,316 bytes** per live representation. Bounds are
computed, transforms frozen and ordinary scene disposal owns both geometries and
both materials. There is no frame loop, animation or second representation cache.
The viewer explicitly excludes only the two `berlinBoundariesV200` line objects
from architectural-ink stabilization and distance fading. Otherwise that pass
would overwrite their intended depth test and hide the red annotation. Existing
unrelated cartographic and architectural lines retain their previous treatment.

Constructor-only weak fields in `berlinBoundariesV200.json` are `stateXz`,
`stateSegments`, `wallXz`, `wallSegments`. The factory copies them into owned typed
buffers and retains no source-array closures. `berlinBoundariesV200Scope.json`
contains only the extent `[-20636.96142828,-17259.27,26286.553,20479.34]`;
it is not a walkable/filled footprint.

```sh
uv run python scripts/build_berlin_boundaries_v200.py
uv run pytest -q tests/test_berlin_boundaries_v200.py
cd src/app
bun test tests/berlin-boundaries-v200.test.ts
```

Python tests check WFS completeness, every original source vertex and part,
collinear subdivision, exact index connectivity and total lengths. Both native
and drawn Bun checks verify the complete buffers, ground sampling, material
settings, culling bounds, frozen transforms and disposal. No old source packet
or scene geometry is changed by this addition.
