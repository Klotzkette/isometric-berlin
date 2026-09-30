# Step 10: source-bound Bikini Berlin recognition

Bikini Berlin now has a bounded source profile rather than one six-storey
extrusion of the entire shopping-mall footprint. The scope is the long Bikini
building and its attached mall, terraces and stairs. The neighbouring hotel,
Zoo Palast and Huthmacher-Haus retain their independent source geometry.

## Geometry and ownership

`src/app/src/bikiniSource.json` records the current OSM parent way `364457341`,
101 explicitly tagged building-part ways and two building-part multipolygon
relations. The two relations are `5419303` (the western commercial volume,
with an inner ring) and `5424774` (a planted roof with two glass-roof openings).
All 103 parts retain their exact projected rings, holes, height/min-height
values and original tags. Coordinates use EPSG:25833 transformed as
`x = easting - 389500`, `z = 5820000 - northing`.

The committed source base is 5.2 m. The upper historic slab is mapped from
10–19 m above that base, the recessed glazed Bikini storey from 7–10 m, and
its setback roof storey from 19–23 m. The lower rear mall remains at its
mapped seven-metre height. These are OSM values, not claimed component
survey measurements; the committed LoD2 extract has no parts for this site.

Only the former parent prism `64457341` and separate relation prism
`-5419303` are superseded by their complete part reconstruction. The source
part union covers the parent footprint except 0.1525 m² of boundary rounding
slivers. No adjacent building is claimed by this replacement.

The native ownership audit checks the delivered 4 m raster against every
neighbouring source prism. It identifies 590 wholly owned cells, another 70
partially covered cells with no unrelated building contribution, and 29
cells touching neighbouring prisms. The 660 exclusively owned building
columns may be replaced; their underlying ground and other scene layers
remain independent. The 29 mixed columns must remain unless every unowned
contributor is explicitly rebuilt with its original footprint and heights.

## Stairs and roof openings

All four mapped stair parts retain their source footprints and levels.
Their tagged `roof:direction` defines the high-to-low slope, following the
[OSM direction specification](https://wiki.openstreetmap.org/wiki/Key:roof:direction).
Tread polygons are clipped to those footprints. The number of risers is a
procedural display choice (at most 0.18 m rise), not a surveyed tread count.

The outer member of roof relation `5424774` also carries a standalone
building-part tag. Its original ring and tags remain intact, while
`renderRoofHoles` records the relation's glass openings. Both the roof finish
and an opaque body cap must respect these openings: the duplicated outer
member must not cover the glass with an uninterrupted grass surface.

Stair `364457329` overlaps mall part `364457308`. The display splits that
mall body at the stair's four-metre base and cuts the exact stair footprint
out of its upper body and roof. The original source part remains unchanged;
both renderers and pedestrian collision consume the same split. A downward
ray at the middle tread consequently reaches 10.788 m in the viewer frame,
rather than the former closed 12.2 m roof. Native walls include inner-ring
perimeters as well as outer edges.

Each opaque body closes with its single coloured roof sheet. The redundant
concrete cap 12 mm below that finish is omitted to prevent depth flicker at
city scale; walls and undersides stay intact. Member `364868139` uses the
identical 681.9986 m² finish supplied by roof relation `5424774`, rather than
submitting the same surface twice. Ray tests cover three planted roofs and
confirm exactly one finish plus an unchanged source wall plane.

## Architectural evidence and limits

The [official Bikini architecture presskit](https://www.bikiniberlin.de/de/pressekit/)
identifies the restored coloured horizontal panels, gold-anodised vertical
frames, transparent Bikini storey, glazed zoo-facing facade and public roof
terrace with outside access stairs. The
[Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040473)
distinguishes the long Bikini building from the other buildings of the
Zentrum am Zoo ensemble.

Source geometry was retrieved on 2026-09-30 from the
[bounded OSM API extract](https://api.openstreetmap.org/api/0.6/map?bbox=13.332,52.5051,13.3374,52.5070),
under ODbL 1.0. Its SHA-256 is recorded in the profile. Facade colours,
window subdivisions, signs and small trim remain procedural recognition
cues, not newly claimed measured data. Reference photographs are not runtime
textures. This profile introduces no model-detail or resolution reduction.

`bikini-source.test.ts` checks the source inventory, hierarchy, footprint
coverage, closed rings, roof openings, clipped stair partitions and raster
ownership against the committed neighbour prisms.
