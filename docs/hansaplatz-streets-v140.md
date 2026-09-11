# Hansaplatz, GRIPS and Gymnasium Tiergarten streets

Pipeline step 10, v1.0.40. The existing source-bound street presentation now
includes a 310 × 300 m display window around the school and theatre. This is
a presentation mask, not a cadastral or district boundary. All road and path
positions still derive from the retained, attributed OSM GeoPackage; no new
road connection, traffic crossing, large plaza or photograph is introduced.

## Evidence and limits

The local network includes Altonaer Straße, Lessingstraße, Bartningallee and
the connecting Bachstraße/Klopstockstraße junctions. OSM widths, mapped lane
counts or the existing explicitly labelled class fallback determine each
carriageway and path width. Surface tags distinguish asphalt from paving.
For example, [way 527591141](https://www.openstreetmap.org/way/527591141)
anchors the school-side Lessingstraße junction, and
[way 1471432243](https://www.openstreetmap.org/way/1471432243) anchors the
Bartningallee approach beside GRIPS. School-side paved footways, including
[way 1085168655](https://www.openstreetmap.org/way/1085168655), retain their
source axes and now rise to the same displayed level as the kerb top.

Two Altonaer Straße segments,
[455280943](https://www.openstreetmap.org/way/455280943) and
[455280945](https://www.openstreetmap.org/way/455280945), are mapped as asphalt
roads with `covered=yes`, without a bridge, tunnel or negative layer tag.
These are ground-level road surfaces beneath the overhead railway. The former
generic covered-way rejection left holes here. Only these two retained
identities now ignore the overhead-cover flag; actual tunnel, bridge and
negative-layer guards remain active. The railway geometry is unchanged.

Pavement additions follow mapped paved approaches beyond the earlier 8 m road
margin. They avoid every retained local LoD2 footprint, both original small
GRIPS courts, arcades, covered pedestrian passages and the mapped U9/school
stair approaches. Their existing authored floor/step models remain visible.
Kerbs follow the unioned carriageway boundary, with gaps at mapped foot/cycle
approaches. The 14 cm upstand, 22 cm drawn kerb width, colours and lane-dash
rhythm are procedural presentation dimensions, not surveyed fixture evidence.

## Representations and budgets

Day, Night, Snowstorm and Schwellenraum share the existing eight static street
batches. The source supplement adds 70 motor-way records, 9,507 triangles and
3,672.61 m of open kerb; the whole district street layer remains eight draws
and uses 16,235,508 geometry bytes. The extra encoded district payload is
305,688 bytes before compression. Existing scene detail and resolution are
unchanged.

Minecraft adds one texture-free native batch with 6,188 cuboid instances,
471,128 geometry/instance bytes and 24,038 exposed one-metre cells. Equal-height
adjacent cells share a cuboid; no underground solid fill is stored. The same
geometry is used on desktop and mobile. Its separate source payload is
99,284 bytes. The full square footprint of every native cell is excluded from
the authored courts, stair approaches and buildings, including diagonal cell
corners. The kerb representation is a low surface step and adds no new collision
wall across pedestrian routes.

`uv run python scripts/build_district_streets.py` rebuilds the bounded derived
payloads, retaining the source SHA-256. Focused checks cover street axes,
under-rail road semantics, raised school-side paving, complete cell-footprint
clearance, native draw/memory budgets, finite ground-following geometry and the
existing tunnel-portal exclusions. Seven Python and seven frontend tests pass.
A generated plan-view QA plot was inspected locally; it is not a new map or
runtime asset. Whole-viewer compatibility/release checks are recorded in the
[release review](release-v1.0.40-review.md).
