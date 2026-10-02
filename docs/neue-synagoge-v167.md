# Neue Synagoge — v1.0.67

This bounded step-10 model represents the **present preserved Neue Synagoge /
Centrum Judaicum**, Oranienburger Straße 28–30. The exact current identity is
OSM way `24054915`, Berlin monument `09080249`. The large historical rear
prayer hall is **not** reconstructed.

The [Landesdenkmalamt inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080249)
describes Knoblauch and Stüler's 1859–1866 building, its three horseshoe
portals, coloured brick and terracotta front, projecting tower bases with
octagonal crowns, and large ribbed dome above the twelve-sided vestibule.
It distinguishes the preserved front from the bomb-damaged rear hall,
demolished in 1958. The [current operator's history](https://centrumjudaicum.de/neue-synagoge-berlin-von-1866-bis-heute/)
and [Jewish community account](https://jg-berlin.org/religion/synagogen-in-berlin/synagoge-oranienburger-strasse/)
confirm the restored current place. The community's **50 m** description is
an approximate published overall height, not a surveyed ornament dimension.

Berlin LoD2 tile `391_5820`, parent `DEBE01YYK00007VT`, supplies **four exact
parts and 127 original boundary polygons**:

| Part | Retained source role | Original top, world y |
| --- | --- | ---: |
| `DEBE3DB2ldlC5fDa` | Present preserved main/front/rear body | 31.805 m |
| `DEBE3DNfKjXQh90W` | Main dome/drum envelope | 49.669 m |
| `DEBE3DYIHbEo8Vy5` | Left upper octagonal tower | 38.123 m |
| `DEBE3DUO8TFzQeXH` | Low right octagonal survey body | 8.343 m |

The source ground is **34.144 m NHN → world y=5.2 m**. All source polygon
IDs, rings, holes, walls and roof triangles are retained without changing
their heights. The complete official footprint is **1,054.851302 m²**.
OSM's separately retained footprint is **1,052.143693 m²**; only **0.068411 m²**
is OSM-only. OSM's 21.3 m height explains the former flat prism but is not
substituted for the complete official roof geometry.

The survey's right octagon is only 3.143 m tall, while the primary inventory
and inspected photographs show two crowned upper towers. The model adds a
separately labelled upper right octagon on its **exact original plan**; the
low original source part is not stretched or discarded. Both small crowns
and the main crown enclose the original measured upper vertices. The main
profile, its finial at world y=55.2 m, and all gilded ribs are authored
estimates. These additions have their own roof-query profile; the underlying
source measurements remain unchanged and separately inspectable.

Three freely licensed Commons photographs were inspected:

- [Facade](https://commons.wikimedia.org/wiki/File:Facade_of_Neue_Synagoge_-_New_Synagogue_-_Eastern_Berlin_-_Germany.jpg),
  Adam Jones, Ph.D., **CC BY-SA 3.0**: the three tall arch groups, paired
  triple lancets, portals, terracotta panels and cornices.
- [Dome and tower crown](https://commons.wikimedia.org/wiki/File:Neue_Synagoge,_Berlin,_Kuppel,_140525,_ako.jpg),
  Ansgar Koreng, **CC BY-SA 4.0**: dark metal panels with gilded meridians,
  pointed arch fields, circular roundels, small crown palmette cues and finials.
- [City silhouette](https://commons.wikimedia.org/wiki/File:Berlin-Mitte,_the_New_Synagogue,_shot_from_the_dome_of_the_Berlin_Cathedral.JPG),
  Dguendel, **CC BY 3.0**: the present main crown and flanking smaller crowns.

These are external references only. No photograph, crop, pixel colour sample,
font or protected relief tracing is bundled. Fine members, rosette pattern
and colours are procedural estimates. The historic inscription receives an
empty framed panel rather than invented Hebrew lettering. Per-file credits
are in `neueSynagogeV167Evidence.json` and the release handoff file
`/tmp/new-synagogue-v167-attribution.json`.

The central three portal/window axes occupy the **measured 11.345 m recessed
wall**, approximately 4.38 m behind the flanking tower fronts. Three GPU
batches hold the complete source/dark-panel shell, 1,243 facade boxes, and
11,841 shared arch/rib segments: **1,613,524 bytes**. All four drawn modes use
identical full static detail on touch and pointer devices. Native Minecraft
has one independent orthogonal batch, **16,731 cells / 1,272,204 bytes**.
It uses a 1 m source skin plus 0.5 m detail cells, with no hidden solid fill
and no smooth crown/ornament double.

Integration exports:

- `createNeueSynagogeV167` and `createMinecraftNeueSynagogeV167`.
- `NEUE_SYNAGOGE_V167_PRISM_IDS`, `PARENT_IDS`, `PARTS`, `SOURCE_BOUNDS`,
  `PROFILE` from `neueSynagogeV167Profile.ts`.
- `neueSynagogeV167Contains`, `neueSynagogeV167SourceColumn`, and
  `neueSynagogeV167RoofAt(x,z,minecraft)`.

Exactly one previous **core prism `24054915`** is replaced. The same ID also
owns a legacy facade row in `mitte-streets-v166.json.corePrisms[283]`; its exact
old facade instances are subtracted during central packet integration. No
outer building packet, Mitte-v166 LoD2 parent or existing custom building is
owned. Source-column
matching checks the exact original ring, base y=5.2 m and 24 m quantized native
height; it never suppresses buildings by radius. Source bounds retain the
original part records while their `topY` fields include the estimated crowns.
Roof queries retain every measured triangle plus the authored profile;
Minecraft queries return the exact tops of its 0.5 m navigation cells.

Four Python tests compare every original polygon against the raw archive,
check complete footprint and identity, verify crown containment, and validate
independent finite blocks. Four Bun tests (55,049 assertions) verify roof
queries, exact ownership, independent orthogonal geometry, three/one batches
and full-touch parity. A standalone orthographic model projection was also
inspected. Integrated production front/roof views confirmed the complete
three-crown silhouette and exposed the old facade overlap described above;
central integration removes that exact owner. No whole-world
build or benchmark is run by this module task.

```sh
uv run python scripts/build_neue_synagoge_v167.py
uv run pytest -q tests/test_neue_synagoge_v167.py
cd src/app
bun test tests/neue-synagoge-v167.test.ts
```
