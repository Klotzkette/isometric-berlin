# Moabit church source reconstruction — v269

Sankt Paulus and Heilandskirche replace two confirmed 14 m fallback prisms with their complete retained Berlin LoD2 source and documented tower silhouettes. This resolves the Sankt Paulus item left open in `height-reconstruction-v259.md`. The separately named Lutherkirche at Bülowstraße is in Schöneberg and remains outside this Moabit task. No other church, surrounding block, tour stop, residency budget or coverage changes.

## Exact ownership and complete source

| Church | Original core ID | Complete Berlin owner | Source archive | Parts / original wall and roof sheets | Published overall height |
|---|---|---|---|---|---|
| Sankt Paulus | `06483932` (OSM way 106483932) | `DEBE01YYK0002JYD` | `LoD2_387_5821.zip` | 6 / 336 | 45 m |
| Heilandskirche | `37533771` | `DEBE01YYK0002JYQ` | `LoD2_387_5820.zip` | 5 / 194 | 87 m |

Every original sheet is preserved and triangulated in the drawn model, including small vestibules, complete roofs, apses and annexes. Original X/Z coordinates are unchanged. Original source Y is shifted rigidly by +2.096 m / +1.496 m to match each actual delivered fallback base at **y=5.2**. The source archives, core prisms and core voxels remain byte-identical. Their hashes, complete original parts, old prism records, roof additions and foreign-column controls are retained in `geo_data/regierungsviertel/moabit-landmarks-v269-evidence.json.gz`.

Only the exact two unchanged prism records yield after the complete required factory succeeds. Their native counterparts yield only **60 + 74** exclusive original 4 m voxel tuples. Shared or newly overlapped cells remain. Source-ID rejection precedes fingerprinting; bounds are read once, distant sources rejected against the two site bounds, and only nearby matching neighbours are fingerprinted. No district or broad spatial suppression is used. Existing monastery and neighbouring owners, including `29350022`, `29350023`, `29350025` and `29350027`, remain intact. There is no overlapping AltMitte source owner at these sites.

## Architecture and uncertainty

The [Dominikaner account](https://www.dominikaner-berlin.de/kloster/das-kirchengebaeude/) establishes Sankt Paulus's two 45 m towers, octagonal belfries and eight-sided copper helms, orange-red brick, green glazed brick accents, rose and three doors. The [Landesdenkmalamt record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050242) confirms the Waldenserstraße front and distinct monastery. The retained source already supplies the complete steep hall and apse roofs. The model extends the two actual source tower footprints into the documented upper silhouettes and adds the central eight-petal rose, three closed entrance cues, blind lancets, belfry louvers and glazed edge courses. Window ornament is clipped to actual walls; native detail follows its own exposed cardinal wall planes.

Heilandskirche's retained tower stops at y=53.619, and its main nave source roof is only 3.131 m above its own ground. The model retains all those original sheets and restores the photographed steep red nave roof above them. Its **15 m eave and 28 m ridge** are explicitly visual estimates; these are not surveyed dimensions. The upper tower follows the existing footprint into an eight-facet pointed helm, four clock faces and paired belfry openings. The [parish](https://www.ev-gemeinde-tiergarten.de/donnerstag-7-mai) states 87 m overall; the [official refurbishment account](https://www.turmstrasse.de/projekte/heilandskirche) says 88 m. This model uses the parish's 87 m, records the 1 m disagreement, and does not reinstate the vanished historical roof rider or the former tall corner towers.

Intermediate tower stages, slopes, small window divisions, clock details, masonry courses and colours are source-photo-informed display estimates. Closed door cues do not promise an accessible interior. The complete original floor-plan outlines remain solid; public paths remain passable.

The [reference ledger](moabit-landmarks-v269-references.json) records exact uses and credits. The inspected Sankt Paulus exterior is published by Erzbistum Berlin / Dominikaner; its individual photographer is not identified (the article text credits Sabine Steinhoff). The inspected Heilandskirche photograph is **A. Savin, Wikipedia**, 26 March 2021, [Free Art License 1.3](https://artlibre.org/licence/lal/en/). Images are reference material only: no photographic pixels, textures or UVs are shipped. Original map/source credits remain Land Berlin / Geoportal Berlin, `dl-de/zero-2-0`, and OpenStreetMap contributors, ODbL 1.0.

## Geometry, navigation and integration

`createMoabitLandmarksV269(native=false)` creates the complete required two-site group synchronously, with one mesh per church, before exact source owners can disappear. Both mobile and desktop receive identical detail. Native is independently constructed from the complete roofs into a **0.5 m world-cardinal** shell, including orthogonal silhouettes and facade accents; it is not a rotated or recoloured drawn mesh. Only exposed faces are stored. Texture-free basic/day and standard/night materials share geometry, and transforms are frozen.

The small `MoabitLandmarksV269Profile.ts` has no Three import. It exports `isMoabitLandmarkSourceV269(value)`, `createMoabitLandmarkColumnTesterV269(prisms,cell)` and `moabitLandmarkSolidsV269(native=false)`. Each solid carries the exact `sourceId`, complete ring/holes, base, maximum height and `topAt(x,z)`. Root filters solids by the matching old prism ID and gates both families by the current visual mode. Roof support follows all represented roof triangles; native support uses the same cell-centre sampling and half-metre height quantisation as its visible terraces. Shared integration uses `replaceMoabitLandmarkPrisms:true` and installs the complete required factory before core/native/preview/worker exclusions.

| Site | Drawn triangles | Native triangles | Native occupied plan cells |
|---|---:|---:|---:|
| Sankt Paulus | 3,832 | 26,926 | 5,060 |
| Heilandskirche | 2,191 | 16,664 | 4,836 |

Total geometry data JSON is **1,476,643 bytes**; the lightweight ownership/roof profile is **78,635 bytes**. Each mode has two meshes; each decoded mode including normals remains below 2 MB. No new stream descriptor, cache, prefetch allowance or tour stop is added.

## Validation and QA

Four focused Python tests pass: all input hashes and all 530 original sheets/vertices; exact source footprints and exclusive columns; complete height and independently cardinal native geometry; rendered native roof/nav agreement. Three Bun tests pass with **74 assertions** against the actual complete delivered core prisms, voxels and ground. They exercise exact mutations/new overlaps, both required model families, and the integrated production navigation with `replaceMoabitLandmarkPrisms:true` while switching drawn → native → drawn. Both routes complete without respawn, jump or ground-height step above 0.35 m:

- Sankt Paulus: `[-2446,-1111]` → `[-2415,-1105]`.
- Heilandskirche: `[-2165,-864]` → `[-2158,-831]`.

The source-neighbour-checked QA cameras are Sankt Paulus front `[-2428,29,-1127]` → `[-2431,22,-1093]`, complete building `[-2404,62,-1140]` → `[-2438,23,-1075]`; Heilandskirche front `[-2183,53,-813]` → `[-2142,34,-847]`, whole church `[-2192,100,-794]` → `[-2128,39,-846]`. Parent IAB inspection found both representations plausible and checked full tower height with the wider Heilandskirche camera `[-2230,110,-760]` → `[-2128,42,-846]`. Root owns final shared compiler/build and release checks; this subtask launched no compiler or browser.

Reproduce with `uv run --no-sync python scripts/build_moabit_landmarks_v269.py`, `uv run --no-sync pytest tests/test_moabit_landmarks_v269.py -q` and, inside `src/app`, `bun test tests/moabit-landmarks-v269.test.ts`. The bounded generator reads only retained inputs and the reference ledger. No source downloads are needed.
