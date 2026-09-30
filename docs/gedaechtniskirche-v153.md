# Gedächtniskirche refinement, v1.0.53

This step-10 change refines the existing five-building ensemble at
Breitscheidplatz. It neither enlarges the bounds nor adds a tour stop.

## Metric anchors and evidence

The five retained OSM anchors are church way `15218371`, bell tower
`15218372`, ruin `15218373`, foyer `15218374` and chapel `15218375`.
The original `CITY_WEST_PROFILE` positions, ruin orientation and building
heights remain unchanged. The drawn and block-native readings use the same
anchors.

The church's [ensemble account](https://www.gedaechtniskirche-berlin.de/bauensemble/ensemble-aus-alt-und-neu)
describes the surviving 71 m ruin and the octagonal church, hexagonal bell
tower, chapel and foyer arrangement. Its
[architecture account](https://www.gedaechtniskirche-berlin.de/gebaeude/architektur)
gives the church's 35 m diameter and 20.5 m height and describes almost-square
concrete cells with blue, red, green and yellow glass. The
[bell-tower account](https://www.gedaechtniskirche-berlin.de/geschichte/das-kirchen-ensemble/gebaeude-1895-1963/der-glockenturm)
gives 53.3 m body height, 12 m diameter, a 5.3 m gold pole, 1.8 m cross,
5,152 panes and a broad steel band at the bell chamber. The previous OSM
prism estimates the bell body at 53.5 m; the already established official
53.3 m profile remains the presentation authority. The 0.8 m model podium is
separate from these architectural heights.

[Hwyrd's 24 July 2024 street photograph](https://commons.wikimedia.org/wiki/File:Kaiser-Wilhelm-Ged%C3%A4chtniskirche_Sommer_2024_2.jpg),
licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), supplies
visual evidence for the weathered masonry, layered arches, gold clocks,
belfry subdivisions and fractured copper-grey crown. It is an external
reference only: no photo, crop, tracing or texture is bundled or fetched at
runtime. Temporary scaffolding in the photograph does not become part of the
permanent recognition model.

## Representation

- The modern church and bell tower now have correctly oriented polygon faces
  with dense, near-square concrete-glass fields. Previously the church had
  only a few broad horizontal bands, while the bell's vertical ribs did not
  consistently follow its polygon faces.
- Glass uses four muted blue colours with sparse red, green and gold accents.
  The separate merged glass batch uses blue emission at night. Concrete,
  corners, flat roofs and the bronze entrance remain distinct.
- Twenty columns by twenty-nine rows per church face and nine by eighty per
  bell face are local recognition subdivisions, not a claim to reproduce the
  exact historic pane inventory or Gabriel Loire's individual artworks.
  Cells omitted for the lower opaque register and bell-chamber band remain
  concrete. The final drawn mesh contains 8,424 glass quads.
- The ruin has four gold clocks, concentric portal archivolts, masonry course
  cues, short blind arcade openings and slender belfry jambs. The lower
  through-opening remains empty and traversable.
- An eight-sided thin wall shell replaces the previous filled crown stacks.
  Its centre is empty and its irregular top still reaches exactly 71 m.
  Individual local stones, arch radii and fracture heights remain procedural
  proportions, not survey data.
- A separate native Minecraft root supplies all five buildings as cuboid
  surfaces, the stepped hollow crown, four block clocks and a blue grid.
  Exact existing OSM prism IDs/rings identify the two generic source bodies
  that would otherwise close or duplicate the new ruin and bell tower.
  The remaining three ensemble parts are absent from that generic payload.
  The original ruin also includes low-wing/apse projections beyond the authored
  core. Their exact 112.9650867 m² polygon difference is retained at the source
  height (5.2–14.2 m) in `gedaechtniskircheSourceParts.ts` and rendered in both
  representations; replacing the generic core does not erase those wings.
  The narrow source strip crossing the photographed through-arch keeps its
  complete top/plan as an overhead lintel at 14.0–14.2 m, while the two remaining
  low-wing parts keep their complete 5.2–14.2 m wall height. This explicit
  recognition correction prevents the generic strip from re-closing the arch.

## Resource budget and checks

All four drawn modes retain the same full static detail on pointer and touch.
The entire City West layer has **12 renderables, 64,144 stored vertices and
1,167,162 geometry bytes**, bounded at 12 / 65,000 / 1,180,000. This includes
one additional blue-glass draw call. The new glass is indexed surface geometry;
there are no per-pane scene objects, transparent layers or image textures.
The Minecraft ensemble is **one InstancedMesh with 7,922 blocks**, sharing
one cube and one material. It has a fixed 8,100-instance cap and no animation
or streaming loop.

The church-focused test suite verifies retained metric anchors and height,
all fourteen modern facade planes, near-square pane proportions, the empty
crown centre, open drawn and Minecraft portal, native source ownership and
fixed full/mobile budgets, source-wing area and arch collision. Isolated Chrome
WebGL captures confirmed the facade grid, source wing, empty arch and native
colours, and caught/corrected coincident roof caps before integration. TypeScript compilation also passes. Parent release
QA supplies integrated browser checks; this document does not claim a physical
iPhone test.
