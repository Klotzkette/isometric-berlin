# Four boulevard corridors — Step 10

The 10 October request selects Kurfürstendamm, Friedrichstraße,
Karl-Marx-Allee and Karl-Marx-Straße in Neukölln. This pass retains all
518 named source ways and their full vertices from the dated Geofabrik
Berlin snapshot (2026-09-29, ODbL 1.0). The finite carriageway corridor
is clipped to previously approved coverage; there is no district expansion.

Existing full-core Friedrichstraße curbs, v163 Kurfürstendamm pavements,
v185 Richardplatz/Schudomastraße curbs and every v206 Alt-Mitte marking
remain unchanged. The new paint scope subtracts the complete v206 district
so those lines never acquire a second coplanar copy.

The additions contain 3,266 short paint strips: 90 explicitly dashed crossing
owners, two positively mapped zebra owners, 53 ways with both positive lane
markings and mapped lane counts, and 79 mapped striped restriction polygons.
Unknown or merely signal-controlled crossings do not become zebras. Lane
spacing and untagged widths, exact dash phases and hatch spacing are display
estimates, not a live traffic-control survey. Source tags remain in the audit.
No new signal is inferred or relocated in this pass.

Internal shared source vertices with three or more at-grade road neighbours
receive a four-metre longitudinal lane-paint gap. Full drawn ribbons and native
paint pixels are checked against that gap. This includes Kurfürstendamm /
Wielandstraße at viewer `[-3872.8431887872284, 1902.353633614257]` and
Karl-Marx-Straße / Jonasstraße at `[4617.878967634169, 5276.312403159216]`.
Ordinary two-neighbour way splits and grade-separated roads do not create gaps.

Missing outer Karl-Marx-Allee/Karl-Marx-Straße curbs follow 16,912.243 m of
the retained delivered asphalt union boundary. Union happens before edge
extraction, leaving intersections open. No cut at a corridor, core or tile
edge becomes a transverse curb; occupied buildings and water are excluded.
The earlier Richardplatz curb geometry is also excluded precisely. Width
(22 cm) and rise (19 cm) are display estimates. Original asphalt, pavement,
building, navigation and source packets are never replaced.

The shared v206 paint grammar accepts explicit output paths, scope and an
opt-in internal-junction gap; its default four output files reproduce
byte-identically. Drawn paint has terrain-fitted corners; native paint retains
6,292 independently checked quarter-metre quads. Native curbs rasterise only
pixels intersecting the exact source course, then check each whole pixel
against the corridor and complete nearby building/water footprints. The
84,983 quarter-metre pixels merge losslessly into 27,163 orthogonal runs within
four-metre terrain cells. They retain a narrow stepped line instead of the
former diagonal segment bounding rectangles. The exact source building
`OSM-way-1450036393` independently guards the former overhang near
`[4172, 4247]`; the retained source-footprint audit includes a half-metre
context around the existing corridor, without adding scene coverage.

Native curb matrices use exact unnormalised Uint16 local coordinates with
1/8 m XZ and 1/200 m Y units, restored by the ordinary mesh transform. Tests
decode every world-space corner and bound, compare a negative-cell fixture
with Float32 reference vertices, and raycast its actual mesh. No pixel or
detail is discarded for packing. All are fixed 512 m batches without textures,
animation or smaller mobile detail. Drawn GPU attributes/index/instances use
855,888 bytes and native uses 1,332,608 bytes, each at 36 draw calls and below
the unchanged 1.5 MB allowance. City residency budgets remain unchanged.

Reproduce with `uv run python scripts/build_boulevard_transport_v210.py`.
`--extract` repeats the bounded extraction from the retained local snapshot.
The source/audit JSON records all original identities, exact courses and hashes.

Context: Neukölln's [municipal project entry](https://mein.berlin.de/topicprio/2025-26739/)
describes the completed Karl-Marx-Straße rebuilding. Regulatory paint here
comes from the dated OSM tags, not traced project illustrations or an inferred
historical layout.
