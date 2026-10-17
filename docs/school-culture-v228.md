# School and culture recognition, v1.0.128

Step 10 adds five bounded recognition groups without replacing any earlier
owner, roof, facade grid or source packet. Existing generic/source conflicts are
retained explicitly rather than placing measured details on a different plane.
The workshop is **Rosenthaler Straße 39, first courtyard, left staircase**, not
Otto-Weidt-Platz.

## Verified identities and architecture

- **Jüdisches Gymnasium Moses Mendelssohn**, Große Hamburger Straße 27:
  [school contact](https://jgmm.de/impressum/) and
  [LDA 09035234](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035234).
  Johann Hoeniger's 1906 school has a recessed frontage, rusticated ground floor,
  pale sandstone portal and Baroque references. Narrow portal framing, lower
  masonry joints and original procedural school lettering follow the actual
  delivered `23816407` prism. Its 12 m legacy envelope differs from retained LoD2
  `DEBE01YYK00005Ie`; this pass retains that documented conflict and does not
  claim a complete measured school reconstruction or introduce a second grid.
- **Museum Blindenwerkstatt Otto Weidt**:
  [operator directions](https://www.museum-blindenwerkstatt.de/kontakt) and
  [LDA 09050142](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050142)
  establish Rosenthaler 39 and the first-floor workshop in the long side wing.
  OSM node 1653339015 and way 147686950 locate the first-courtyard frontage.
  A modest information band and plaque use the actually rendered wall of
  legacy prism 47686950. No unrelated Otto-Weidt-Platz building is changed.
- **Sophienkirche**:
  [LDA 09011358](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011358)
  describes a tall gable roof, west tower, rusticated lower stage, columned bell
  levels and layered copper hood with golden sun.
  [Berlin's official site](https://www.berlin.de/sehenswuerdigkeiten/3559916-3558930-sophienkirche.html)
  gives the tower height as 69 m. The retained official archive
  `LoD2_391_5820.zip`, parent `DEBE01YYK0000080`, has **no BuildingParts**, roof
  type 9999 and only 13.4 m measured height. Both the original and its displayed
  v166 model are retained. A bounded reconstruction adds the missing roof and
  west tower inside that existing footprint. The 69 m total height is documented;
  tower tier dimensions, local west-axis placement, gable ridge 30.1 m in world
  coordinates, colours and subdivisions are **recognition estimates**. They
  must not be described as surveyed roof geometry. New roof support/collision
  uses the same roof sheets and tier footprints; the approach remains open.
- **Gymnasium Steglitz**, Heesestraße 15:
  [school](https://gymnasiumsteglitz.de/unsere-schule) and retained
  [v185 evidence](schools-v185.md). Existing complete owner
  `DEBE06YYB0000AUq`, roof, window rows and v205 arches stay unchanged. Small
  upper brick teeth, inset masonry course and corner joints add articulation
  without covering glazing or introducing another window pattern.
- **Gymnasium Tiergarten**:
  [school building account](https://gymnasium-tiergarten.de/schule/gebaeude/)
  and [retained v140 evidence](gymnasium-tiergarten-v140.md). The 13 source parts,
  blue Aula, red panel grid, entrance name and Hand mit Uhr remain. Added details
  are chrome handles and head reveal at the **existing** Aula doorway, plus four
  narrow opaque-cladding joints. No new doorway or competing school lettering.

All facade member dimensions, exact colour tones and unmeasured placement are
procedural estimates. No photograph, external font, artwork texture or new
Commons image is used or bundled. Official descriptions establish architecture;
LoD2/OSM establish geometry. Their existing dl-de/zero-2-0 and ODbL notices apply.
The bounded OSM selection is `school-culture-osm-v228.json`; immutable source
hashes, exact legacy rows and selected wall rings are in
`school-culture-v228-evidence.json`.

## Runtime and validation

`createSchoolCultureV228(native=false)` produces five independently culled,
frozen groups, equal full drawn detail on desktop and mobile. Drawn mode has
six meshes; native has five axis-aligned instance batches and no smooth roof
sheet hidden beneath them. Native roof members sample hollow outer surfaces.
There are no callbacks, lights, render targets, textures or residency changes.
The runtime payload is 281,655 bytes (43,583 bytes gzip before bundling), around
4,500 native instances plus procedural letters, and less than 0.5 MiB instance data.

`schoolCultureV228Profile.ts` exposes roof support and added-volume collision.
A compact independent navigation table retains 84.7 KiB of typed native support
coordinates, without retaining the weak renderer payload. Ground support is
limited to current feet height plus a 0.55 m step, preventing roof teleports.

Tower footprint containment in the retained church, source-hash preservation,
wall-face containment, fixed counts, finite native matrices, axis alignment and
open church approach are tested. Three Python and three Bun tests pass; scoped Ruff
and frontend TypeScript compilation pass. Whole-viewer tests remain the release
integration's responsibility.

QA targets in world metres: Jewish school `[1910,13,-633]`; workshop first court
`[2099,10,-560]`; Sophien west approach`[1920,9,-687]`, roof/tower
`[1945,45,-692]`; Steglitz `[-3200,17,6823]`; Tiergarten `[-2150,8,-94]`.

Rebuild via `uv run python scripts/build_school_culture_v228.py`. It only writes
new v228 files. `school-culture-osm-v228.json` is a retained bounded extraction
from the existing local OSM snapshot, with the workshop address cross-checked
against the operator.
