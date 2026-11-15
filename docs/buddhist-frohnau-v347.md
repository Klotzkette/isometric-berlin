# Buddhistisches Haus Frohnau — V347

The new finite site is the official garden monument **09046233** at Edelhofdamm 54. Its 17,397.44 m² polygon is taken directly from the Berlin heritage WFS. The complete prior public ground footprint is subtracted; the resulting addition overlaps no earlier ground. The surrounding quarter and neighbouring private houses are not inferred from the site's bounding rectangle.

The source retains **six complete LoD2 parents, nine leaf parts and 125 wall/roof sheets**: the main mapped complex, Ceylonhaus, Kuti, and the small nested source structures. Every source wall and roof remains in Drawn at the established centimetre packet precision. Native independently constructs its one-metre cardinal skin from those source sheets, including matching roof caps. Both families use the same full detail on touch and desktop. No existing source owner or packet is removed.

The hillside uses original DGM1 samples at four-metre spacing. Relative height is retained against a local display datum anchored at the mapped bottom approach; the garden boundary transitions to the established y=3 scene over six metres. The data is bare-earth terrain, not a floor or stair survey. Building ground/roof elevations share the same datum. Source terrain inside buildings is not rendered through the building shells.

Seven current OSM path lines include the mapped 1.5 m entrance staircase. The district's site description and its 2024 anniversary report document **73 steps and eight landings**. The represented 9 flights contain 73 risers and 8 intermediate landings, connected between the mapped endpoints and the DGM rise of 10.58 m. The individual 0.31 m tread lengths, 0.145 m risers and 1.1 m intermediate platforms are display estimates; their exact distribution is not documented by those sources. Both branches retain all 81 walkable floor polygons. Existing packet-owned floor and terrain navigation is reused. The small fallback helper reads exactly the same terrain and floor values before residency and after remounting.

The operator's exterior gallery informed ochre/yellow plaster, red pitched roofs and the pale entrance posts. These are recognition cues, not a survey of every facade opening. The elephant reliefs mentioned in the district description have not been invented from unseen carving details. No interior, complete planting survey, other religious site or photographic reconstruction is claimed. No photographs, textures, online geodata fetch, new decoder or increased live budget is introduced.

## Sources

- [Berlin heritage database: garden 09046233](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046233), geometry from [Berlin heritage WFS](https://gdi.berlin.de/services/wfs/denkmale), `denkmale:denkmale`.
- [Official LoD2 tile 385_5833](https://gdi.berlin.de/data/a_lod2/atom/LoD2_385_5833.zip), Geoportal Berlin, dl-de/zero-2-0. All intersecting complete families are retained, including the two small structures not separately drawn by OSM.
- [Official DGM1 tile 384_5832](https://gdi.berlin.de/data/dgm1/atom/DGM1_384_5832.zip), Geoportal Berlin, dl-de/zero-2-0. Original one-metre cells; centimetre storage does not imply centimetre survey accuracy.
- OpenStreetMap contributors, retained Berlin snapshot 2026-11-13, ODbL-1.0. Mapped building IDs 49753550,77967300,508729598 and paths 217729064/660153859–660153864.
- [District description, 73 steps/eight landings](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/tourismus/artikel.82764.php), [official 2024 anniversary report](https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2024/pressemitteilung.1473448.php).
- [Operator exterior gallery](https://das-buddhistische-haus.de/de/gallery/4-das-buddhistische-haus), reference only; no image redistribution asserted or included.

## Reproduction and checks

`uv run python -m scripts.build_buddhist_frohnau_v347 --out <packet-directory>` builds from the retained small source capture without fetching imagery or geodata. Initial `--capture` uses the ignored raw archives and the frozen 84d3c452 manifest.

Evidence is retained in `geo_data/regierungsviertel/buddhist-frohnau-v347-source.json.gz`, `buddhist-frohnau-v347-evidence.json` and `buddhist-frohnau-v347-manifest.json`. `src/app/tests/buddhist-frohnau-v347.test.ts` checks complete source vertices, all six identities, packet hashes, full roof navigation, 73 riser levels, 81 floor polygons, fallback/resident ground parity, independent cardinal Native and identical complete remounts. These are bounded model checks, not a claim that the whole Berlin release or browser walkthrough was run by this task.
