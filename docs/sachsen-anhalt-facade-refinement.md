# Luisenstraße 18 facade correction (step 10, v1.0.6)

The Sachsen-Anhalt representation now has its three-storey ochre facade on
the east side facing Luisenstraße. The previous generic four-storey model
selected the north party wall as its primary front and added unverified
windows to the remaining sides.

## Evidence and metric anchor

The exact source edge of `DEBE3DfrmIgrCTOY` runs from
`[560.926, -333.489]` to `[562.863, -309.704]` in viewer metres. Its
`DEBE01YYK00002dn` parent and all four delivered parts (`mIgrCTOY`,
`7c76Dz9u`, `5WQW7BjX`, `T3KBPJfQ`) remain unchanged. The source ground is
4 m and the measured main-body height is 19.03 m; the delivered prism keeps
its original decimetre rounding. No footprint, roof or collision body is
replaced.

The [Landesdenkmalamt inventory, object 09095966](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095966)
records the 1827–28 house and its 1874 alterations, including the closed
oriel that replaced an open balcony. The facade reading was checked against
Kvikk's directly inspected [*Landesvertretung Sachsen-Anhalt in Berlin.JPG*](https://commons.wikimedia.org/wiki/File:Landesvertretung_Sachsen-Anhalt_in_Berlin.JPG),
13 September 2014, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
This is corridor reference 12, credited in both Wikimedia manifests. The
photograph remains a non-bundled visual reference, not a 2026 condition survey.

Three visible floors, nine upper bays, the central oriel and entrance,
layered cornices, hood consoles, eaves dentils and restrained plaster
relief cues follow that evidence. Their local widths, heights, colour
shades and shallow projections are procedural display estimates. Side
party walls receive no speculative window overlays. The entrance is visual
architecture; it does not create access through the retained source solid.

## Modes and bounded geometry

Day, Night, Snowstorm and Schwellenraum use one static instanced signature.
The mobile variant preserves every bay, the oriel and portal, reducing only
dentils, grille bars and relief microdetail. Minecraft has a separate
rectangular block signature. A bounded outer-skin adjustment moves the
whole facade together beyond actual coarse source cells, preserving the
layering of wall, glazing and trim.

Measured signature costs, excluding the retained source bodies:

| Profile | Draw calls | Instances | Rendered vertices | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 1 | 403 | 9,672 | 31,276 |
| Drawn mobile | 1 | 276 | 6,624 | 21,624 |
| Minecraft full | 1 | 276 | 6,624 | 21,624 |
| Minecraft mobile | 1 | 276 | 6,624 | 21,624 |

The signature is texture-free and its drawn geometry remains between
world heights 4.00 m and 19.30 m, below the retained roof. Existing material
hooks supply mode presentation; no photographic image or canvas is loaded.

Seven focused tests (231 assertions) check the exact street edge, source
parts, three-floor/nine-bay hierarchy, all four geometry budgets and texture
absence. Actual triangle rays check each of the 26 glazing fields against
both the retained LoD2 body and real Minecraft source columns, requiring
the first visible surface to be glazing. The existing federal-representation
tests retain their other twelve building contracts with an explicit
exception for this now separately reconstructed facade. TypeScript passes.

Actual Three.js triangles, instance transforms and colours were inspected
in street and isometric software renders, including Minecraft. These are
geometry checks; browser and device interaction were not tested here.
