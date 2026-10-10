# Schools and Rosenthaler/Choriner frontages — v1.0.105

Step 10 adds source-attached recognition details to the five already represented
schools and three local frontages. Original v185 arrays, all building shells,
roof silhouettes, courts, streets, terrain offsets and navigation remain intact.
There is no extension of the covered district and no runtime photographic asset.

## What changed

- **Gymnasium Steglitz:** pale side frames/transoms and shallow segmental brick
  window heads follow the *existing delivered window centres* on three
  Heesestraße source faces. The complete `DEBE06YYB0000AUq` family, source roofs
  and earlier details remain. The [district's school-building record](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/schulbauoffensive/weiterfuehrende-schulen/gymnasium-steglitz-1218110.php)
  identifies the historic masonry building and later extensions. It dates the
  building to 1890; the older v185 inspection reference gave 1896, so the earlier
  date is not repeated as an established construction fact here.
- **Gymnasium Tiergarten:** the photographed red opaque window-panel edges get
  shallow dark framing and a pale top seam. Positions reuse the original part
  ring direction and existing pane register; the blue Aula, older school and
  Hand mit Uhr stay untouched. [School account](https://gymnasium-tiergarten.de/schule/gebaeude/).
- **Berlin Metropolitan School:** warm brick-slip pier accents make
  the retained concrete-panel school legible, with thin seams in the existing
  copper-coloured upper edge. The [architect's account](https://www.sauerbruchhutton.de/en/project/bms)
  documents both brick-slip cladding and the later copper-clad timber extension.
  This pass follows rendered legacy owner `OSM-way-98765758`; it does **not**
  claim to correct the previously documented complete roof/LoD2 ownership
  conflict or reconstruct that extension's entire volume. The free photograph
  is dated 2008 and is used only for the retained lower building.
- **Kastanienbaum-Grundschule:** segmental heads, window-frame subdivisions and
  small terracotta parapet accents distinguish the separate front/director's
  house and main school. The formerly blank selected walls gain shallow glazing;
  the front house follows the photograph's four bays, three levels and two
  lower door readings inside its unchanged legacy nine-metre shell. The [LDA record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035166)
  explicitly describes segmental openings and restrained terracotta decoration.
  Original courtyard passage and source-height limitations remain unchanged.
- **John-Lennon-Gymnasium:** pale frames, transoms and rounder upper window
  heads follow the selected source-bound window register. Shallow glazing fills
  those same openings on the previously blank selected walls. The [LDA record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444)
  identifies the 1885 school. Its whole-parent **+6.91 m** Weinberg translation
  remains exact. The free street photograph supports pale plaster, rounded
  upper heads and darker lower openings.
- **Rosenthaler Platz:** shallow, segmented rustication enhances the lower
  facade registers of the already detailed Circus corner, owner
  `DEBE01YYK0000E7j`. Segments occupy piers between the existing windows; the
  existing hostel lettering, panes, roof and ground-floor frontage remain.
- **be smart academy / Alte Seifenfabrik, Torstraße 134:** red industrial piers
  and spandrels, industrial glazing, silver upper-storey framing, and drawn `ALTE SEIFENFABRIK`
  lettering follow the two street source faces of `DEBE01YYK0000BOt`.
  This is the high-confidence identification of the spoken “Bismarck Academy”:
  the [operator's contact](https://besmartacademy.com/kontakt/) confirms the
  address and its [building account](https://besmartacademy.com/alte-seifenfabrik/ueberblick/)
  locates it at Rosenthaler Platz. Retained OSM node **1389419281**, at
  `13.3999347,52.5293522`, independently identifies the kindergarten. The photo
  and mapped entrance agree with the retained v166 source owner. No invented
  school or frontage has been placed at the square.
- **Choriner Höfe:** thin window transoms enhance the two
  existing street-facing source planes of Choriner Straße 84,
  `DEBE01YYK00005YZ`; no extra window grid is added. The [architect](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe)
  confirms the nine-building ensemble, four perimeter buildings and layered
  entrance facade. The whole ensemble is not claimed as individually rebuilt;
  existing NorthV185 roof details and open courtyards remain. QA found an older
  conflicting generic pane register behind NorthV185’s larger windows. Both
  retained layers remain unchanged; this pass avoids any additional outer
  outlines that would emphasize their conflict.

Fine dimensions, colours and member spacing are **display estimates**. Keeping
the existing pane register avoids a competing second window grid, but that old
register is itself approximate: this release does not claim measured opening
counts or a complete architectural survey. Photographs establish visual cues;
Berlin LoD2 and retained OSM remain the metric/semantic sources.

## Sources and preserved data

Per-file free-photo credits are in
`geo_data/regierungsviertel/schools-places-v205-visual-references.json` (CC BY 3.0,
CC BY-SA 3.0/4.0). Reference images remain outside the repository and viewer.
The release's Wikimedia attribution manifest must include those records.
Geometry keeps Berlin dl-de/zero-2-0 and OSM ODbL-1.0 attribution.

`schoolsPlacesV205.json` stores the exact source wall rings, source SHA-256s,
face-to-member indices and retained rigid parent offsets. The generator reads
existing v185/v182/v163/v166/northV185 sources without writing to any of them.
Both `SchoolsV185` and `PublicPlacesV185` append independent batches; their old
source member arrays remain unchanged (120 school boxes/578 native members,
113 public-place boxes/53 arch strokes).

## Runtime and validation

Nine small, independently culled exact-count cube batches serve all desktop and
mobile profiles. All drawn modes share identical details; Minecraft has explicit
axis-aligned surface members. No callbacks, lights, render targets, textures or
full shell/infill are added. Total additions are **3,256 drawn instances / 247,456 instance-buffer bytes**
and **4,294 native instances / 326,344 bytes** (budgets: 3,300 / 4,600
instances, 360 KB). Each old renderer remains
live alongside the additions.

Five focused Python tests pass, checking repeatable generation, unchanged source
hashes, wall containment (including each curved head), original member counts,
identity and terrain offsets. Four Bun tests pass (38,964 assertions), checking
finite buffers, exact counts, frozen transforms, native orthogonality and the
fixed memory budget. TypeScript passes with the repository's increased heap;
a default 4 GB typecheck exceeded its heap, not the runtime viewer.

Production Chrome QA used the actual built viewer at nine site cameras and then
switched to Minecraft without page errors. Close inspection corrected
rendering issues before release: BMS horizontal accents crossed existing windows
and were omitted; the selected Kastanienbaum/Lennon walls and academy frontage
had no legacy glazing and now have source-supported shallow panes behind the
new frames; additional outer Choriner reveals were omitted because of the
older competing pane layers. Their original shells and all existing detail
remain. Final close production views confirmed Kastanienbaum and Steglitz frame
alignment, and exposed the last Lennon glazing correction before packaging.

Rebuild: `uv run python scripts/build_schools_places_v205.py`.

QA targets in world metres: Steglitz `[-3200,17,6823]` from Heesestraße;
Tiergarten `[-2170,20,-95]` from Altonaer Straße; BMS `[1298,15,-855]`;
Kastanienbaum `[2080,12,-817]` from Gipsstraße; Lennon `[2260,24,-1282]`;
Circus `[2080,18,-1190]`; Alte Seifenfabrik `[1952,13,-1120]` from Torstraße;
Choriner Höfe `[2345,23,-1289]`. The final integrated viewer review belongs to
the release checks.
