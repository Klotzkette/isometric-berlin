# Kleiner Tiergarten / Rathaus Tiergarten – Step 10 v237

The compact supplement concerns **Moabit's Kleiner Tiergarten and Ottopark**, not the Großer Tiergarten. Two ordinary streamed companion packets add 151 seats/benches belonging to 123 exact OSM owners, the mapped converted-container weather shelter, two genuinely absent path strips, and a restrained portico/balcony around the mapped Rathaus main entrance. All previous building shells, measured roofs, paths, trees, terrain and navigation remain unchanged.

## Sources and limits

- [Latz + Partner, project designer](https://www.latzundpartner.de/de/projekte/klassische-landschaften/kleiner-tiergarten-ottopark-berlin-de/) documents the retained 1950s spatial structure, grove islands, open lawns and 2010–2018 renewal.
- [KoSP, project management for Bezirksamt Mitte](https://www.kosp-berlin.de/projekt/kleiner-tiergarten-ottopark/) identifies the restored sunken garden, Rolleracht and converted shelter container. These statements do **not** supply surveyed terrain heights.
- [Berlin's official renewal programme](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/lebendige-zentren/gebiete/turmstrasse-1286528.php) distinguishes this approximately six-hectare Moabit green space.
- [Landesdenkmalamt 09050351](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050351) confirms the Rathaus forecourt, projecting pier portico, balcony and steep roof. The v227 complete measured roof/body remains authoritative. New details attach to measured centre-wall part `DEBE3DxQUEt451DE` at OSM main-entrance node `1776326062`; the ground remains y=5.2 m. No speculative clock tower is added without a measured envelope/reference dimension.
- A bounded [OSM API extract](https://api.openstreetmap.org/api/0.6/map?bbox=13.332,52.5238,13.3505,52.529), retrieved 2026-10-18, supplies park relation `8676818`, Ottopark way `4592869`, exact bench nodes/seat lines, shelter way `1096688336`, current paths and entrance anchors. The compressed replay archive retains complete selected objects and the raw-response SHA-256, ODbL attribution and unchanged predecessor-asset hashes. No source photograph or webpage asset is distributed.

Furniture sizes, inferred orientation along nearby paths, colours, shelter height and portico proportions are explicitly **display estimates**, not measured construction details. Source-tagged material, backrest, armrest and 15-seat-line counts are respected. Coincident seat-line/node owners are deduplicated. All existing 97+ park paths are kept; only the unrepresented surface portions of ways `447048755` and `1567879132` are added, within the exact park and outside buffered previous paths. Default 2.4 m path width is a declared display estimate. Underground paths are excluded.

## Underpass and levels

The source confirms the existing U9 beneath the park and its three already delivered Turmstraße entrance anchors (`311928387`, `366186446`, `428298200`). It also records a small Rolleracht bridge (`116946775`). It does **not** establish the identity or depth of the requested pedestrian underpass. A separate `layer=-1` footway at the western playground is geographically unrelated to the Rolleracht bridge. No artificial road tunnel, new subway shaft, subterranean walking floor or park hill is therefore generated. Existing network presentation and ground remain exactly as delivered; this limitation must not be described as a completed new walkable underpass.

## Integration and verification

`scripts/build_small_tiergarten_v237.py` replays the frozen source, writes `moabit-v237-manifest-addition.json` with **chunks only**, and never edits the shared manifest. Append its two standard descriptors (`moabit237--5_-2`, `moabit237--4_-2`) through the v237 integration script. There is no extra runtime hook or persistent model root, no new coverage and no navigation override. Cancellation, download limits and eviction use the existing surrounding-city implementation.

Drawn geometry is separate from the native orthogonal block construction. Both use the same owners on mobile and desktop, no textures, one mesh per packet. New actual decoded/GPU geometry is **180,306 bytes drawn / 806,112 bytes native** across both packets (12 bytes per vertex plus actual Uint16/Uint32 index allocation), well inside unchanged live residency limits. Compressed packet payloads total **84,518 / 326,470 bytes**, source archive **24,410 bytes**.

`uv run pytest -q tests/test_small_tiergarten_v237.py`: four tests verify source-owner counts, unchanged predecessors, exact entrance-to-wall placement, missing-path exclusion, zero added terrain/nav, packet hashes and bounds, independent native orthogonality and GPU receipts. Representative views: Rathaus entrance **[-2214, 5.2, -953]**, park shelter **[-1943, 5.2, -802]**, Ottopark benches **[-2330, 5.2, -835]**.
