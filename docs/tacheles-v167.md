# Tacheles / Fotografiska, v1.0.67

Step 10 now gives the surviving Tacheles head building at Oranienburger Straße 54 its current Fotografiska reading. The exact owners are Berlin LoD2 parents `DEBE01YYK0000D41` and `DEBE01YYK0000B92`, OSM ways `940754304` and `419283679`, and previous core prism IDs `40754304` and `19283679`. Both old prisms also received v166 core façade detail; central integration removes those two old owners and their corresponding façade triangles. No outer streamed LoD2 owner is transferred.

The official tile `LoD2_390_5820.zip` provides all four deepest leaves, their full ground footprints, and 88 original wall, roof, ground and closure polygons. The source SHA-256, every polygon ID, full metric rings and unmodified source triangles remain in `tachelesV167Evidence.json`. The three west-wing leaves keep their complete displayed wall/roof geometry. Their heights above the shared 5.2 m scene ground are 20.551, 27.439 and 28.461 m. The main footprint measures 802.476 m²; the west leaves total 449.661 m². Every source footprint survives in `sourceParts`, even where ground navigation needs an opening.

The [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035146) identifies Franz Ahrens's 1907–1909 Friedrichstraßenpassage, the surviving head building, the two-storey rusticated limestone base, balustrade and three upper commercial floors. The old shopping gallery and dome mostly disappeared. [Herzog & de Meuron](https://www.herzogdemeuron.com/projects/439-am-tacheles/) describes the 2018–2024 redevelopment and the current courtyard sequence as an interpretation of the historic connection. The [museum operator](https://berlin.fotografiska.com/en/visit) verifies the present museum use, which supersedes OSM's stale `building=apartments`; [Bar Clara](https://barclara.fotografiska.com/en/about-clara) identifies the current rooftop prism.

## Explicit source conflicts

D41's LoD2 walls reach a measured eave 22.248 m above ground, but its broad roof surfaces reach 36.378 m. Inspected September 2023 photographs show the completed low rooftop and the open east passage. Displaying the old ~14 m roof slopes would enclose the present roof and misrepresent the silhouette. Therefore:

- Every original D41 roof polygon remains in Evidence, with an explicit `superseded-current-low-roof` action. Only its displayed counterpart changes to a flat roof at the surveyed eave and an inset low glazed prism, ridge scene Y 30.75 m. The prism dimensions and slope are bounded visual estimates, **not surveyed current roof dimensions**.
- D41 wall geometry above the existing eave and the verified passage opening is clipped for display. Every changed source polygon has a recorded action and removed area. The original rings and triangles are still preserved.
- The passage has authored arch voussoirs, an underside, internal sidewalls and a surviving high bridge. Its central 5 m lane is verified clear through both front and rear wall planes in drawn navigation and native occupancy. The minimum 3.6 m native clearance below the bridge (3.8 m in drawn geometry) is a display estimate.

The street front receives independently authored arched glazing, grouped upper windows, pilasters, stone sills, small keystone relief, cornices and an open balustrade. The courtyard retains the visual reading of exposed floor edges and modern glazing. Bay spacing, colours, reliefs, glass framing, lettering and canopy dimensions are estimates anchored to the metric source planes. No demolished historical gallery, dome, graffiti, photographic texture or protected plan is reconstructed. The modern neighbouring way `940754327` and relation `12688119` remain separate existing owners; their courtyard geometry is not replaced by this model.

## Rendering and movement

`TachelesV167.ts` exports `createTachelesV167` and `createMinecraftTachelesV167`. All four drawn styles share the same two geometry batches and full touch detail: 1,343 source/current-detail triangles before lettering, 767 box instances, and 228,608 GPU bytes including lettering. Native Minecraft has two compact batches, an independent 1 m exterior surface skin merged into 3,951 runs, 11,541 fine orthogonal detail cells and 506 orthogonal lettering cells: 15,998 instances and 1,217,144 GPU bytes. It contains no smooth shell and no hidden solid infill. Full and mobile-like outputs match.

`tachelesV167Profile.ts` exports exact parent/prism ownership, `TACHELES_V167_PARTS`, `tachelesV167RoofAt` and `tachelesV167SourceColumn`. Five ground obstacle polygons retain the four source-part identities while excluding the open passage. A sixth obstacle starts above the passage at scene Y 8.8 m, preserving headroom and a continuous roof for roof walking. Roof triangles reflect the displayed current roof; native roof lookup reflects the actual block skin. Suppression of the two old voxel columns still uses their exact previous footprints and heights, including the passage volume that must disappear.

## Inspected free photographs

All four photographs are own-work photographs by **Fridolin freudenfett**, dated 20 September 2023, licensed **CC BY-SA 4.0**. They were inspected at 1,280 px on 2 October 2026 and remain external visual references. No bitmap is bundled. The per-file records are in Evidence and `/tmp/tacheles-v167-attribution.json` for root's central attribution merge.

- [Mitte Oranienburger Straße Am Tacheles.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles.jpg): current full street façade and low rooftop silhouette.
- [Mitte Oranienburger Straße Am Tacheles-001.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-001.jpg): arched glazing, stonework and entrance.
- [Mitte Oranienburger Straße Am Tacheles-003.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-003.jpg): courtyard glazing and exposed floor edges.
- [Mitte Oranienburger Straße Am Tacheles-004.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-004.jpg): open passage, high bridge and low current roof.

License: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Original procedural meshes do not embed or trace protected photographs, artworks or plans.

Reproduce with `uv run python scripts/build_tacheles_v167.py`. Focused validation: `uv run pytest -q tests/test_tacheles_v167.py` (3 passed), `bun test src/app/tests/tacheles-v167.test.ts` (3 passed, 1,466 assertions), and Ruff. Full-world/browser validation belongs to central integration.
