# Rosengarten: source-bound planting and open pergola

Step 10 refines the existing garden inside the Großer Tiergarten without
changing its location, OSM paths, enclosing hedge, source lawn plates or Flora
statue. No additional trees, photographic textures or fetched runtime assets
are introduced.

Visual QA exposed a separate closed OSM roof fallback: way `584884256`,
runtime prism `84884256`. Its source `building:levels` inference supplied a
3 m high solid crescent that buried the real open pergola. That one prism is
now replaced in drawn geometry, progressive coverage and pedestrian indexes.
Minecraft skips only the 21 exact source building-column fingerprints
(5.2 m bottom / 9.2 m quantized top); ground and path cells are untouched.
The original source prism and its complete ring remain retained in the payload
and source profile, explicitly distinguished from the authored open frame.

The [Landesdenkmalamt's Tiergarten description](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318%2CT)
documents the formal rose/perennial beds, linear hedge enclosure and retained
stone pergola. It also explains that the former water-lily basins disappeared
when the garden was reduced after the war. No historical pools are reconstructed.

`rosengartenSource.json` retains the nine planted bed outlines from the committed
OSM GeoPackage, separately from the central round lawn (way `584884257`) and the
overall garden boundary (way `119369411`). Coordinates use the existing viewer
mapping and 0.001 m rounding; that rounding is not a claim of survey accuracy.
The existing perimeter hedge is way `533592722` and is not duplicated.

[Official Berlin DOP 2025](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected with layer `dop_2025`, EPSG:25833 extent
`388440,5819390,388565,5819520` and image size `1000 × 1040`. It confirms the
southeast curved pergola, the open central lawn, formal bed sequence and four
central seats. Its raw image remains ignored under
`geo_data/regierungsviertel/raw/rosengarten-v134/`. OSM footway `119437848`
anchors the pergola corridor. Frame height/width, 18 post subdivisions,
timber sections, bench sizes, individual plants and bloom colours are procedural
display choices rather than surveyed fixture records. Existing OSM attribution
and the official dl-de/zero-2-0 notice cover this source combination.

The model adds 226 low rose/perennial clusters and 678 small blooms. Each entire
plant envelope lies inside a mapped bed; the central lawn and the circular
cut-outs remain unplanted. The stone pergola has two post rows, open radial
rafters and no solid roof. The two drawn planting batches share one low-poly foliage
geometry. Minecraft uses a separate single box batch and retains every planting
cluster and the same structural footprint. Because Minecraft does not load the
smooth park layer, it also includes the existing 78 hedge segments and one
small gravel mesh derived from 28 retained path axes and their existing
widths. The approximately 1,133 m² gravel area is clipped to the garden and
subtracts all nine planting beds and the central lawn; it is not a broad
replacement of the park lawn.

Drawn uses 1,140 instances; Minecraft uses 1,218 plus its gravel surface.
Stored position/normal/UV/index and instance buffers total 89,400 bytes drawn
and 105,448 bytes Minecraft (194,848 bytes together); there are three drawn
calls and two Minecraft calls. Full and mobile geometry are identical.
`rosengarten.test.ts` checks bed/gravel containment, the open central lawn,
exact source-envelope replacement, source-based extent, no textures and budgets.
