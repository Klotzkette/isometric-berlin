# Olympic site and Waldbühne measured relief — v1.0.101

Step 10 corrects the existing finite Olympic site; it adds no territory or tour
stop. The Waldbühne operator describes its construction in a niche of the
Murellenschlucht. Berlin's district account describes the approximately30m
natural valley; the stadium account identifies an arena approximately12m below
surrounding ground. These are contextual facts; the displayed heights come from
four official Geoportal Berlin DGM1 tiles, licensed dl-de/zero-2-0, with exact
archive hashes in `olympic-terrain-v201.json`.

- [Waldbühne operator history](https://www.waldbuehne-berlin.de/location/geschichte/)
- [Berlin district, Murellenberge](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.111002.php)
- [Berlin district, Olympiastadion](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/sportanlagen/stadien-und-sportplaetze/artikel.154614.php)

No external photograph, protected plan or texture was used. Retained v187
OSM footprints and Berlin LoD2 source sheets remain the metric plan/building
anchors; their original files and every source vertex remain unchanged.

## Measured terrain and vertical datum

Viewer X=easting−389500, Z=5820000−northing, Y=NHN−30. The new field provides
NHN−33 as an offset to the existing3m baseline, not an additional hill on top
of earlier relief. It has8m triangular planes within
`[-10496,-1152,-8064,1152]`, with a192m transition to the exact earlier
Grunewald field. Minecraft independently uses8m level terraces. Missing cells
in the official border tile are never filled with invented heights; every used
sample is finite. Existing Grunewald and Teufelsberg fields are immutable.

| Place / X,Z | DGM1 NHN | interpolated displayed NHN |
| --- | ---: | ---: |
| Waldbühne lower bowl −9651,151 |37.67|37.66|
| Waldbühne upper seating −9651,245 |61.97|61.98|
| Stadium infield −8944,266 |53.05|53.0475|
| Stadium east plaza −8780,266 |66.08|66.0525|
| Glockenturm approach −9478,320 |69.80|69.77|

The eleven retained Waldbühne seating-sector footprints now follow those planes;
the original edges are split at field crossings. No seating sector or path is
removed. A forest-anchor audit found zero existing illustrative trunks within
these exact8214.708m² seating polygons, so all existing trees remain.

The old stadium model had normalized its surveyed67mNHN plaza toY3.55.
The measured canopy and all above-plaza details now restore their exact
+33.45m vertical datum. The previous pitch value50.783mNHN was the minimum
LoD2 ground sheet, not a surveyed playing-surface checkpoint. The authored
arena floor now uses the actual DGM53.05mNHN (Y23.05); existing below-plaza
rows interpolate monotonically to the retained67mNHN rim (Y37). Every XZ,
row, face and colour remains. The walking helper applies precisely the same
mapping. Glockenturm and the two measured gateway towers reverse their own
original source offsets; the four OSM-only towers retain their mapped
36m display heights at a common ground anchor each.

Six existing pool surfaces retain their complete horizontal polygons. Their
flat display water level is estimated from the highest sampled source-rim
vertex, rather than warping liquid down to an empty pool bottom in DGM.
This is an explicitly documented water-level estimate, not a fresh survey.
The corresponding outlines and native cells share the same level.

## Preservation and delivery

`build_olympic_terrain_v201.py --packets` validates the immutablev1.0.100
input families against unchanged flatv189 packets and the exactv190/v195
preservation chains before replaying original source geometry through the
new field. All drawn source XZ courses/colours remain, ground triangles are
subdivided, and complete ordinary buildings and trees move rigidly. The six
already-transferred Olympic owners' numerical proxy remnants are removed
only by exact ownership/footprint and recorded in the per-mesh receipts;
their complete dedicated geometry and granular navigation remain.

Private staging is `raw/olympic-v201/packets`; root integration applies the
manifest patch. There are35primaries and17bounded companions, with maximum
646,990compressed and2,159,881decoded bytes. Existing650,000/2,600,000
limits and resident budgets are unchanged. The compact audit references
1,231,709bytes of compressed detailed triangle/owner receipts. Water outside
the six authored pool panels retains its prior levels.

The old large landmark data is immutable. `olympicGroundsV201.json` contains
only the seven replacement terrain-attached public-space groups and small
per-pylon offsets, not a second stadium. Its constructor arrays use the
existing weak-cache release policy; only the selected representation creates
GPU geometry, with the same maximum26draw calls and spatially culled groups.

Reproduction uses `uv run python scripts/build_olympic_terrain_v201.py`,
`uv run python scripts/build_olympic_landmarks_v201.py`, then the packet command
above. Source source sheets and v187 generation stay reproducible as the old
flat baseline; this explicit v201 overlay is applied afterwards.

## Focused validation and cameras

Python checks source hashes, every old ground XZ vertex, triangle coverage,
all native box footprint partitions/colours, finite official samples, the
apron and horizontal pools. Bun checks both constructors, preserved stadium
face/instance counts, native orthogonal axes, exact walking heights, arbitrary
non-finite queries and every apron boundary interval. Root performs full
viewer and mobile mode-cycle QA after applying private packets.

- Waldbühne overview: camera `[-9460,135,340]`, target `[-9651,8,151]`.
- Inside bowl: camera `[-9635,13,108]`, target `[-9677,29,191]`.
- Stadium overview: camera `[-8700,165,510]`, target `[-8944,38,266]`.
- Pitch: camera `[-8920,28,300]`, target `[-9000,52,230]`.

### Waldbühne: final source-owner correction after the terrain replay

The first full-city view exposed a separate older geometry defect: 21 mapped
LoD2 grandstand owners had been extruded as closed parent-height buildings above
the hill. Their actual LoD2 `RoofSurface` sheets describe the sloping seating
sectors. `waldbuehne-v201-source.json.gz` now retains all 22 official parents,
24 source parts and every original wall/roof ring, plus the separate OSM stage
outline and the exact 23 earlier generic records. The 21 seating owners retain
all 358 source surfaces at their original absolute height, NHN minus 30 metres.
No extra terrain offset is added to them.

The current tent is mapped as OSM way `767528490`, explicitly described as
“Bühne”; it is not the 2018 backstage building. Its exact concave perimeter is
retained for an open, two-peak tensile membrane. Official owner
`DEBE04YY500002GT` supplies the existing maximum elevation, 35.66 m in the viewer
frame; its closed theatrical envelope conflicts with the visible open tent.
The original sheets stay in the source receipt. The intermediate membrane
curve, supports and bench-line spacing are procedural visual interpretations,
not a surveyed claim about every cable or seat. The operator confirms the
current tent dates to 1982:
<https://www.waldbuehne-berlin.de/location/geschichte/>.
The inspected, non-bundled visual reference is
[Roland.h.bueb, Glockenturm-berlin-blick-auf-zelt-waldbühne.JPG](https://commons.wikimedia.org/wiki/File:Glockenturm-berlin-blick-auf-zelt-waldb%C3%BChne.JPG),
CC BY 3.0; it establishes the white open membrane and its two peaks.

`integrate_waldbuehne_v201.py` is a final, separate transition over the already
verified Olympic terrain family `outer187--19_0`, including its companion.
`waldbuehne-v201-packet-checkpoint.json.gz` retains all four prior compressed
assets. Exact source-record replay removes only the 23 identified owners' colour
and position triangle/ink multisets. Complete ordinary buildings, mapped paths,
forest and all other families remain untouched. The 35-family terrain receipt
continues to verify the pre-transfer checkpoint.

The measured seating sheets replace only their exact projected footprints in
the old ground. Every outside fragment retains its former plane and colour;
new edge vertices result only from clipping that plane. The stage deck uses a
3.5 m inset of the mapped tent footprint, with its 6.55 m display deck immediately
above the source foot. Minecraft has an independent 1 m orthogonal surface skin
rather than filled grandstand volumes. Its cutout is exactly the union of the
occupied floor cells, and navigation uses those same cell tops. The old eleven
OSM seating-ground sheets are cut with the same masks by
`clip_olympic_seating_v201.py`; its reversible receipt reconstructs their exact
pre-cut payload. All original OSM sector rings remain archived and the unowned
remainder remains rendered. No broad vegetation or bowl clearance was applied.

Constructors: `createWaldbuehneV201(native=false)`; navigation:
`waldbuehneGroundAt(x,z,native=false)` and
`waldbuehneSolidAt(x,y,z,radius=0,native=false)`. The sunken seating is walkable
ground, while only the thin roof and support columns collide above it. Both
representations are texture-free, statically culled and under 1 MiB of buffers
(2 drawn calls / 1 native call), with the same detail on mobile and desktop.

Reproduction order: original Olympic terrain and ground generation, the bounded
Waldbühne source/model builder, reversible Olympic seating clipping, then the
Waldbühne packet ownership transition. Public installation remains a separate
root-reviewed operation. The intermediate Olympic packet navigation preserves
every immutable source-part ring and ID even over the deliberate stadium ground
cutout; only its exact per-owner datum is added to height and minimum height.
