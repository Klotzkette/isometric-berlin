# U-Bahn names and mapped public accesses V326

Step10, release1.0.207. This finite supplement inventories the complete current
BVG U-Bahn network and constructs individually selected mapped public accesses.
It does not regenerate a neighbourhood, change a station building, or remove
any old ground, stair, roof, path or navigation owner.

## Evidence and complete accounting

The nine current primary BVG line pages
[U1](https://www.bvg.de/de/verbindungen/linienuebersicht/u1),
[U2](https://www.bvg.de/de/verbindungen/linienuebersicht/u2),
[U3](https://www.bvg.de/de/verbindungen/linienuebersicht/u3),
[U4](https://www.bvg.de/de/verbindungen/linienuebersicht/u4),
[U5](https://www.bvg.de/de/verbindungen/linienuebersicht/u5),
[U6](https://www.bvg.de/de/verbindungen/linienuebersicht/u6),
[U7](https://www.bvg.de/de/verbindungen/linienuebersicht/u7),
[U8](https://www.bvg.de/de/verbindungen/linienuebersicht/u8) and
[U9](https://www.bvg.de/de/verbindungen/linienuebersicht/u9), inspected on
8November2026, list170 distinct currently served station names. The
[BVG U6 northern reconstruction account](https://www.bvg.de/de/unternehmen/herzensprojekte/u6-nordstreckensanierung)
and its current station records retain Alt-Tegel, Borsigwerke, Holzhauser Straße,
Otisstraße and Scharnweberstraße. Those five temporarily unserved stations are
included, giving175. Their inclusion does not imply that trains currently run
there. Current names include Anton-Wilhelm-Amo-Straße and the Campus für
Demokratie addition. Closed Französische Straße is not revived.

The geometry evidence is the retained Geofabrik Berlin OSM extract of
29September2026, ©OpenStreetMap contributors, ODbL1.0. The complete relevant
coordinates, IDs, tags, stop-area associations and primary-name crosswalk are
retained in `geo_data/regierungsviertel/ubahn-access-v326-source.json.gz`.
Neither the earlier clipped candidate GPKG nor a nearest-station guess replaces
that full original PBF. Geometry is a dated retained snapshot, not a claim of
exhaustive current construction-site surveying. The
[VBB download page](https://unternehmen.vbb.de/digitale-services/datensaetze/)
explicitly dates its separate entrance CSV to2021; that CSV is not used as a
current geometry source here.

The retained708 `railway=subway_entrance` nodes have1308 connected original
footway/stair ways, including450 step ways.687 entrance nodes have positive
U-Bahn stop-area membership or an explicit matching station name; no station
is assigned merely because it is close. Of708 nodes:

| Treatment | Nodes |
| --- | ---: |
| New source-bound recognition fittings | 622 |
| Exact existing authored accesses retained | 22 |
| No positive current U association, including S-only sites | 21 |
| Explicit non-surface/indoor/no-marker exclusions | 19 |
| No supported incident direction in the retained source | 24 |

The new622 entrances belong to163 stations.317 have a positively descending
external stair path;280 of those retain an explicit original step count.
Other signs do not invent stairs, lifts or an underground continuation.
Existing v228 Rosenthaler Platz, v261 Naturkundemuseum/Brandenburger Tor,
v281 Oranienburger Tor, Unter den Linden and Zoo O accesses remain untouched.

Görlitzer Bahnhof, Bülowstraße, Olympia-Stadion, Oskar-Helene-Heim,
Louis-Lewin-Straße and Biesdorf-Süd have no such entrance nodes in this retained
source. Wittenbergplatz, Wutzkyallee and Wittenau do not yield a newly admissible
surface fitting after the stated direction/level checks. These remain explicit
inventory gaps; their existing station buildings are preserved. Unter den
Linden, Naturkundemuseum and Oranienburger Tor instead retain their already
authored source-bound accesses. This supplement does not claim175 newly
surveyed station entrances or replace missing evidence with guessed locations.

## Geometry and interpretation

Every new access retains its original source point, complete incident path,
incline direction, station association and tagged level. Descending stairs
retain every source centreline vertex, including turns. Original tagged width
and step count take precedence. Untagged2.3m widths, missing counts derived
from0.30m going,0.17m risers and a0.4m lower landing are explicit display
estimates. Nothing beyond the mapped path is promoted into a railway passage.

Blue U/name panels, pole offsets, standard small sections and colours are
procedural recognition estimates, not a photographic assertion about each
individual historic portal. A two-sided geometric alphabet prints the actual
current BVG name without downloaded fonts, images, textures or runtime media.
Names are not attached to S-only Nordbahnhof, Oranienburger Straße or Anhalter
Bahnhof. Original source names remain in the evidence even when a current BVG
name supersedes them for display.

Native uses its own cardinal sign frames, raster letter cells, wall/rail pieces
and quarter-metre stair cells. All four corners of a stair cell must fit the
full original mouth polygon. There is no smooth double under the native model,
and no full/touch detail reduction. The caller supplies an actual terrain sample
for every top; the callback and its world payload are not retained afterward.

## Bounded integration contract

`UbahnAccessV326.ts` is main-thread only. The tiny index
`data/ubahnAccessV326Index.json` lists208512m keys, exact entrance/station
membership and original stair-way IDs. It contains no geometry buffers.

`createUbahnAccessV326Steps({native,keys,terrainAt},onCreate?)` or the same
factory with `sourceIds` constructs only the requested exact source set.
Use exactly one selector. Missing, unknown, duplicated, larger than eight
keys or96entrances, or invalid terrain selection returnsnull. There is no
always-resident whole-Berlin default. The synchronous `createUbahnAccessV326`
drains the identical generator.

`hasCompleteUbahnAccessV326(root,native?)` uses a private receipt over actual
selected source objects, station membership, all live geometry/matrix/colour
words, material provenance, shape, pose and resource lifetime. Public labels
do not admit a clone. Ordinary interleave/freeze, lossless/GPU parking and
qualified shader-program retirement retain the receipt; authored disposal,
foreign materials, changed source rows or raw buffer edits close it.

Only a complete root exposes immutable derived opening recipes through
`ubahnAccessOpeningsV326(root)`. They include the unmodified original source
polyline/ring/way ID, sampled absolute top/bottom and independent native cells.
**The factory does not cut or retire ground.** The root integration must bind
these recipes to the actual complete compatible ground owners, preserve their
full outside complement, and atomically publish the model with that reversible
transaction. If any host/support proof fails, retain the original geometry and
do not publish an occluded staircase as a successful access. No broad rectangle
or public flag authorizes a ground cut.

`ubahnAccessGroundAtV326(root,x,z,currentY?)` and
`ubahnAccessSolidAtV326(root,x,y,z,radius?)` reject unrelated points by source
bounds before checking admission. Floors agree with the actual drawn treads or
native cell-centre treads. Only represented retaining sides collide; the upper
approach remains open. `disposeUbahnAccessV326(root)` releases only this family.
Caller eviction must restore its ground transaction before disposing the model.
Generator cancellation removes only its own incomplete group.

## Bounded verification

Twenty bounded Bun cases/6449 assertions cover the access, real ground adapter and new approach packets; the source compiler checks also pass. They cover exact
source reproduction and all175 names, S-only/protected exclusions, actual
Drawn/native buffers, source polylines, floors and cardinal geometry, closed
default selection, descriptor/source/word/pose/material negatives, real
freeze/interleave/parking/Toon/grade/program retirement and cancellation.
Scoped Ruff format/check passes. No whole-city construction or browser is part
of those checks.

An actual12-entrance selected cell (`-6_2`) produced3394instances/257944instance
bytes in Drawn and6989/531164bytes in Native, three draws each. Local Bun/JSC
construction measured18.5/17.8ms; these are bounded factory timings, not browser
startup/GPU claims. Bootstrap, Worker and live residency limits remain unchanged. The finite static/offline allowance accounts for the new source coverage.


## Actual terrain integration

The main-thread adapter admits only complete mouth coverage by the actual
rendered terrain triangles. A complete pole foot also needs support. Higher
retained paving wins over lower slabs; sampled DGM slopes remain actual slopes.
The private numeric aperture applies to the same original colour, depth and
shadow surfaces as walking. Original position, colour, index, instance and
outside terrain words remain unchanged. Mixed packets use a separate finite
eligibility attribute; the known pure Core and source-pinned approach surfaces
retain their original attribute sets. Small read-only numeric lookup data use
64m cells, at most16 members per cell and128 source vertices/cell rectangles;
no all-stations fragment loop or raster image is introduced.

Admission checks original carrier references, source words, topology, pose,
material provenance, shadows and complete live models. A changed owner closes
the holes and hides the affected new models. Unpublished cooperative preparation
is invisible; cancellation and eviction remove only this supplement. Actual
stair floors and retaining sides share the source geometry. There is no invented
underground station hall or connection.

[Additional source approaches](ubahn-ground-approaches-v326.md) cover48 small
ordinary packets where existing coverage lacked an entrance's real footway.
Their source-pinned descriptor and actual resident packet are both required.
Conflicting closed building bodies, water, elevated-only paths and protected
boundaries remain explicit omissions. Six additional supported accesses borrow
the existing Schloss–Alexanderplatz street surfaces; three marker points inside
closed original building bodies remain excluded. These restrictions prevent
unsupported signs or stairs appearing through a building.

Core admission additionally borrows the actual pedestrian building-cell index
and complete compiled water polygons, including closed contours and holes. It
waits for successful source-water compilation. A real Northern terrain
transaction cancels the previous access job, releases its complete GPU/root
resources, then permits one fresh attempt after successful publication or a
complete rollback. Its new terrain sampler supplies the new hints. Public
flags and timed positive caches cannot permit a retry. Numeric mask storage is
charged privately against the existing64MiB geometry working-set target; the
ordinary packet counter also includes each distant mask. This changes no cap
and never evicts visible detail solely to satisfy the soft working-set target.
