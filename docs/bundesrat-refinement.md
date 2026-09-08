# Bundesrat / former Preußisches Herrenhaus

Step 10, v1.0.7. This is the older sandstone building west of the
Detlev-Rohwedder-Haus, at Leipziger Straße 3–4. The owner's unnamed neighbouring
old building is interpreted as this independently identified building; it is not
labelled as an undemolished part of the former Prussian War Ministry.

## Identity and exact geometry

OpenStreetMap way `11688785` identifies the Bundesrat. All four delivered parts
of Berlin LoD2 parent `DEBE01YYK00005AI` remain unchanged in
`bundesratPrisms.json`, including their decimetre-quantized metric source values.

| Part | Source base | Source height | Source top | Role in this rendering |
| --- | ---: | ---: | ---: | --- |
| `lZJjdWRB` | 4.6 m | 22.7 m | 27.3 m | Main building, concave U-shaped Ehrenhof and rear hall |
| `FT6vukDV` | 4.6 m | 5.7 m | 10.3 m | Retained shallow entrance-side part |
| `bfdQCKPW` | 4.9 m | 7.4 m | 12.3 m | Retained rear side part |
| `2yiGAf0Z` | 4.5 m | 16.3 m | 20.8 m | Retained southern connection |

The main ring has 45 vertices and no interior rings. Its open Ehrenhof is a
concavity of the actual outline and must never be filled as a bounding rectangle.
No source building, roof code, footprint or height is deleted. The source's
flat main roof omits its recognizable glazed roof and pediment. Their small
silhouette supplements are explicitly procedural, photo-proportioned display
reconstructions, not additional measured LoD2 records.

## Architectural evidence

The [Landesdenkmalamt record, 09096003](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096003)
anchors the 1899–1904 Herrenhaus, its Ehrenhof and its relation to the
Abgeordnetenhaus. The [BBR building account](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/bundesrat-1)
establishes the four-storey sandstone ensemble, two-storey rusticated base and
pedimented portico, as well as its later incorporation into the Luftfahrtministerium
and present Bundesrat use. The [Bundesrat building page](https://www.bundesrat.de/DE/bundesrat/gebaeude/gebaeude-node.html)
provides institutional identity.

Actually inspected photographs establish the six columns and five tall arched
bays of the central portico, six bays on each street-facing wing, recessed court
facades, pilasters spanning the two upper rows, capitals, dentils and the
`BUNDESRAT` inscription. Rear walls use a quieter framed-window reading. Bay
spacing, openings, carvings, colours and trim depths are display estimates.
The historic pediment relief is credited to Otto Lessing. Its small procedural
figures do not reproduce a sculptural scan.

The [BBR Kirkeby account](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/o-t-plastik)
identifies the **eight current bronze works** installed in 2000: two upright
reliefs at the central attic and three dark torsos on each wing. Only the two
central works have the published approximately 4 × 2 m dimensions. The model
keeps these contemporary works instead of restoring the lost historic attic
figures. Individual bronze surfaces are simplified authored silhouettes.

Geoportal Berlin's [DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr),
layer `dop_2025`, EPSG:25833, bbox
`390075,5818850,390210,5818980`, 1350 × 1300 pixels, was actually inspected.
It locates the main pyramidal plenary skylight, three Wandelhalle roof lights,
the front grouped light and smaller side lights. The approximate plenary roof
plan is 25.8 × 24 m, centered at viewer `(646.8, 1110.5)` and rotated 0.075 rad;
its 5.2 m rise is photo-proportioned. The original flat source top stays 27.3 m;
the displayed pyramid apex is 32.65 m. These local roof dimensions are not
published survey values. DOP is dl-de/zero-2-0.

## Free visual references

All files below were inspected in this task; metadata and local QA copies stay
outside runtime assets under `/tmp/v107-neighbour`. The viewer does not load a
photograph, crop, font or texture for this architecture.

- Leonhard Lenz, [*Christmas tree Bundesrat Berlin-Mitte 2025-12-18 01.jpg*](https://commons.wikimedia.org/wiki/File:Christmas_tree_Bundesrat_Berlin-Mitte_2025-12-18_01.jpg),
  18 December 2025, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
  Current frontal portico, lettering, capitals, pediment and bronze reliefs;
  the seasonal Christmas tree is not added to the model.
- Luis Alvaz, [*Vista del Bundesrat desde el hotel de enfrente 01.jpg*](https://commons.wikimedia.org/wiki/File:Vista_del_Bundesrat_desde_el_hotel_de_enfrente_01.jpg),
  24 April 2016, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Elevated Ehrenhof view and facade hierarchy, not current construction status.
- A.Savin, [*Berlin Hi-Flyer Sept14 views10.jpg*](https://commons.wikimedia.org/wiki/File:Berlin_Hi-Flyer_Sept14_views10.jpg),
  29 September 2014, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  Rear hall, glass-roof vocabulary and relation to the Abgeordnetenhaus;
  2025 DOP supplies the newer plan check.
- Jörg Zägel, [*Berlin, Mitte, Leipziger Strasse, Bundesrat 01.jpg*](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Leipziger_Strasse,_Bundesrat_01.jpg),
  23 June 2009, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  Complete unobstructed street-facing window rhythm; old surroundings are not
  presented as current site conditions.

## Modes and verification

Day, Night, Snowstorm and Schwellenraum share the drawn model. Minecraft uses
its own stepped arch crowns, square columns, block pediment, letter strokes and
stepped glass roof, with no smooth duplicate. Geometry stays instanced and
image-free. Mobile keeps the same portico, front bays, eight bronze works and
roof composition; it reduces rear microdetail and curve/rib subdivisions.

Minecraft facade offsets analytically clip the actual 4 m source cells in each
wall's own coordinate frame. A complete wall shares its offset, preserving the
order of glazing, reveals, columns and cornices. Only columns crossing that
exact wall contribute; an opposite wing does not push the facade across the
courtyard. `bundesratColumnTopAt` removes vertical quantization only from
matching source-centred columns and does not shorten taller unrelated buildings.
`bundesratRoofTopAt` supplies the authored plenary pyramid surface for navigation.

| Profile | Draw calls | Instances | Geometry + instance bytes | Rendered vertices |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 4 | 7,045 | 628,975 | 173,595 |
| Drawn mobile | 4 | 4,579 | 403,855 | 112,595 |
| Minecraft full | 1 | 5,752 | 437,800 | 138,048 |
| Minecraft mobile | 1 | 5,107 | 388,780 | 122,568 |

These are conservative standalone overlay counts; an actual complete city payload
can additionally suppress detail hidden by neighbouring source bodies. Shared
cube storage is conservatively counted once per draw call.

`bun test tests/bundesrat-architecture.test.ts` passes nine checks covering exact
source retention, all four bounded geometry profiles, finite/image-free payloads,
actual front-facing ray hits through all 41 street/Ehrenhof arched bays,
full/mobile Minecraft glazing against the real coarse source cells, and the
pyramid's visible roof height. Actual Three.js triangles, index winding,
materials and instance matrices were exported and visually inspected in front,
roof and Minecraft views using the local orthographic software QA renderer.
This is geometry verification, not a claim of an interactive browser/device test.
