# Unter den Linden, Komische Oper and U-Bahn entrances — v1.0.47

Pipeline step 10. This bounded correction preserves the original OSM and Berlin
LoD2 records and adds source-labelled recognition detail. It does not change the
release polygon or the 93-stop catalogue. The avenue's street/kerb presentation
is documented separately in `unter-den-linden-streets-v147.md`.

## Building evidence and corrections

The committed Berlin LoD2 tile
[390_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip), licensed
[dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0), supplies every metric
building edge. `unterDenLindenSource.json` retains all 21 original parts: sixteen
Russian Embassy parts, the Aeroflot body, three Haus Pietzsch parts and the
Komische Oper. Every part retains its complete ground ring, holes, wall and
roof sheets, source height and identity. All 21 original runtime prism records
remain in the canonical payload. `scripts/build_unter_den_linden_source.py`
reproduces the supplement and checks that each parent stays within the approved
polygon. The archive SHA-256 and source creation dates are retained.

- **Russian Embassy**, Unter den Linden 55–65, OSM `node/514864739`, LoD2 parent
  `DEBE01YYK00003En`: the old decorative axis at world Z 401.6–410.5 was on the
  Behrenstraße rear. Its coordinates remain recorded as `previousRearAxis`.
  The five separate street-facing source edges now preserve the recessed
  Ehrenhof, its central front and the two projecting ends. The
  [Landesdenkmalamt inventory 09075006](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075006)
  establishes the four-storey frontage, rusticated base, colossal order and
  lantern. The new subdivisions use three upper window tiers, fluted half-column
  cues, base courses, cornices and an open lantern reading. The exact tower
  anchor and every source body remain retained. Intermediate bay, column and
  relief dimensions are procedural estimates; no historic emblem is traced.
- **Aeroflot / Russian Trade Mission**, Unter den Linden 51–53, OSM
  `way/195071820`, LoD2 `DEBE01YYK00001vY`: the former axis at Z 304.5–307.4 was
  likewise on the rear. The correction uses the exact north-facing street edge
  `[926.231, 288.437] → [958.331, 285.567]`. The source height remains 19.606 m.
  Recognition details include four window rows, the open square concrete lattice,
  free-standing roof lettering and small chevron rhythm. The previous blue roof
  sign backboard was an inaccurate procedural addition and is replaced by
  free-standing letters; no source geometry is removed.
