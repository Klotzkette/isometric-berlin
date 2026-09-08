# Heinrich-Böll-Stiftung architecture

Step 10, v1.0.6. This is a source-bound context building, not another tour stop.

## Identity and exact source contract

The [foundation's own building account](https://www.boell.de/de/das-stiftungshaus-der-schumannstrasse)
identifies Schumannstraße 8, opposite Deutsches Theater, and the 2008 building
by Piet and Wim Eckert / e2a. The delivered OSM POI `node/4597099723` is at
`[791.971, -535.391]` in viewer coordinates. Berlin LoD2 parent
`DEBE01YYK00003sO` contains exactly these two delivered parts:

| Part | Function in the model | Source base | Source maximum |
|---|---|---:|---:|
| `G9NcorMt` / `DEBE3DlFG9NcorMt` | Main office/foyer core | 5.2 m | 28.8 m |
| `PZ80obrB` / `DEBE3DwYPZ80obrB` | Projecting L-shaped beletage | 5.2 m | 15.8 m |

`boellStiftungPrisms.json` copies both delivered records without changing their
vertices, height, roof code, class or original tone. Tests compare the whole
records to the shipped LoD2 payload. The exact source core remains rendered.

## Architectural evidence and source difference

[Piet Eckert's opening speech](https://www.boell.de/de/presse/neubau-4970.html)
describes the compact offices and projecting transparent public level. The
[foundation's building brochure](https://www.boell.de/sites/default/files/hbs_neubau_broschure.pdf)
identifies six levels including the basement, the glazed foyer, green beletage
windows, upper offices around an atrium and its seasonally opening roof.
The visible model accordingly has ground floor, one high public level and
three upper office rows within the unchanged 28.8 m source maximum.

The low LoD2 part is delivered as a solid from ground to roof. Current external
photographs and the architect's account instead show a cantilever over a
recessed glazed ground floor. Its source perimeter and maximum height are
retained, but its drawn and Minecraft presentation starts at **8.8 m viewer
height**. This underside is a photo-proportioned display estimate, not a new
survey measurement. The source record is retained and the source difference
is recorded in the fusion conflict log. Only this low prism's generic closed
body and voxel columns are replaced; the core's source envelope is retained.
Pedestrian collision uses the elevated representation, leaving the space
below it open. The precise L-shaped roof remains at 15.8 m. Boundary roof
blocks shrink inside the source outline, preserving its concave notch.

Silver aluminium spandrels, projecting webs and paired folded edges distinguish
the upper facade from the larger green glass fields and fine frames below.
Three office rows preserve the measured envelope; alternating panes, individual
sunblinds and green curtain folds are procedural material cues. Four north
entrance door leaves, their frames/handles, the left silver nameplate and right
house-number plate follow the April 2024 entrance reference. The vertical
`HEINRICH BÖLL STIFTUNG` name, umlaut and three small green bars use code-built
strokes, with a block-pixel reading in Minecraft. No slogan, event notice,
photographic reflection, proprietary font or image texture is reproduced.

The roof vocabulary was also inspected against official DOP 2025 spring WMS
`https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`, layer `dop_2025`,
EPSG:25833 bbox `[390260,5820490,390330,5820560]`, 1400 × 1400 pixels.
The roof has a closed seasonal atrium cover, four longer and three short
array rows, and two service fields. Their local arrangement is explicitly
schematic: the orthophoto is not a facade or equipment survey, and roof
parallax is not mistaken for exact plan coordinates. Roof colour fields use
12–20 mm display separation above the existing cap to avoid depth fighting;
this is not added structural height. No unsupported open courtyard is cut
through the retained core.

## Free visual references, actually inspected

- Leonhard Lenz, [Heinrich-Böll-Stiftung building Berlin 2024-05-09 01.jpg](https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_01.jpg),
  9 May 2024, CC0: frontal garden facade and recessed ground floor.
- Leonhard Lenz, [Heinrich-Böll-Stiftung building Berlin 2024-05-09 04.jpg](https://commons.wikimedia.org/wiki/File:Heinrich-Böll-Stiftung_building_Berlin_2024-05-09_04.jpg),
  9 May 2024, CC0: aluminium profiles, corner and projecting public level.
- Ankermast, [Eingang zum Gebäude der Heinrich-Böll-Stiftung, Berlin.jpg](https://commons.wikimedia.org/wiki/File:Eingang_zum_Gebäude_der_Heinrich-Böll-Stiftung,_Berlin.jpg),
  10 April 2024, CC BY 4.0: four entrance leaves, vertical wordmark, small green
  mark and address number. Current promotional notices remain excluded.

These references are attribution-only. Photographs, crops, the brochure and
DOP raster are not bundled, projected or loaded at runtime. Geoportal Berlin
DOP is dl-de/zero-2-0; each photograph's own notice accompanies the release.

## Modes and bounded cost

Day, Night, Snowstorm and Schwellenraum share the source-bound drawn parent.
Minecraft receives its own single instanced block batch. Retained coarse core
cells are sampled before facade placement, so panels and lettering sit outside
actual voxel faces. The delivered 4 m voxel grid rounds the core roof up to
29.2 m, which would bury the roof fields. Only core-centred columns in that
source rounding band are shortened to the exact 28.8 m LoD2 cap; the raw voxel
records and every column remain retained. Adjacent and unrelated taller columns
are unaffected. Source normals work independently of winding.

| Representation | Instances | Renderables | Stored bytes including instance buffers |
|---|---:|---:|---:|
| Drawn full | 1,909 | 2 | 146,044 |
| Drawn mobile | 1,244 | 2 | 95,504 |
| Minecraft full | 2,315 | 1 | 176,588 |
| Minecraft mobile | 2,095 | 1 | 159,868 |

Fifteen targeted tests (3,381 assertions) cover exact source identity, outward source-edge normals,
all four full/mobile geometry variants, finite buffers, bounded cost,
texture-free colours, actual exterior-pane rays against both retained drawn
core and coarse Minecraft cells, upward/downward cantilever rays, collision
heights and every Minecraft roof cell corner inside the L. Full/mobile downward
rays also require all ten core roof fields to remain visible above retained
voxel caps, reproducing their burial before the source-height correction.
Software views of
actual Three.js triangles and instance matrices were inspected from the north,
park and close entrance. These are geometry QA renders, not browser screenshots.
