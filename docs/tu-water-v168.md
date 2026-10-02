# TU Berlin and Umlauftank 2, v1.0.68

The main university is **Technische Universität Berlin**, Straße des 17. Juni 135. The pink machine is **Umlauftank 2 (UT2)** of the former Versuchsanstalt für Wasserbau und Schiffbau on **Schleuseninsel**, near **Bahnhof Tiergarten**. TU München and Bellevue describe neither of these sites. OSM relation `3348239` anchors the main building; way `684361710` identifies the larger VWS complex. OSM is contextual identity here, while Berlin LoD2 supplies the metric envelope.

## Complete, bounded ownership

All five parents come from `LoD2_386_5819.zip`, with its SHA-256 recorded in `tuWaterV168Evidence.json`:

| Parent | Source leaves | Scope |
| --- | ---: | --- |
| `DEBE04YY500006Rw` | 16 | Complete TU main building: historic wings, north slab, Audimax and small annexes |
| `DEBE01YYK0002RC3` | 4 | UT2 laboratory/pipe, stair tower and long experimental channel |
| `DEBE01YYK0002PZZ` | 2 | Brick southern experimental hall and small appendage |
| `DEBE01YYK0002Skp` | 1 | Historic channel including its rounded western head |
| `DEBE01YYK0002VBQ` | 1 | Immediately adjoining service building |

All 24 leaves, 414 ground/wall/roof/closure polygons and 878 original survey triangles remain verbatim in Evidence. Except for the explicitly corrected UT2 part below, every original wall and roof triangle also remains in the visible model. The historic TU ground polygon preserves both courtyard holes, and all separate source parts and roofs remain intact. Courtyards are not replaced with solid blocks. Campus and VWS buildings beyond these exact owners retain their previous source geometry.

The ten previous core prism IDs are `Yu5NppI5`, `O5AGB7fA`, `GZbL6snz`, `U6frqVw8`, `6Va8XF4g`, `Yez44z7p`, `K0002Skp`, `K0002VBQ`, `-3348239`, and `14269403`. No outer streamed owner is removed. Suppression is exact by identity and, for old native columns, the saved original footprint and quantized height. The declared gabled/hipped roof types also remove only their exact extra four-metre tier. An actual-payload regression covers all 1,268 owned columns, including 30 separate roof-tier rows. A broad campus rectangle is never used to suppress neighbours.

## Architecture and the explicit UT2 source conflict

The [official TU monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040623) distinguishes the surviving historic south/side wings from the postwar ten-storey northern slab and asymmetric Audimax. The model keeps all their measured geometry, adds the northern aluminium grid and ten ribbon-window storeys, preserves the Audimax as a largely windowless volume, and gives the historic wings arched glazing, stone surrounds, projecting sills, cornices and base rustication. These facade subdivisions are procedural visual estimates on surveyed wall planes; they are not measured bay dimensions. Rustication excludes the window apertures.

