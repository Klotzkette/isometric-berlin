# Breitscheidplatz towers — v1.0.61

Pipeline step 10 refines Zoofenster / Waldorf Astoria and Upper West at the
western side of Breitscheidplatz. Their two older OSM maximum-height prisms
made the entire lower footprint as tall as each tower. The new interpretation
retains complete measured stepped roofs, lower wings and curved tower edges.
No neighbouring source building, road, pavement or tree is removed.

## Metric evidence

The official Berlin LoD2 tile
[`LoD2_386_5818.zip`](https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5818.zip)
(dl-de/zero-2-0) provides all 30 building parts under these exact parents:

| Building | LoD2 parent | Parts | Retained prior OSM identity / display prism |
| --- | --- | ---: | --- |
| Zoofenster / Waldorf Astoria | `DEBE04YY500002VL` | 11 | way `315777905` / `15777905` |
| Upper West | `DEBE00YY1JF00008` | 19 | way `474901812` / `74901812` |

The source archive hash accompanies the derived data. All 455 official exterior
wall/roof polygons remain represented as 1,379 triangles, with their measured
plan coordinates, roof slopes and intermediate heights. The principal tower
ground datums (34.107 m and 32.150 m NHN respectively) translate to the retained
viewer ground at 5.2 m; other part elevations remain relative to those datums.
Minor measured roof service parts can exceed the rounded published tower height.
The former OSM source records remain packaged as provenance and are used for
exact ownership of their older four-metre columns. Only those two matching
footprints and heights are substituted; there is no broad area suppression.
The distinct neighbouring Upper West commercial block is retained as existing
source geometry and is outside this two-tower replacement.

## Material and recognition evidence

[Hofmann Naturstein, the installed stone supplier](https://www.hofmann-naturstein.com/de/referenz/zoofenster-waldorf-astoria-hotel/)
identifies the Zoofenster architect as Christoph Mäckler, the beige Trosselfels
limestone, and the roughly 118 m / 32-storey building. Its stepped stone wings,
punched windows and glazed upper crown are distinguished procedurally.

[LANGHOF's Upper West project account](https://langhof.com/projects/upper-west)
describes two offset and rotated slabs, stepped upper levels, curved upper
facades and staggered white aluminium/glass elements. The source shape supplies
the complete silhouette. Dark glass, offset light fins and floor ribbons give
its curved edges and narrow vertical window pattern a separate reading.

The inspected Commons photograph
[“Charlottenburg Upper West und Zoofenster.jpg”](https://commons.wikimedia.org/wiki/File:Charlottenburg_Upper_West_und_Zoofenster.jpg)
by **Fridolin freudenfett**, 20 July 2019,
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), is an external
visual reference only. It shows both facades from the Kantstraße entrance.
The image is not bundled or loaded by the viewer. Window pitch, storey rhythm,
member depth, glazing colour variation and fine facade subdivisions are labelled
display estimates clipped inside the official wall polygons, not a measured
facade survey. The recognizable forms remain stylized isometric geometry.

## Rendering and navigation

The complete drawn model has two batches: one measured coloured shell and one
instanced detail batch of 15,610 boxes. Pointer and touch produce bit-identical
static geometry. Minecraft has one independent axis-aligned batch of 15,890
two-metre exterior blocks, with window colours centre-sampled only into existing
surface voxels, preserving white floor bands and limestone piers. It contains no hidden full-volume fill or smooth model double.

A separate 98 KiB navigation payload carries parts, original prism ownership,
roof triangles and native roof tops, without the 1.57 MB visual payload.
Walking uses actual stepped roofs; native walking uses the represented cell
tops. Day, Night, Snowstorm and Schwellenraum share the full drawn model.

Focused tests check retention of the 30 parts, roof/navigation agreement,
wrong-height and neighbouring-column rejection, concave-surface triangulation,
wall-clipped windows, native independent rendering and desktop/mobile identity.
Generate with `uv run python scripts/build_breitscheid_towers_v161.py`.
