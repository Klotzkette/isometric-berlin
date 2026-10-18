# Source-mapped ordinary house entrances — v233, extended in v1.0.134 / Step 10

This restrained pass makes actual mapped entrances legible on existing ordinary
house shells. It does not infer a door at the centre of every façade, cut new
holes, invent shops or identify inhabitants. The façade remains a closed source
sheet, so these presentation fittings create no new walking doorway or collision
barrier.

The current selection contains **3,515 mapped entrances on 183 existing tiles**;
the independent native source supports **1,862** of those placements. The runtime
recipe is **335,018 bytes** before build compression. Version 1.0.134 adds 365
drawn placements: 349 in Steglitz, seven in Dahlem, six in Lichterfelde and three
in Zehlendorf; 181 additional native placements meet their separate wall checks.
Source selection remains conservative; this is not a claim that all city
entrances were surveyed.

## Selection and evidence

The retained Berlin Geofabrik snapshot of 29 September 2026 supplies entrance
nodes; the existing central and outskirts OSM building extracts supply complete
footprints. The latter is used only inside Steglitz-Zehlendorf, with older OSM
owner IDs taking precedence, and both cache hashes are retained. The central
cache alone has no Zehlendorf footprints; the extension therefore explicitly
includes the existing `raw/outskirts-v187/candidate.gpkg` from the same PBF.
The retained context contains 11,400 public entrance nodes and 7,853 ordinary
footprints across the selected scope. Only
`entrance=yes/main/home/staircase` at ground level (or without a contrary level)
on an ordinary unnamed building is eligible. Railway/public-transport entrances,
indoor openings, emergency/service exits, garages, named institutions and other
specific building uses are excluded. The compact retained evidence omits street
addresses, personal/contact attributes and names.

Selection uses the complete retained official ALKIS district rings in
`house-districts-v233.geojson`, intersected implicitly with the existing delivered
source packets: current Mitte, Friedrichshain-Kreuzberg and
Charlottenburg-Wilmersdorf, plus the Schöneberg Ortsteil. The v1.0.134 extension
also selects all eight Steglitz-Zehlendorf Ortsteile: Steglitz, Lichterfelde,
Lankwitz, Zehlendorf, Dahlem, Nikolassee, Wannsee and Schlachtensee, strictly
within the same existing delivered coverage. No new district coverage or
arbitrary fill is generated. The retained context records all 24 selected names;
the compiler refreshes that bounded context if the selection changes.

All v1.0.133 entrance recipes remain unchanged and first in their existing tile
arrays. Per-family prefix counts and SHA-256 receipts in `preservedV133` verify
the original 3,150 drawn and 1,681 native placements; newly supported entrances
are appended. Source dimensions, guards and packet origins cannot silently
change during this additive extension.

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

Authored/dedicated source owners and all 192 current roof-replacement owners
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

Four focused Python tests pass (15.87 s), and three focused Bun tests pass
(25,995 assertions, 3.79 s). Scoped Ruff formatting/lint pass. A separate read-only
comparison against tag `v1.0.133` confirms every prior recipe value, origin and
guard is retained unchanged.

The Python suite replays every accepted entrance against actual immutable source
wall triangles and source hashes, checks mapped positions/ground levels and
rejects unmatched or elevated candidates. The Bun suite checks every selected
packet/family: navigation and original streams remain identical, added array
sizes are exact, native faces are axis-aligned, repeat preparation is idempotent,
and altered source heights/origins fail closed. The release task separately runs
the complete project checks, production build and browser verification.
