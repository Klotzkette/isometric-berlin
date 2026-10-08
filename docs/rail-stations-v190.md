# Ring, Stadtbahn and open Ostkreuz — v1.0.90

The audit covers all 27 Ring stops and the 14 Stadtbahn stops from Westkreuz to
Ostkreuz, inclusive. Those two shared junctions give **39 distinct stations**.
The existing five detailed Hauptbahnhof, Zoologischer Garten, Friedrichstraße,
Alexanderplatz and Jannowitzbrücke models remain the sole detailed owners.

The operator's [S41 line](https://sbahn.berlin/fahren/s41/) confirms the 27-stop
Ring circuit. Its retained OSM centreline closes exactly, with 1,182 vertices and
36,962.298 m projected length. This is one sourced directional alignment, not a
fabricated pair of S41/S42 tracks. The [S5 line](https://sbahn.berlin/fahren/s5/)
identifies the Stadtbahn sequence. Both OSM directional courses are clipped to
the two junctions and their 180 m station approaches: 830 and 809 vertices,
15,175.210 and 15,112.755 m. No straight replacement chord joins source gaps.
These new lines are cartographic course accents. The previous physical central
viaduct/railway mesh remains byte exact.

## Source plan and elevations

`rail-stations-v190-evidence.json` retains all original geographic geometry and
source tags. `railStationsV190.json` has 71 complete platform polygons, including
regional platforms at shared interchange sites, and 115 roof/building polygons.
No platform or hole is reduced to a bounding rectangle. Its millimetre-rounded
runtime coordinates are checked against the original source polygons. Station
nodes, Ring order and separate Stadtbahn anchor identities are explicit.

All 34 stations outside the five established detailed models receive complete
platform surfaces, pale platform edges, source-roof edge details and a supported
vector station name. Westkreuz and Südkreuz have shallow roof-frame detail based
on inspected freely licensed photographs. Gesundbrunnen retains all five source
platforms and eight roof/building polygons. Their existing source buildings are
retained; this is not a claim of surveyed or fully open interiors at every stop.

Relative crossing order comes from OSM level/layer metadata. Display elevations
are explicitly illustrative: lower platform 3.96 m, ordinary upper crossing
platform 10.46 m, and Ostkreuz 12.46 m. Tiergarten, Bellevue and Hackescher Markt
align with the existing central viaduct's 14.475 m rail deck plus platform height.
Other stations keep the general city presentation grade. Negative `layer` values
remain metadata and are never blindly multiplied into a depth.

## Ostkreuz: a bounded repair

The former six-metre closed OSM hall proxy conflicted with the mapped Ring
crossing. Only these four closed owners are replaced:

- `OSM-way-110639235`: upper Ringbahnhalle.
- `OSM-way-463652072`: adjacent upper regional canopy.
- `OSM-way-1228253162` and `OSM-way-1228253163`: lower platform canopies.

`ostkreuz-v190-packet-patch.json` is the exact descriptor/ownership receipt for
`ring182-12_3` and `ring182-13_3` in both modes. The exporter reconstructs the
four source owners and subtracts only their triangle/colour multisets and roof
ink. It verifies every removed triangle exists. All remaining triangle signatures,
other building navigation, ground, roads, water and bridges are retained. There
is no corresponding district188 facade packet: that existing selector excludes
non-DEBE owners. The source inventory remains in the evidence files.

The new roofs retain the complete four OSM plans, including the tapered main
hall edge. Eight transverse roof strips approximate a shallow barrel section;
steel bays, glazing subdivisions and its radius are photo-informed estimates.
Transparent side glazing has no opaque backing. End glazing starts 6.2 m above
the upper platform and leaves open train mouths; its upper edge and fascia follow
the barrel crown along the complete subdivided source boundary. The adjacent three canopies
are open structures with slender supports.

[S-Bahn Berlin punkt3, 10 March 2011, printed page 10](https://sbahn.berlin/fileadmin/user_upload/Punkt3/PDF-Archiv/2011/punkt3_2011-03-10.pdf)
publishes a 15 m hall height, 123 m length and maximum 48 m width. The height is
applied above the displayed upper floor, giving 27.46 m. The full OSM footprint
includes longer ends; it is retained rather than shortened to match the earlier
published construction dimensions. The [steel/glass contractor](https://www.stahlglas.de/referenzen/bahnhof-ostkreuz-berlin-bahnhofshalle/)
confirms the structural system.

Official LoD2 tile `396_5818` supplies matching lower canopy context: relative
heights 6.383 m and 5.404/5.337 m, translated to the current city's 3 m datum.
Every inspected matching LoD2 part and surface is retained in
`ostkreuz-v190-evidence.json`, along with the archive URL and SHA-256. The official
match covers lower roofs and narrow gable parts, not a continuous full main-hall
owner. OSM governs the full plan and the published height governs its envelope;
the evidence states that conflict explicitly.

Thirty-one original local track ways preserve their horizontal axes. Mapped
level-one tracks sit at 11.50 m through the crossing and interpolate continuously
to the existing city grade outside the station. Lower tracks stay at 3.15 m.
The upper bridge deck is 11.10 m, above all lower canopy tops; it does not close
the space below. Illustrative support locations avoid lower tracks/platforms.
Only thin roof, deck, platform and support navigation volumes replace the old
full-height blockers inside the same two packets. These are display transitions,
not surveyed operational railway gradients or a train simulation.

## Appearance, credits and cost

Four Commons references were individually opened and visually inspected; their
artists, licenses, original pages and exact uses are in
`rail-stations-v190-credits.json`. Westkreuz: Jcornelius, CC BY-SA 3.0; Südkreuz:
Bukk, CC BY-SA 3.0; Ostkreuz exterior: Michael.F.H.Barth, CC BY-SA 4.0; Ostkreuz
interior: IngolfBLN, CC BY-SA 2.0. No photographic pixels are bundled. OSM data
remains ODbL-1.0, official Berlin geometry dl-de/zero-2-0.

Drawn geometry uses static per-station batches; both touch and desktop use the
same drawn model. Minecraft is constructed separately from world-axis-aligned
cuboids, with surface-only platform/roof cells and no hidden filled voxel block.
There are no textures, remote loads, animation loops, quality tiers or runtime
budget increases. The rail module is 72 drawn mesh batches plus 36 course-line batches, 12,236 instances and
about 1.06 MB total geometry/instance buffers; native is 74 batches, 89,443
instances and about 6.85 MB. Existing frustum culling and asset residency remain active.

## Validation

`tests/test_rail_stations_v190.py` checks the 39 identities, full source polygons,
closed Ring, both Stadtbahn courses near every listed stop, unchanged previous
rail payload hashes, complete Ostkreuz roof coverage, source-axis/grade continuity,
open ground-level hall navigation and the exact four-packet subtraction against
v1.0.89. `src/app/tests/rail-stations-v190.test.ts` builds both modes, validates all
39 vector labels (including umlauts and Messe Nord / ZOB), checks every numeric
buffer, orthogonal native matrices, no textures/UVs and bounded geometry memory.