- **Haus Pietzsch / Café Einstein**, Unter den Linden 42, OSM `node/1412218896`,
  LoD2 parent `DEBE01YYK0000A6r`: the
  [operator](https://www.einstein-udl.com/) confirms the address. The licensed
  photograph identifies the three-bay front, narrow full-height glass slot,
  long Neustädtische Kirchstraße return, café strip and glazed roof storey.
  All three source parts and their heights remain unchanged. The storefront
  lettering and red-brown strip are procedural recognition geometry.
- **Komische Oper**, Behrenstraße 54–57, LoD2 `DEBE01YYK00001Ih`: the
  [Landesdenkmalamt inventory 09065009](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065009)
  identifies Kunz Nierade's 1966–67 building shell, sandstone cladding, glazed
  entrance risalit and Fritz Kühn's copper work. Its complete 51 source sheets
  replace the uniform 22.8 m prism presentation. The original source ground is
  2.239 m in the viewer frame; a documented +2.961 m translation keeps the
  established 5.2 m street datum without changing source heights. The exact
  roof top is consequently 28.007 m. Lower front roofs, the high theatre volume
  and every source outline remain distinct. Sandstone joints, mullions,
  three entrance bays, lettering and original procedural copper-fold cues are
  shallow display subdivisions. The [theatre's renovation account](https://www.komische-oper-berlin.de/entdecken/sanierung/)
  describes ongoing works; the planned extension is not modelled as complete.

The British Embassy and Dussmann recognition details remain intact in the same
bounded facade family. These corrections supersede the historical v141 facade
budget explicitly; they do not weaken the frozen original-model fixtures.

## Station source and walkability

The [BVG station plan](https://www.bvg.de/dam/jcr:35d4b73c-7184-4db3-b322-a71a0139babd/unter-den-linden%20900100045.pdf)
(dated 25 August 2025) and the bounded 30 September 2026
[OSM map extract](https://api.openstreetmap.org/api/0.6/map?bbox=13.3873,52.5157,13.391,52.5182)
identify five entrances A–E and two separate lifts. The OSM supplement is
licensed [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); exact
millimetre-transformed anchors, step axes, tags and archive hash are retained in
`unterDenLindenEntranceSource.json`. The raw bounded response stays gitignored.
`scripts/build_unter_den_linden_entrances.py` reproduces the derived supplement.

| Exit | OSM surface node | OSM stair way | World X/Z (m) | Tagged steps |
| --- | --- | --- | --- | --- |
| A | 8196141610 | 881245040 | 1155.038 / 238.981 | 30 |
| B | 8196190732 | 882389498 | 1189.775 / 235.884 | 24 |
| C | 8196190741 | 881245044 | 1280.846 / 228.658 | 33 |
| D | 8196202085 | 881606906 | 1189.457 / 352.962 | 30 |
| E | 8198930782 | 881606908 | 1176.775 / 353.903 | 30 |

Three adjacent escalator ways `881245039`, `881245041` and `882389486` keep
separate source axes. Lift nodes `8196202075` and `8196202076` retain their
surface door nodes `13291147284` and `13280671539`, so their doors face the
mapped approaches. They do not become extra stair holes.

The mapped surface entrance endpoint controls stair direction where an incline
tag conflicts with the public entrance (B/D/E); the original tag remains in the
source record. Stair width 2.3 m, escalator width 1.6 m, the 4.8 m descent,
32 escalator treads, rail sizes and lift cabin dimensions are explicit display
estimates. The raised surface datum is 5.52 m, aligned to the avenue pavement.
The lower station network is not inferred from these surface details.

All eight mouths have descending treads, open upper approaches, side and back
walls, railings and procedural U signs. Five disjoint replacement regions merge
paired stair/escalator extents per exit. Each rectangle includes a 0.5 m margin
and is aligned outward to the four-metre source ground grid. Original coarse
ground is suppressed only within these bounded regions; exact triangulated
paving restores the complete rectangle around its source-axis apertures. Native
half-metre paving cells exclude any full-cell intersection with a mouth. The
same masks are used by the avenue surfaces. `unterDenLindenEntranceFloorAt`
shares the displayed step heights with walking; collision covers represented
side/back walls and leaves each upper approach open. Original road and terrain
source records remain intact.

## External visual references

The following images were inspected as external reference material. No image,
thumbnail, photograph crop, texture or image loader is bundled or used at runtime.
The two new per-file records are merged into both attribution manifests.

| Role | File | Photographer | License |
| --- | --- | --- | --- |
| Reused embassy reference | [Berlin, Mitte, Unter den Linden 55-65, Russische Botschaft.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_55-65,_Russische_Botschaft.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Reused Aeroflot reference | [Berlin, Mitte, Unter den Linden 51-53, Handelvertretung der Russischen Foederation.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_51-53,_Handelvertretung_der_Russischen_Foederation.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Haus Pietzsch front and return | [Berlin, Mitte, Unter den Linden 42, Haus Pietzsch.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Unter_den_Linden_42,_Haus_Pietzsch.jpg) | Jörg Zägel, 22 March 2010 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Existing opera facade | [Berlin Komische Oper, Fassade von 1966.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Komische_Oper,_Fassade_von_1966.jpg) | Wolfsraum, 24 June 2012 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

The opera photograph's foreground demolition dates to 2012 and is not treated
as evidence of present construction. Photographic cues guide only the stated
procedural subdivisions; source data supplies dimensions and placement.

## Bounded representations and verification

All drawn devices use the same constructors and complete static detail. Native
Minecraft geometry remains separate, with no smooth duplicate or hidden solid
infill. Storage below counts typed geometry and instance buffers, not browser or
driver overhead. No runtime geometry population grows with camera movement.

| Contribution | Draws | Instances | Rendered vertices | Buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Six-building drawn facade family | 13 | 2,457 | 60,208 | 189,156 |
| Native facade family | 1 | 507 | 12,168 | 39,180 |
| Complete drawn Komische LoD2 sheets | 2 | 0 | 372 | 8,928 |
| Native Komische roof/exterior shell | 1 | 6,252 | 150,048 | 475,800 |
| Drawn entrances and refill paving | 2 | 792 | 19,182 | 65,016 |
| Native entrances and refill paving | 1 | 2,857 | 68,568 | 217,780 |

Ten focused frontend tests pass, including direct downward raycasts through all
eight mouths (no refill triangle caps them), exact frontage endpoints, all 21
retained source identities, roof height, finite/frozen geometry and deterministic
constructor output. Three focused Python tests verify the complete source
inventory, exact regeneration from both raw sources and OSM step tags. The two
new source scripts and Python test pass Ruff; `bun --bun tsc -b` passes. Whole
viewer integration and browser/release checks are recorded by the release review.

Final integration review also detected the retained flat OSM `metal` escalator
plates above A/B/C. `UnterDenLindenSurfaceApertures.ts` cuts only their already
smoothed, terrain-draped triangles at the five existing paving replacement
regions. Every outside triangle complement and its interpolated source height
remain; the canonical surface payload is unchanged. This uses the existing
metal draw call in both drawn device profiles. Native geometry is unaffected.
The regression `unter-den-linden-surface-apertures.test.ts` checks the actual
streamed metal family against all eight new descending runs at three positions,
plus exact outside-area retention and unchanged input geometry. The final
read-only navigation check also walked each run down and back with the complete
LoD2 obstacle index. No entrance was blocked; nearby lawn plates did not cover
any opening and were left unchanged.
