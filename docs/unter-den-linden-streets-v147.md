# Unter den Linden public realm — v1.0.47

Step 10 extends the existing source-bound Pariser Platz / avenue foundation
eastward from Friedrichstraße (world X 1195) to the western Schlossbrücke
abutment (X 1800). It retains the western ALKIS parcels, every mapped planted
median polygon, the source roadway axes and explicit widths. Neither canonical
OSM nor ALKIS files are edited. The release boundary and 93-stop catalogue stay
unchanged.

`scripts/brandenburg_approach.py` identifies each retained outer sidewalk way.
The eastern north edge adds ways 1171464765, 442389818 and 803471191; the south
edge adds 1443932522, 1037130735, 1215085509, 1181092878 and 1215085513. A 2 m
outer sidewalk infill remains a labelled display estimate, not a paving survey.
Mapped 9, 11.5, 14 and 14.5 m carriageway widths take precedence over the existing
14 m fallback for lane-only source sections. The explicit 11.5 m compacted
median path 1447198833 keeps its separate material. No broad rectangular
district mask replaces a source street or courtyard.

The four drawn modes share the complete indexed terrain-draped surfaces and
open kerbs. `scripts/build_restored_road_surfaces.py` subtracts only actual
replacement surfaces before preparing the remaining exact citywide streets.
Original source-area, replacement-area and triangulated-area accounting remains
in the NDJSON header. Junctions and mapped foot/cycle crossings remain open.

Five bounded, 4 m cell-aligned station patches belong to the separate entrance
model. Paired stairs/escalators share one patch with both apertures. Their
positions come from the retained OSM API response and the
[BVG station plan](https://www.bvg.de/dam/jcr:35d4b73c-7184-4db3-b322-a71a0139babd/unter-den-linden%20900100045.pdf).
The source streets, generic ground and restored paving cannot cap these
openings. The entrance model refills each patch around its stair apertures;
finite side/back barriers and shared tread heights keep the approach usable.
See [entrance and architecture evidence](unter-den-linden-v147.md) for the
explicitly estimated mouth widths and descent, and the contradictory OSM
incline tag retained for entrance B.

Minecraft receives its own one-metre exposed surface tops, classified as
asphalt, paving, compacted gravel, planted median or kerb. Equal-height adjacent
cells are stored as one cuboid; there is no hidden solid infill. The existing
Hansaplatz model now shares the same renderer, retaining its source data and
appearance. Stair patches are excluded conservatively from the native avenue
and rebuilt by the entrance model.

Regression tests check the full non-overlapping public-space partition,
retained planted polygons, source widths, open crossings, maximum terrain
triangle span, all five native materials, and the absence of street triangles
or native tops inside the station-owned patches. Sources: OpenStreetMap
contributors (ODbL-1.0), Geoportal Berlin ALKIS (dl-de/zero-2-0); the BVG map is
an external reference and is not bundled.
