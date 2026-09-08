# Historic Charité campus refinement — step 10, v1.0.4

The revision refines the existing 32-part source-bound campus model. It does
not add tour stops, modify geodata, move building footprints, fill courtyards
or change measured heights. Twenty LoD2 parts remain assigned to the former
Pathological Institute / Medical History Museum, six to Friedrich-Althoff-Haus
and six to the postwar Edmund-Lesser-Haus / Virology building.

## Evidence and its limits

The [Landesdenkmalamt ensemble record 09011080,T](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080)
identifies the 1899 museum, 1905 Pathological Institute and 1901 administrative
building. It describes granite bases, light red brick, contrasting plaster,
sandstone dressings and slate roofs. It also distinguishes the individual
buildings' different gables and ornament. We retain that material hierarchy;
we do not claim a complete carving-by-carving reconstruction.

Leonhard Lenz's CC0
[Friedrich-Althoff-Haus, 9 May 2024](https://commons.wikimedia.org/wiki/File:Friedrich-Althoff-Haus_Charit%C3%A9_Campus_Mitte_2024-05-09_01.jpg)
bounds the street elevation: seven axes, three main floors, paired upper
openings, one lower blind opening, pale spandrel panels, the stair turret and
four paired roof dormers. The exact street axis is edge 0 of LoD2 part
`50yMshCk`. Window sizes, floor subdivisions, decorative masonry joints and
roof/dormer proportions remain procedural display estimates. The new main
street roof fits within the existing part outline and its original 27.3 m
rounded source envelope; the previously established turret finial remains
at 27.345 m world elevation.

Schibo's CC0 exterior photographs of
[Virchowweg 14](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_14,_2025.jpg)
and [Virchowweg 16](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Virchowweg_16,_2025.jpg)
provide additional brick, arch, plaster-panel and window-order evidence. The
[Charité reopening account](https://www.charite.de/service/pressemitteilung/artikel/detail/wieder_geoeffnet_berliner_medizinhistorisches_museum)
documents the 2020–2023 museum renovation and large showcase windows. The
[official Virchowweg 16 location](https://www.charite.de/en/service/map/plan/map/ccm_virchowweg_16/)
and OSM museum node `2033362563`, lying inside `gwXjAt32`, identify the correct
building. Matching the photographed northeast-facing four-plus-three upper
axes to that part's outer edges 14 and 16 is an explicitly labelled display
inference, not a measured opening survey. Those edges receive tall lower
showcase windows, paired upper panes and pale spandrel panels. We do not
transfer this facade to the long, separate northeastern `nbLoon0z` building.

All three Commons files are attribution-only visual references. No photograph,
thumbnail, campus map, crop or photographic texture is bundled or loaded.

## Geometry and presentation corrections

The six Althoff parts were classified as generic glass in the delivered
presentation payload. Applying the source-specific historic masonry material
now takes precedence over that presentation class, so the house and its
pitched roofs render as brick/stone instead of blue glass. The original
source class remains stored unchanged.

The curved window face meshes previously had inward triangle winding for one
source ring orientation. Their winding now faces the exterior with ordinary
front-sided materials. Masonry course lines sit behind the glazing; they no
longer cross visible panes. Window eligibility samples both jambs and both
heights against adjacent source parts, avoiding hidden windows inside joining
wings. Cornice heights use the same fitted roof rises as the source shells.
The small `chariteRoofProfile.json` contains derived roof-fit values only;
it is checked against the current LoD2 plans and existing roof fitter.

The four drawn modes share the same geometry and existing day/night material
handling. Minecraft replaces the coarse raster columns of only the 26
historic parts with thin source-plane walls and stepped roof surfaces. It
retains individual block windows, stone courses, spandrels, dormers and a
stepped turret helm in one instanced draw call. It has no hidden solid interior
fill. Wall plans remain exact; roof surface blocks have the explicit 1.5 m
(full) / 2.25 m (mobile) presentation grid, while their vertical tops remain
bounded by the original source heights. Original prism-based pedestrian
collision, the campus entrance and the six separate postwar parts remain.

`createHistoricChariteColumnTester(sourcePrisms)` must be constructed once
and used with `createMinecraftHistoricCharite(sourcePrisms, detailProfile)`.
A legacy constructor without source prisms keeps the original raster buildings;
it does not suppress them or construct geometry from guessed source identities.
The production viewer supplies the source prisms in its cold and warm paths.

## Bounded geometry and validation

| Representation | Draw calls | Stored geometry / instance bytes | Rendered vertices |
| --- | ---: | ---: | ---: |
| Drawn full | 5 | 2,456,880 | 126,226 |
| Drawn mobile | 5 | 2,142,228 | 110,400 |
| Minecraft full | 1 | 549,748 | 173,400 |
| Minecraft mobile | 1 | 346,752 | 109,296 |

Minecraft uses 7,225 / 4,554 instances. Both profiles retain all 673 eligible
heritage opening groups, including 20 paired groups, four Althoff dormers and
the blind ground-floor opening. Drawn detail also retains the 238 existing
postwar Virology windows and its four ivy patches. Mobile reduces only brick
voussoir microdetail, masonry line density and roof/block subdivision.
Diagnostic window/block records are emitted only when a test explicitly asks
for them; they are not retained in the normal viewer scene.

The two Charité test suites cover source immutability and IDs, roof-fitter
agreement, outside face winding in both source-ring directions, real raycasts
through drawn and block windows, neighbor occlusion, source-plane filtering,
open courtyard holes, missing-source fallback and explicit full/mobile budgets.
Raycasts also verify the corrected upward-facing roof facets on
`t76KCSEh`, `KztaII44` and `8iaMbUbh`. Orthographic software QA renders actual
Three.js triangles and instance matrices; it supplements, rather than claims
to replace, browser and physical-phone interaction testing.
