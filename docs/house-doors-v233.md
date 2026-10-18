# Source-mapped ordinary house entrances — v233 / Step 10

This restrained pass makes actual mapped entrances legible on existing ordinary
house shells. It does not infer a door at the centre of every façade, cut new
holes, invent shops or identify inhabitants. The façade remains a closed source
sheet, so these presentation fittings create no new walking doorway or collision
barrier.

The final selection adds **3,150 mapped entrances on 157 existing tiles**; the
independent native source supports **1,681** of those placements. The runtime
recipe is **299,092 bytes** before build compression. Source selection remains
conservative; this is not a claim that all city entrances were surveyed.

## Selection and evidence

The retained Berlin Geofabrik snapshot of 29 September 2026 supplies entrance
nodes; the existing OSM building extract supplies complete footprints. Only
`entrance=yes/main/home/staircase` at ground level (or without a contrary level)
on an ordinary unnamed building is eligible. Railway/public-transport entrances,
indoor openings, emergency/service exits, garages, named institutions and other
specific building uses are excluded. The compact retained evidence omits street
addresses, personal/contact attributes and names.

Selection uses the complete retained official ALKIS district rings in
`house-districts-v233.geojson`, intersected implicitly with the existing delivered
source packets: current Mitte, Friedrichshain-Kreuzberg and
Charlottenburg-Wilmersdorf, plus the Schöneberg Ortsteil. No new district coverage
or arbitrary fill is generated.

A delivered building must uniquely overlap one mapped ordinary footprint by at
least 90% of its own area and 70% of the mapped area. The actual mapped entrance
must be within 8 cm of that OSM outline and within 35 cm of the delivered façade.
The placement is projected onto an **existing pair of source wall triangles**;
clipped tile seams, ambiguous corner matches, elevated building parts and walls
outside the bounded residential height range are rejected. Original OSM
coordinates, source wall endpoints, source owner, source ring and transformation
distance remain in `house-doors-v233-evidence.json.gz`. The 35 cm allowance
acknowledges differences between source datasets; decimal precision is not a
claim of survey accuracy.

Authored/dedicated source owners and the complete v233 roof-replacement owners
are protected. Existing measured surfaces and earlier façade fittings are retained.
Two mapped nodes less than 1.5 m apart do not create stacked duplicate doors.
Door fittings that would cross the existing unsigned-coordinate tile frame are
omitted rather than wrapped to another edge of the tile.

## Appearance and cost

A 1.1 m by 2.25 m twin-leaf door, shallow frame, threshold, muted glazing and small
handles form twelve simple planes. **Dimensions, leaf arrangement and colours
are display estimates**, not a measured catalogue of original doors. The mapped
position and actual source-wall orientation are evidenced. There are no textures,
new holes, procedural shop signs, animation or per-frame calculations.

Minecraft uses independently checked axis-aligned wall faces from its own
retained source packet, never a rotated smooth door copy. Its source-grid snap
is limited to 1.6 m and must retain the same source owner, outward side and
height. If no sufficiently wide existing native face can carry the fitting,
that entrance is left unchanged in native mode; no replacement source wall is
invented. Full drawn detail is identical on pointer and touch devices.

`prepareHouseDoorsV233` adds one encoded mesh part to the existing unpublished
chunk before its normal decoder runs. The decoder merges it into the same
interleaved vertex/index buffers, so draw-call count is unchanged. Each door
adds 48 vertices and 72 indices: 720 decoded bytes when the aggregate tile uses
16-bit indices, or 864 with 32-bit indices. Existing total vertex/index guards,
residency budgets, cooperative scheduling, lossless parking and eviction remain
in force. A tiny eager tile-ID index avoids decoding the weakly held recipe
collection for unrelated tiles. No constructor plan is attached to the scene.

A guard over retained navigation owner IDs, source rings, base/upper heights and
packet origin rejects a changed input. Source packets, their original mesh
streams, navigation identity and every previous field remain untouched. A repeat
invocation returns the already prepared chunk without duplicating doors.

Sources remain © OpenStreetMap contributors (ODbL 1.0) and Geoportal Berlin
LoD2/ALKIS (dl-de/zero-2-0), under the existing in-app source notices. No new
photograph or image licence is involved.

## Verification

Three focused Python tests pass (13.76 s), and three focused Bun tests pass
(23,310 assertions). Scoped Ruff formatting/lint pass.

The Python suite replays every accepted entrance against actual immutable source
wall triangles and source hashes, checks mapped positions/ground levels and
rejects unmatched or elevated candidates. The Bun suite checks every selected
packet/family: navigation and original streams remain identical, added array
sizes are exact, native faces are axis-aligned, repeat preparation is idempotent,
and altered source heights/origins fail closed. The release task separately runs
the complete project checks, production build and browser verification.
