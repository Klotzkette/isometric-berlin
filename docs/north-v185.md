# Northern neighbourhood accents — v1.0.85

Step 10 adds a small, texture-free recognition layer. Every previous building,
roof, path, tree, garden surface and terrain field remains rendered. No source
owner is replaced, no courtyard is filled, and navigation is unchanged.

## Scope and evidence

- **Kulturbrauerei:** OSM site way `32294784` selects 20 retained Berlin LoD2
  owners with exposed faces. The [operator's history](https://www.kulturbrauerei.de/gelaende/geschichte/)
  documents the brewery ensemble, six courts and restored clinker facades;
  [Berlin's description](https://www.berlin.de/sehenswuerdigkeiten/3560308-3558930-kulturbrauerei.html)
  identifies the red-brick architecture. Thin brick pilasters, courses, recessed
  blue-grey glazing and repeated arched profiles improve recognition without
  a replacement wall skin. Window counts, colour swatches and trim proportions
  are estimates, not surveyed openings or a reconstruction of every elevation.
- **Hagenauer Straße:** 14 retained frontage owners receive shallow window,
  plinth and cornice accents. Kerbs follow OSM ways `4606266`, `1133761541` and
  `1415465562`; all three carry a width of 11.2 m with `source:width=ARCore`.
  This is tagged OSM evidence, not an independent survey. Kerb height/thickness
  remain display estimates. Existing sett/asphalt roads and sidewalks remain.
- **Choriner Höfe:** The user's “Corinna Höfe” is treated as the stated working
  assumption **Choriner Höfe**. This pass accents only the identified Choriner
  Straße 84 building, OSM way `235997895`, official owner `DEBE01YYK00005YZ`.
  [Collignon](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe)
  confirms the address and ensemble arrangement;
  [Haas](https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe)
  describes nine separate houses and mixed clinker/plaster materiality. Modest
  low stone bands and window reveals are added here; the other eight houses
  are retained as delivered and are not claimed as individually reconstructed.
- **Weinbergspark:** 78 modest flowering shrubs occupy only the seven mapped
  OSM beds, ways `1298338656`–`1298338661` and `1298338663`, clipped again to the
  exact already-delivered v166 planted surfaces. No foliage reaches a mapped
  path, sandpit or water. Plant spacing/species/colour are illustrative. The
  [district's park inventory](https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/parks-und-gaerten/)
  supplies context. The v174 blue rubber surface, v166 Heine monument, benches,
  playground, trees and all v176 DGM slopes/basin elevations are untouched.

The 66 facade rectangles are checked against original LoD2 vertical wall
polygons, using the three cached official source tiles recorded by URL and
SHA-256 in `northV185.json`. Their upper edges are constrained below sloping
roof/gable parts, rather than using a parent building's maximum envelope as an
eave. Complete source footprint rings, holes, heights and selected projected
wall polygons remain in the small evidence file. Only exposed owner edges are
eligible; party walls are rejected. There are no full replacement wall panels.

No protected drawing or photographic pixels are copied, traced or shipped.
OSM retains ODbL-1.0; official LoD2 retains dl-de/zero-2-0. Existing attribution
continues to apply. Sources were checked on 8 October 2026.

## Rendering and validation

`createNorthV185(minecraft=false)` is integrated by the parent task's shared
outline-detail loader. Every drawn mode and touch/pointer profile uses the
same 5 batches, 4,064 instances and 315,488 GPU bytes. Industrial openings
reuse one 168-vertex arched profile. Minecraft independently uses 4 batches,
9,562 orthogonal instances and 729,304 bytes. Native strip cells use projected
X/Z extents for oblique source edges. There are no textures, animation loops,
new fetches or maximum-capacity buffers.

Rebuild: `uv run python scripts/build_north_v185.py` with retained source caches.
Three Python tests check source-edge attachment, true wall containment, exact
delivered planted-land clipping and tagged street width. Four Bun tests check
fixed draw/memory budgets, native orthogonality, no textures, fixed transforms,
hill-following placement and absence of replacement/collision payloads.
Both targeted suites, Ruff and TypeScript validation pass. Camera poses are
stored in the data for the parent task's integrated browser review.
