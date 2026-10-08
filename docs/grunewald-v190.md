# Grunewald relief, Brücke-Museum and Grunewaldturm — v1.0.90

This addition refines the existing Grunewald area. It does not expand a rectangle across Berlin, invent new streets or remove previous source geometry to improve performance. Existing mobile, geometry-residency and decoded-file limits remain unchanged.

## Source-backed relief and lakes

`build_grunewald_terrain_v190.py` samples Geoportal Berlin's ATKIS DGM1 (dl-de/zero-2-0); `grunewald-terrain-v190.json` records the 25 retained source archive URLs and hashes. The displayed datum is metres NHN minus 30. A 32 m field follows the mapped Grunewald forest (OSM relation 3410), the complete five lake polygons and a small museum foundation area. An 8 m refinement follows Karlsberg, with a continuous transition to the general field. A 128 m smooth apron reconnects the named area to the previously flat surroundings. This is a bounded sampled landscape, not a claim of centimetre-resolution citywide terrain. Native mode uses new 8 m terraces; no existing terrain resolution is reduced.

Full retained OSM shore vertices remain authoritative for Schlachtensee (way 4317997), Hundekehlesee (4407810), Grunewaldsee (4407811), Krumme Lanke (4469529) and Teufelssee (4678354). Lake surfaces remain horizontal at median DGM samples within their complete polygons. The 32 additional existing water polygons touching the active relief are recorded separately in `additionalWater`: 27 contained ponds keep their measured DGM levels. Five connected Havel/Wannsee/Stößensee polygons retain the uniform −1.15 m displayed water plane verified from v1.0.89 source triangles, including Lieper Bucht. This preserves continuity with the same water outside the bounded relief. Their measured samples remain recorded as `measuredWaterY`; `displayWaterPolicy`, `baselineWaterY`, `baselineWaterTriangles` and `baselineRelease` make the distinction explicit. `connectedWaterBoundaryChecks` records source-contained points on both sides of edited/unchanged packet edges; regression tests compare actual drawn/native water triangles, heights and original colours there. Native bank tops are divided at each 8 m grid crossing to match the horizontal native terrain; their original shoreline courses are retained. Roads, paths, banks, ink, building bodies, trees and walking-ground queries follow the same elevation field. Buildings move rigidly at one reconstructed source-part anchor, even across packet boundaries. Each original tree keeps its complete trunk/crown geometry and receives a single vertical displacement. Forest trees remain the previously documented illustrative planting, not surveyed tree positions.

## Brücke-Museum and the tower's identity

The landmark on Karlsberg is the **Grunewaldturm**, formerly Kaiser-Wilhelm-Turm, not a Bismarckturm. The district documents a 55 m tower and a viewing gallery at 36 m, on the roughly 79 m NHN hill. The retained local DGM sample is 77.98 m NHN at the recorded tower reference position. See the [district's tower account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/tuerme/artikel.1129193.php).

The official LoD2 record `DEBE04YY50003FsE` contains the low 6.528 m terrace/base envelope, not the upper tower. It remains complete. The previous generic OSM fallback incorrectly extended a 55 m solid over the entire terrace. Only this exact fallback owner and its elevated ink are substituted. Native substitution uses that same owner’s complete original voxel footprint, including block-cell overhangs, so an old tower-sized block shell cannot remain around the replacement. The narrow brick shaft, open lower arches, 36 m gallery, corner turrets and steep 55 m top use the published heights, mapped location and OSM upper-turret corner positions. Architectural subdivisions, rail bars and the small emblem are independent recognition drawings, not a measured façade survey. The nearby restaurant is not replaced.

The Brücke-Museum keeps every measured wall, roof sheet, courtyard and source part from `DEBE06YYB0000Bv3` and annex `DEBE06YYB0004u5T`. Low roofs, concrete, olive frames and restrained glazing refer to the museum's [architecture description](https://www.bruecke-museum.de/en/museum/63/architecture) and [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075316). Individual pane divisions and concrete board lines are declared interpretive details. No proposed future renovation is represented as existing construction.

`grunewald-landmarks-v190-source.json.gz` retains the selected measured source data, with extraction/source hashes in the evidence file. The drawn models contain 244 original measured triangles and 466 restrained detail boxes; separate native models contain 1,114 merged exterior block runs. Both sites have independent static culling, texture-free materials and complete navigation parts. Previous dedicated v187 southwest/west models contain neither site; none is duplicated or suppressed. Their existing representative ground anchors all remain outside this new elevation field.

## Visual-reference credits

The following CC BY-SA 4.0 photographs were inspected as non-bundled visual references. No source photograph pixels, texture maps or traced meshes are shipped:

- [Grunewaldturm-01-Frontansicht.jpg](https://commons.wikimedia.org/wiki/File:Grunewaldturm-01-Frontansicht.jpg), **Muck**: brickwork, open gallery, pointed arches and roof form.
- [2021-05-26-Bruecke-Museum-Berlin-Dahlem-Bussardsteig-Werner-Duettmann-A.jpg](https://commons.wikimedia.org/wiki/File:2021-05-26-Bruecke-Museum-Berlin-Dahlem-Bussardsteig-Werner-Duettmann-A.jpg), **Gunnar Klack**: concrete, glass and roof-edge materials.

[CC BY-SA 4.0 license](https://creativecommons.org/licenses/by-sa/4.0/). Geometry uses OpenStreetMap contributors (ODbL) and Geoportal Berlin official LoD2/DGM data (dl-de/zero-2-0), as recorded in the source evidence and project NOTICE.

## Reproduction and preservation audit

The immutable packet baseline is tag `v1.0.89`. Generation stages files privately under `geo_data/regierungsviertel/raw/grunewald-v190/packets`; it never writes the public manifest itself.

```sh
uv run python scripts/build_grunewald_terrain_v190.py --samples
uv run python scripts/build_grunewald_landmarks_v190.py
uv run python scripts/build_grunewald_terrain_v190.py --packets
uv run python scripts/repair_grunewald_banks_v190.py
uv run pytest tests/test_grunewald_v190.py
cd src/app && bun test tests/grunewald-v190.test.ts
```

The 262 affected primary packets retain all prior XZ source courses. Original terrain triangles are subdivided at measured field planes, while their coverage remains intact; architecture and trees preserve their full shape and colours. Explicit full-owner substitutions are limited to the two named landmarks. Source navigation rings for land, roads, bridges and water are preserved. Complete per-source-triangle and ink placement runs, exact replacement counts and parent offsets live in `grunewald-v190-packet-details.json.gz`; its compressed hash, size and decoded size are verified from the small `grunewald-v190-packet-audit.json` summary.

Packets exceeding the existing 650,000-byte compressed or 2,600,000-byte decoded limits are divided into ordered triangle pieces and 71 separate geometry-only companions. Each primary keeps its complete navigation and ink; companion navigation is empty. `splitPackets` records the unsplit hash, per-mesh piece counts and mesh allocation, while `replacementDescriptors` and `extraDescriptors` contain the final published hashes. No triangle is dropped to satisfy a budget and runtime limits are not increased. The audit is offline evidence, never a browser asset.

Focused verification covers measured source envelopes, precise 55 m tower height, all retained landmark navigation parts, bounded terrain, original source navigation, intact rigid forest shapes, final file budgets, complete placement accounting, native axis-parallel volumes and static runtime batches. Headless Chrome model views are useful geometry checks; they do not establish physical iPhone stability or constitute a release claim.