The [official VWS monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050433) describes the pink vertical water loop, blue metal-clad laboratory on steel supports, long experimental channels and arched brick hall. [TU Berlin's UT2 page](https://www.tu.berlin/dms/einrichtungen-services/versuchseinrichtungen/umlauftank-ut2) verifies the installation's identity and scientific use; [Wüstenrot Stiftung's restoration record](https://wuestenrot-stiftung.de/umlauftank-2-ludwig-leo-berlin/) documents the repaired metal panels, retained windows and roof lights. Its operational status is not inferred from potentially older institutional text.

LoD2 leaf **`DEBE3DQSGZbL6snz`** extrudes the entire approximately 54.9 m long pipe/laboratory footprint from ground to 34.467 m high. This closes the documented air gap and incorrectly makes the exposed tube ends as tall as the blue laboratory. Its 13 original displayed wall/roof polygons therefore receive explicit `superseded-solid-survey-envelope-with-open-industrial-structure` records. The original rings and triangles remain in Evidence; this correction changes only their displayed counterparts.

The replacement is an independently authored structure anchored to the survey axis and maximum laboratory height: a 26.2 m wide raised blue hall, separate narrow supports, central lower service shaft, an open pink circulation loop, flange ribs, offset horizontal window bands and shallow roof lights. The blue stair-tower source leaf remains fully visible and unchanged. The pipe outside radius of 4.45 m, centreline turn radius of 5.85 m, hall underside at scene Y 17.8 m and placement of the secondary components are **bounded photo-informed estimates**, not fabrication or measured engineering dimensions. Scaffolding present in 2017 restoration photographs is not reconstructed. No machine interior, water simulation, copied plan, photo texture or artwork is added.

The side opening is real air in both render branches. Focused tests cast rays completely through it and check independently generated native occupancy at the same points. The loop is not represented by a pink slab or a hidden enclosing cuboid.

## Rendering and movement

`TuWaterV168.ts` exports `createTuWaterV168` and `createMinecraftTuWaterV168`. All four drawn styles and touch use identical geometry: 32,976 triangles and 6,944 facade boxes in two batches, **4,089,800 GPU bytes**. Native Minecraft uses two independent orthogonal block batches: 23,072 one-metre surface runs and 40,877 half-metre facade-detail runs, **63,949 instances / 4,861,420 GPU bytes**. It uses surface occupancy with lossless run merging and contains no smooth clone or hidden solid fill.

`tuWaterV168Profile.ts` exports exact `TU_WATER_V168_PARENT_IDS`, `TU_WATER_V168_PRISM_IDS`, `TU_WATER_V168_PARTS`, `tuWaterV168SourceColumn` and `tuWaterV168RoofAt`. The 23 ordinary navigation records retain the unchanged source footprints and courtyard holes. A separate bounded `TU_WATER_V168_STRUCTURE` uses `tuWaterV168StructureSolidAt(x,z,y,minecraft,radius)`: the drawn branch evaluates the actual open stadium-shaped tube and independent hall, shaft and piers; the native branch tests disjoint vertical intervals generated from the actual authored blocks. A global highest-roof callback is never used to fill the pipe's air gap. Actual compiled pedestrian-index regressions verify standing capsules at floor Y 15.2 m can pass through that opening in both branches while the lower pipe, upper pipe and laboratory remain solid. Roof walking uses the actual displayed triangles; native roof heights follow the actual surface blocks. An 8 m spatial index and cached triangle bounds/denominators keep roof queries local without simplifying the roofs.

## Inspected free references

All six external photographs were inspected at 1,280 px on 2 October 2026. No bitmap is shipped. Per-file credits are in Evidence and `/tmp/tu-water-v168-attribution.json` for the central attribution merge.

| Photograph | Author / license | Inspected features |
| --- | --- | --- |
| [Technische-Universitaet-Hauptgebaeude-Berlin-Charlottenburg-06-2017.jpg](https://commons.wikimedia.org/wiki/File:Technische-Universitaet-Hauptgebaeude-Berlin-Charlottenburg-06-2017.jpg) | Gunnar Klack / CC BY-SA 4.0 | Northern metal grid, ribbon windows, asymmetric Audimax |
| [Charlottenburg TU-Hauptgebäude Südfassade.JPG](https://commons.wikimedia.org/wiki/File:Charlottenburg_TU-Hauptgeb%C3%A4ude_S%C3%BCdfassade.JPG) | Fridolin freudenfett (Peter Kuley) / CC BY-SA 3.0 | Sandstone arches, cornices, rustication |
| [Charlottenburg TU Hauptgebäude Westfassade.JPG](https://commons.wikimedia.org/wiki/File:Charlottenburg_TU_Hauptgeb%C3%A4ude_Westfassade.JPG) | Fridolin freudenfett (Peter Kuley) / CC BY-SA 3.0 | Western historic wing and existing external bridge context |
| [Technische-Universitaet-Berlin-Umlauftank-2-Versuchanstalt-fuer-Wasserbau-und-Schiffbau-03-2017.jpg](https://commons.wikimedia.org/wiki/File:Technische-Universitaet-Berlin-Umlauftank-2-Versuchanstalt-fuer-Wasserbau-und-Schiffbau-03-2017.jpg) | Gunnar Klack / CC BY-SA 4.0 | Pink loop, raised blue box, arched brick hall |
| [TUB-Umlaufkanal-Schleuseninsel.jpg](https://commons.wikimedia.org/wiki/File:TUB-Umlaufkanal-Schleuseninsel.jpg) | KK nationsonline / CC BY-SA 4.0 | Open lower bays, offset windows, loop and roof lights |
| [Umlaufkanal berlin 2.jpg](https://commons.wikimedia.org/wiki/File:Umlaufkanal_berlin_2.jpg) | Dreas / CC BY-SA 4.0 | Side depth and verified air opening |

Licenses: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). These are architectural inspection references only; original procedural geometry contains no photo pixels or copied artwork.

Reproduce with `uv run python scripts/build_tu_water_v168.py`. Focused checks: Ruff; `uv run pytest -q tests/test_tu_water_v168.py` (4 tests); `bun test src/app/tests/tu-water-v168.test.ts` (5 tests). Full scene/browser/release integration belongs to the root task.
