# Five schools — bounded recognition, v1.0.85

Step 10 adds small eave lips, console courses and narrow corner reveals to the
five requested existing school sites. There is no replacement building, new
window grid, filled courtyard, changed height, collision obstacle or texture.
The detailed Tiergarten hand/Aula, Steglitz roofs and all city packets remain.

## Evidence and limits

- **Gymnasium Steglitz**, Heesestraße 15: the school's
  [official inspection](https://dashboard.gymnasiumsteglitz.de/f/Bericht-06Y13.pdf)
  distinguishes the 1896 main building and later extension. Complete LoD2
  `DEBE06YYB0000AUq` remains in `steglitzV182Source.json`; this pass adds fine
  upper masonry edges to its Heesestraße walls.
- **Gymnasium Tiergarten**, Altonaer Straße: the
  [school's account](https://gymnasium-tiergarten.de/schule/gebaeude/) and
  [existing evidence](gymnasium-tiergarten-v140.md) identify the blue Aula and
  modern block. Pale corner reveals follow `DEBE01YYK0002KxL` source faces with
  the existing rigid datum translation. The older school and hand remain.
- **Berlin Metropolitan School**, Linienstraße 122: the
  [architect's project account](https://www.sauerbruchhutton.de/en/project/bms)
  identifies the retained prefabricated school and copper-clad timber addition.
  Muted copper upper-edge accents use the actually rendered OSM `98765758`.
  Official `DEBE01YYK000047I` has a pre-existing legacy ownership conflict;
  this modest pass does not add a second shell or claim to reconstruct its
  entire roof addition.
- **Kastanienbaum-Grundschule**, Gipsstraße 23a: the
  [heritage record 09035166](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035166)
  identifies a four-storey brick school, separate three-storey director's house,
  two courts, sill bands and console cornice. The
  [school account](https://kastanienbaumgrundschule.de/schul-abc/denkmal.html)
  confirms restrained brick ornament. Accents distinguish the front OSM
  `23991547` from complete main-school `DEBE01YYK00001Eq` source walls.
  The retained-source conflict at `DEBE01YYK00006XB` stays recorded and unchanged;
  no solid is placed over the entrance/courtyard gap.
- **John-Lennon-Gymnasium**, Zehdenicker Straße 17: the
  [heritage record 09080444](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444)
  identifies Blankenstein's 1885 school; the
  [school contact page](https://jlgym-berlin.de/jlg/index.php/node/25) confirms
  its identity. Existing `DEBE01YYK000064P` retains its +6.91 m rigid Weinberg terrain
  translation, the complete wing plan and
  roofs, with shallow masonry accents on selected Zehdenicker-facing walls.

Member pitch, depth, exact tone and placement are procedural recognition
estimates, **not a surveyed facade/window record**. No new external photograph,
font, plan, image pixel or artwork is used or bundled. OSM streets select the
facing walls; source rings clip every added rectangle. LoD2 and OSM licences
remain dl-de/zero-2-0 and ODbL-1.0. Source paths, hashes, owner IDs and original
wall rings are in `geo_data/regierungsviertel/schools-v185-evidence.json`.

## Runtime and checks

`createSchoolsV185(minecraft=false)` supplies six independently culled batches
(Kastanienbaum front/main are separate). Drawn uses **120 box instances** and
9,120 instance-buffer bytes; Minecraft uses **578 axis-aligned exterior members**
and 43,928 instance-buffer bytes. Each batch reuses one cube, allocates exact
final counts and freezes transforms. No callbacks, lights or render targets.
Desktop and mobile retain identical drawn detail. Native members are a thin
outer skin without hidden solid school infill.

One Python source-hash/face-containment test passes; two Bun budget/native
orientation tests pass (4,668 assertions). Scoped Ruff passes. Integration and
whole-viewer checks remain with the release.

QA targets (world metres): BMS `[1280,15,-870]`; Kastanienbaum `[2085,14,-840]`;
Lennon `[2260,24,-1280]`; Steglitz `[-3200,17,6823]`; Tiergarten `[-2153,20,-115]`.
Use the corresponding named street as the camera approach.

Rebuild with `uv run python scripts/build_schools_v185.py`. It reads delivered
source payloads and retained OSM streets without rewriting them or city packets.
