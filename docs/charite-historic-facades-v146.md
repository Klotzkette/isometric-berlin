# Historic Charité campus facades — v1.0.46

Step 10 adds individually named facade families to 146 retained Berlin LoD2
parts. The existing museum, pathology and Althoff models keep their 26 source
parts and details. The six separately modelled Virology parts retain their
envelopes, with the identity and facade correction described below. No source
building, court, path, campus entrance or source roof is replaced or deleted.

## Metric and identity evidence

`chariteHistoricFacadeSource.json` binds every short runtime ID to its complete
original building ID and parent from the retained `buildings.gpkg`.
`lod2-prisms.json` supplies the unchanged rounded source walls and heights.
`chariteHistoricFacadeRoofFit.json` stores only derived roof-fit offsets;
`chariteHistoricNativeRoofProfile.json` retains the matching fitted rectangle
axes and source roof codes for all 152 native parts. Tests compare the offsets
with the existing viewer roof fitter.

The [Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080)
establishes the individual historic clinics and service buildings. Its general
material evidence is red brick, contrasting plaster, granite bases, sandstone
members and slate. The [official campus address catalogue](https://www.charite.de/en/charite/campuses/campus_charite_mitte/location_map_map_key_ccm/)
and individual Charité location pages distinguish current internal addresses.
The campus map was inspected for building identity, not traced into geometry
or reproduced. Existing OSM building identities remain supplemental evidence.

All parent IDs below have prefix `DEBE01YYK000`. The machine-readable source
file lists all 146 full part IDs rather than relying on a spatial runtime guess.

| Family / current address | Retained parent suffixes | Parts | Recognition treatment |
| --- | --- | ---: | --- |
| Eduard-Henoch-Haus, Virchowweg 4 / Charitéplatz 2 | `04WR` | 10 | Red brick, tall openings, pale vertical spandrels |
| Southern learning house, Virchowweg 5 | `08o5` | 2 | Restrained rectangular openings of the later extension |
| I. and II. Medical Clinics, Virchowweg 9–10 / Sauerbruchweg 2–3 | `01gK` | 30 | Tall windows, pale panels, west-facing loggia shadows and parapets |
| Surgical Clinic, Hufelandweg 9 | `0Avm`, `05Qs`, `01TC` | 8 | Brick and paired upper openings |
| Surgical south wings, Hufelandweg 4–6 / Sauerbruchweg 5 | `0ANx`, `0E1V`, `0EGa`, `04jL`, `080h` | 15 | Arched openings, stone courses and upper paired panes |
| Wilhelm-Griesinger-Haus, Bonhoefferweg 3, 3a, 4 / Virchowweg 19 | `09HI` | 25 | Lighter plaster fields, taller three-storey window rhythm |
| Northern Nervenklinik pavilion wings | `0DEi`, `0C7h` | 11 | Same material family, source-height-limited lower wings |
| Former HNO clinic, Luisenstraße 10–12 | `07Iz`, `05Dp`, `08L3` | 20 | Narrower paired upper bays and sandstone dressings |
| Former Medical Polyclinic, Luisenstraße 13A | `0FLQ` | 11 | Broad windows and pale upper fields |
| Former kitchen, Hufelandweg 16 and 20 | `07YT` | 3 | Broad segmental windows, brick and stone plinth |
| Former machinery/workshop buildings, Hufelandweg 18–19a | `08nj`, `04Nb` | 11 | Lower industrial openings and restrained stone courses |

## Inspected image references and source conflicts

Sixteen external photographs by **Schibo** were inspected. Their full titles,
links and CC0 / CC BY-SA 4.0 licences are in the Wikimedia manifests. They cover
Bonhoefferweg 3 and 4; Hufelandweg 3, 4–6, 9, 16/20 west, 18 and 18a/19/19a;
Luisenstraße 12 and 13A; Sauerbruchweg 2; Virchowweg 4, 5 and 9–10; and
Rahel-Hirsch-Weg 2 and 3 southwest. No image, map, crop or texture is packaged
or fetched by the viewer.

The Hufelandweg 3 photograph identifies a modern rehabilitation building and
enclosed passage. Its four flat-roof parts under `DEBE01YYK0000AII` are excluded
from historic recolouring. The modern CCO, MPI/DRFZ, tower and modern medical
infill remain outside these new historic families. The Virchowweg 5 photograph
identifies a later Henoch extension; it therefore receives simple rectangular
openings rather than the older house's elaborate upper fields.

The pre-existing model incorrectly called Virology the postwar
**Edmund-Lesser-Haus**. The institute's [official annual report](https://internationale-gesundheit.charite.de/fileadmin/user_upload/microsites/m_cc11/virologie-ccm/dateien_upload/jahresberichte/jahresbericht-2011-institut-fuer-virologie-charite.pdf)
identifies **Helmut-Ruska-Haus**, and its [current address](https://virologie-ccm.charite.de/)
is Rahel-Hirsch-Weg 3. The inspected [southwest exterior](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Rahel-Hirsch-Weg_3_S%C3%BCdwestansicht,_2024.jpg)
shows three tall storeys, tan plaster and red-brick arches/piers. The
[separate Rahel-Hirsch-Weg 2 view](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Rahel-Hirsch-Weg_2,_2024.jpg)
shows the larger five-storey Edmund-Lesser-Haus. The 1906 historic clinic
inventory and 1956–1960 rebuilding account must therefore not be applied to
the same source family. All six `03IB` source parts remain; their old 238-pane
postwar grid becomes 70 exterior tall opening groups with brick surrounds.
The existing four ivy patches remain. The separate `0AME` postwar body is
preserved. This corrects an identification error, not a source-data change.

## Representation, limits and verification

The new facade-only layer uses one shared cube and one instanced draw call.
All four drawn modes and both device profiles use identical geometry:
39,067 instances, 2,969,740 bytes including instance attributes, 2,416 window
groups, 11 modest portals and 72 west-facing loggia cues. The separate native
Minecraft representation uses 15,184 cube instances plus clipped stepped roof
triangles, three draw calls and 5,515,468 bytes. It supplies all 152 parts,
including the six Ruska parts. Source-bound thin masonry walls and roofs
replace precisely matched coarse columns, whose four-metre edges otherwise
swallowed 1,026 authored window centres. The 2,488 native opening groups remain
in front of the replacement walls; generic panes are suppressed on the same
source identities. The pre-existing 26-part native Charité model is unchanged.

Roof tiles are clipped to source rings and holes and retain 21,521.965 m² of
projected surface, matching the existing source extrusion's triangulator.
Two delivered rounded rings (`raSqaKuS`, `S4lVS79h`) self-intersect; their
signed shoelace area differs from their existing triangulated display area.
The source rings and established triangulation are retained rather than
silently repaired. Exact indexing reduces roof buffer duplication. All native
skins use the same geometry on full and mobile.

Windows, portals, intermediate colours, plaster subdivisions and loggia
reliefs are procedural recognition estimates, not a measured opening survey.
Portals are modest facade-plane cues, not claims of verified usable entrances.
The layer adds no stairs, solid interior fill or footprint outside a source
wall; the drawn layer's deepest member is 28 cm. All window jambs and vertical extents are
checked against adjacent source parts, including modern neighbours. Courtyard
faces use reversed hole normals, and every detail remains below its fitted
source eave. Existing LoD2 roofs carry the source-specific slate palette;
no conjectural replacement gable is introduced. Native roof tile heights use
the same fitted roof shapes with an explicit 2.5 m horizontal / one-third-metre
vertical step, capped at each source top. Tiles are source-clipped, so their
grid never bridges a courtyard boundary.

The three focused suites contain 23 passing tests covering exact membership,
source immutability, roof-fit agreement, full/mobile equality, missing-source
fallback, both source ring orientations, neighbour occlusion, real downward
courtyard raycasts, thin-source-plane bounds, complete native roof coverage,
an actual coarse-column-before / visible-window-after raycast and explicit
geometry budgets.
This supplements browser inspection; it is not physical-phone testing.
