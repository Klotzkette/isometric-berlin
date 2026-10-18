# Spree public street facades v231

Fifteen retained building families receive bounded refinements on thirty existing
wall planes: Haus Bastian, Magnushaus and Simon-Palais, plus twelve ordinary
fronts facing Georgenstraße, Am Kupfergraben, Burgstraße, Monbijouplatz and
Anna-Louisa-Karsch-Straße. No resident names or private-house associations are
collected or displayed. Previously authored Berliner Ensemble, Bode-Museum,
Hackescher Markt, Kalkscheune and theatre details are not replaced.

## Evidence and limits

* [David Chipperfield Architects, Am Kupfergraben 10](https://davidchipperfield.com/projects/am-kupfergraben-10)
  establishes four storeys, tall rooms, reclaimed brick masonry with stone
  courses, large openings and untreated wooden panels. The abstraction gives
  Haus Bastian irregular broad openings, wooden panel divisions and stone
  courses on its retained stepped source walls. Exact opening widths and
  offsets are display estimates, not measured facade photogrammetry.
* [Landesdenkmalamt, Magnushaus](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080408)
  documents the high basement, three-axis central projection and four colossal
  pilasters. These replace the former dense estimated grid on the public canal
  front. Main wall, hipped roof and rear geometry remain the official source.
  Ornament, window sizes and warm plaster hue are restrained display estimates.
* [Patzschke Architekten, Simon-Palais](https://patzschke-architektur.de/portfolio/simon-palais/)
  documents the 1910 building and its restored restrained classical facade.
  The river-facing source wall receives a warm red facade, divided openings,
  corner pilasters and horizontal courses. Seven horizontal axes and their
  dimensions are an abstraction, not a surveyed opening count.
* The twelve ordinary fronts use unchanged v169 opening centres, not a second
  window grid. Source wall endpoints and eaves come directly from the retained
  complete Berlin LoD2 leaves. The exact public street relationship is checked
  against retained `osm.gpkg` road lines. Existing glazing remains, with shallow
  jambs, transoms and projecting sills. Their original estimated opening rhythm
  is explicitly **not** promoted to a claim of surveyed accuracy.

Only source descriptions and externally viewed references were used. No image
file, photographic texture or external fetch is shipped. Existing Geoportal
Berlin / OpenStreetMap attribution remains applicable.

## Exact ownership and preservation

`build_spree_facades_v231.py` reproduces the old facade recipe using its original
appearance baseline and surrounding source footprints. Position **and** original
colour triangle multisets select exactly **1,212** old estimated window triangles
on nine named wall sheets. Immutable complete-mesh fingerprints guard the runtime
transfer; a changed packet retains its previous display until re-audited.

The named source-wall colours are corrected in **356** existing colour-buffer
vertices across both readings. Native owner identity is first proven against
independently replayed original 2 m surface geometry; only outward vertical
faces belonging to the nine selected source walls qualify. The original native
cell boundary tolerance is at most one cell, never an unrelated footprint mask.
Shared vertices incident to an unselected face are excluded. Roof planes,
positions, indices, navigation, courtyards, and every previous packet byte remain
unchanged. The evidence file records source and eligible packet SHA-256 values.
No resident source body triangle is removed.

`SpreeFacadesV231.ts` supplies 2,773 drawn instances and 4,190 independent
orthogonal native instances, grouped into fifteen cullable meshes. Ordinary
native fronts gain the measured eave/plinth courses without a competing fine
window grid. Drawn mobile and desktop share identical geometry. Source JSON is
about 18 KB and ownership JSON about 8 KB; no texture, new light, live animation,
new district coverage or residency-budget change is introduced.

## Integration and validation

* Add `createSpreeFacadesV231(native)` to the existing construction transaction.
* `transferSpreeFacadeV231` uses the existing exact triangle transfer contract.
* `applySpreeFacadeColoursV231` runs after v213 source appearance, before geometry
  upload/parking. The same path handles reloaded packets and either reading.
* `spreeFacadesV231.json.sites` is a constructor-only weak JSON field.

Targeted validation: **3 Python tests**, **4 Bun tests**, Ruff all pass. Tests
replay the immutable receipt, verify exact source anchors and existing opening
centres, check orthogonal native instances, retain all unrelated index/position/
colour bytes and reject modified fingerprints. Full production build and actual
browser acceptance remain the parent task's release checks.

Review cameras (position → target):

* Kupfergraben: `[1775,48,40]` → `[1678,13,-55]`.
* Simon-Palais: `[1590,55,-330]` → `[1515,17,-400]`.
* Burgstraße: `[1945,44,-185]` → `[2020,14,-235]`.
