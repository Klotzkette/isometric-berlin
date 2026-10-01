# Mitte exterior ornaments, v166

`src/app/src/MitteHeritageOrnamentsV166.ts` adds the Heinrich Heine monument in
Weinbergspark, the open portico of St. Elisabeth and Jandorf's corner crown and
upper street facade ornament. The parent heritage module
retains the measured LoD2 church walls and roof. The ornament module owns no
source building parts, removes no source surface and changes no street or
navigation owner.

## Heine monument

The anchor is OSM node `1884384977`, at scene `(1961.049, 3, -1476.786)`.
[Bildhauerei in Berlin, Jörg Kuhn](https://bildhauerei-in-berlin.de/bildwerk/heinrich-heine-denkmal-7904/)
describes Waldemar Grzimek's over-life-size bronze figure seated on a stool,
widely spread legs, gesturing arms, and a rectangular Muschelkalk plinth with a
continuous bronze relief illustrating Heine's work. The Weinbergspark monument
is distinct from the later cast at Am Festungsgraben.

The inspected [Neomicro photograph](https://commons.wikimedia.org/wiki/File:Heinrich_Heine_Denkmal_Eingang_Weinbergspark_Berlin.jpg)
informs the asymmetric pose, broad coat, open stool, projecting feet, swept hair
and plinth relief band. Neomicro, CC BY-SA 4.0. The model uses an approximately
2.1 m figure above a 1.3 m plinth; its uppermost authored point is scene Y 6.38.
These dimensions and its facing angle are visual estimates, not surveyed
dimensions. Relief silhouettes are small schematic figures; no poem or
inscription is reproduced. The photograph is not bundled as a texture.

## St. Elisabeth

The [operator's anniversary brochure](https://www.elisabeth.berlin/de/download/file/fid/322)
and [Deutsche Stiftung Denkmalschutz](https://www.denkmalschutz.de/pressemitteilung/eine-einfache-kirche-ohne-besondere-verzierungen-und-tuerme.html)
describe the 28 by 18 m church and its six Doric piers. The exterior record
distinguishes the square masonry piers from round columns. The inspected
[Jörg Zägel photograph](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Invalidenstrasse_3,_Elisabethkirche.jpg),
CC BY-SA 3.0, informs the square supports, plain capitals, entablature,
triangular pediment, shallow stepped approach, small palmettes and ridge cross.

The portico follows source front endpoints `(1775.406, -1525.680)` and
`(1793.749, -1528.219)`, facing outward in positive scene Z. Its approximate
14 m width, 3.2 m projection, pier section and ornament heights are display
estimates. Six piers leave five open gaps; the space behind the piers remains
open. The main church wall and source roof remain in the source module. The
cross is placed relative to its measured ridge Y 21.122.

## Kaufhaus Jandorf

[Landesdenkmalamt record 09090038](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090038)
identifies the building at Brunnenstraße 19–21 / Veteranenstraße 28 and describes
its curved pier facade, prominent roof rider, upper round-arched windows and
ornamented spandrels below a smaller administration storey. The local OSM way
`33791235` independently carries that heritage record, the historical Jandorf
name and a dim-grey roof tag. It is the correct building.

The main official part `DEBE3Dqh9NPHTUx9` of parent `DEBE01YYK0000Dia` has four
broad roof sheets, an eave at scene Y 27.053 and a ridge at Y 32.825. Those sheets
are all retained. They omit the corner roof rider. A circle fitted to its
surveyed curved facade has center `(1916.027, -1508.834)` and radius 8.003 m;
the new octagonal drum, dark glazed lantern, staged copper cap and fine spire
follow that center. Their Y 30.1–43.65 extent and radii are photo-derived display
estimates. They are not presented as surveyed source geometry.

The inspected [Andreas Praefcke photograph](https://commons.wikimedia.org/wiki/File:Kaufhaus_Jandorf_Brunnenstra%C3%9Fe_Berlin.jpg),
CC BY 3.0, shows the crown profile and facade hierarchy. Thirty-seven round
window heads follow the two source street edges and curved corner. The
ornamented band and narrow administration windows replace the appearance of
the generic upper pane row locally. Five curved bays populate the short corner
facets that the generic facade minimum-length rule left blank. These small
procedural reliefs use no photograph texture or copied commercial plan.

## Rendering and checks

`createMitteHeritageOrnamentRows(native)` returns additive box rows
`[x, y, z, width, height, depth, yaw, color]` and colored triangle sheets. Drawn
mode uses 700 boxes and 9,346 triangles; pointer and touch receive these same
rows. Native mode independently emits 17,314 unrotated orthogonal boxes and
no smooth sheets. Shared surface cells are deduplicated; the caller batches
all instances and surface triangles into its existing compact meshes.

`bun test src/app/tests/mitte-heritage-ornaments-v166.test.ts` passes four tests
with 77 assertions. They check six square supports, five open gaps and rear
porch space in both modes, the seated figure's open stool and leg gap, source
anchor, bounded deterministic output, finite positive dimensions, and zero
native rotations or smooth sheets, plus Jandorf's 37 round heads and bounded
source-corner crown. Local static geometry previews were also
inspected against the three reference photographs. No browser or whole-world
validation is claimed by this focused ornament check.
