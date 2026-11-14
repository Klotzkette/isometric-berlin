# Estrel current-parts ownership, v345

The new tower is integrated into the existing streamed `ring182-11_10` packet,
using the complete source-quarter transaction. It is not also built in the
outline family. The packet owns its whole exterior, fittings, roofs and walking
obstacles together. Unloading or changing mode follows the existing packet
lifetime; there is no independent positive visibility flag or global obstacle.

## Why the previous bodies yield

The actual retained packet contains two historical display proxies:
`OSM-way-1535834585` and `OSM-relation-21070307`. Both explicitly carry
`display_fallback:building=construction`, with arbitrary heights of 9 m in
Drawn and 8 m in Native. They are not two separately surveyed finished buildings.
The parent envelope combines buildings of different heights, a narrow low
plinth and two elevated canopies. Extruding the entire outline as one low solid
would fill the space beneath those canopies.

The retained current [OpenStreetMap map response](https://api.openstreetmap.org/api/0.6/map?bbox=13.4575,52.4699,13.4605,52.4726)
confirms that way 1535834585 is only the overall `building=construction`
envelope. Relation 21070307 is the New Convention Hall, whose three members
are precisely the three retained podium parts. All eight current parts are
represented: tower 1017413851, atrium 1535787743, and podiums 1017413850,
1535834587 and 1535834588, plus glass roofs 1390408048 and 1535834586 and the
3 m plinth 1390408051. An independent inventory of every `building:part` inside
the mapped parent finds exactly these eight parts. Their union covers the
parent completely; no residual area is assumed to be empty. The source XML is retained losslessly in
`geo_data/regierungsviertel/estrel-tower-v345-map.xml.gz`; its raw SHA-256 is
`83fa423d9d7ac9b2284f251c16715386838541c98791d42f026c02c82f78e3f8`.

The [2026 whole-building photograph by Nils Könning](https://nilskoenning.com/architecture/estrel-tower-barkow-leibinger/)
also distinguishes the tall glazed tower, glazed atrium and pale metal hall
envelope. It motivated the material correction before the final export. The
earlier close-up of the tower crown proves its facade and roof appearance only;
it does not prove the site's ground-level layout. Photographs remain external
references and no photo pixels are shipped. The 176 m height follows the
[operator's architectural facts](https://www.estreltower.com/).

## Exact transaction and preserved content

The recipe pins every original and prepared mesh, navigation and roof-line
buffer before replacement. It retires 53 Drawn triangles and 19 roof-line
segments, or 1,016 Native triangles, and the two exact old navigation records.
Independent checks prove that these triangles are exactly the complete roofs
and walls of the two old envelopes: their roof areas and wall areas are equal,
with no triangle belonging to surrounding ground, roads or other buildings.
The complete new append must pass its fingerprint and size validation before
any old member can yield. Wrong packets, modes, changed geometry, missing
append or changed old navigation fail closed.

All other packet geometry, roof ink and navigation remain intact. Original
published packet files are byte-identical. The previous original Estrel Hotel,
its new window fittings, surrounding industrial buildings and railway bridge
are outside this replacement.

## Geometry and walking

The actual retained ground is y=3 in both families. The tower therefore spans
y=3 to y=179; its sloping roof falls to y=153. This is the existing local display
datum, not a claim of absolute NHN elevation. Drawn roof navigation uses the
same source plane and footprint. Native uses the same independently sampled
two-metre cells for its complete exterior and navigation. Roof trim is a small
visual fitting; it does not add artificial floors.

The two glass canopies are tagged `construction=roof` and `layer=1`, with
total heights 8 m (3 m roof slope) and 5 m (flat). They are modeled as thin
elevated roofs, not solid buildings down to the ground. Their 0.18 m thickness
is a stated visual estimate. Drawn collision uses matching upper and lower
roof triangles; Native cells have corresponding upper and lower bounds. The
space below the actual local underside remains passable. The narrow 3 m
plinth uses its complete concave ring, with proper polygon triangulation.

The optional underside schema rejects malformed, non-finite, degenerate,
misaligned or inverted triangle pairs. Existing buildings without this field
retain their previous solid and roof behavior.

The offline exporter retains every modeled triangle and deduplicates identical
quantized position/color vertices. It uses the existing centimetre geometry
and 16-bit linear-color packet encoding. After the photographic material
correction, the append contains 32,473 Drawn vertices / 85,124 triangles or
102,873 Native vertices / 216,744 triangles. Both complete packets remain under
the unchanged 400,000-vertex and 2,400,000-index limits.

The two read-only recipes use the existing per-packet weak gzip codec:
7,344,274 raw bytes become 2,096,972 code bytes. They load only when this exact
tile is requested, with no full model dependency in the startup or worker graph.
Mobile receives the complete same geometry. No runtime network source is added.

## Checks and reproduction

`scripts/build_estrel_packet_v345.py` calls the offline TypeScript exporter and
recreates both exact recipes. `tests/test_estrel_packet_v345.py` independently
checks the entire eight-part source inventory, exact union with the parent,
source tags, projected current footprints, heights, complete old wall and roof
areas, and the precise retirement scope.

`src/app/tests/estrel-packet-v345.test.ts` uses the actual production decoder,
checks unchanged unrelated navigation and ground/water/road records, exact
source rejection, both roof/collision families, and lazy lossless reconstruction.
At X=5815.217, Z=5352.653 it verifies the old full-height obstruction is replaced
by the actual thin glass roof: downward and upward rays detect the two roof
surfaces, while walking beneath remains unobstructed. Independent underside
tests cover several points on both slopes, the shell itself, space above and
below, boundary clearance, malformed values and historical roof-only cases.
The model/source tests in `estrel-so36-v345.test.ts` remain in place as offline
authoring checks; their factory is not separately attached to the live scene.
