# Neue IHZ / Dorotheenstraße 33 — v241

Bounded facade refinement around Friedrichstraße 94–96 and Dorotheenstraße 33 / Charlottenstraße 42. The 93 m IHZ tower is unchanged. The two lower annexes receive paired green-gray panes, pale stone spandrels, shallow reveals, sills, mullions and horizontal joints. Dorotheenstraße 33 receives only narrow profiles: its previously authored transparent glass and openings remain intact. No present tenant sign is added.

## Source and architecture

- [WBM, Internationales Handelszentrum](https://www.wbm.de/gewerbe-berlin/internationales-handelszentrum/): tower built 1976–78; two nine-storey annexes since 2000, connected by a glass hall and public forecourt.
- [hausInvest, Berlin properties](https://hausinvest.de/de/blog/immobilienmarkt-berlin/): Dorotheenstraße 33 stone facade. Its ZEIT tenancy wording conflicts with the publisher’s newer address, so no current tenant is asserted.
- [Commerz Real owner listing](https://www.immobilienscout24.de/expose/170479236): Dorotheenstraße 33 / Charlottenstraße 42, stone facade and glazed corner, 2002 construction. Planned interior imagery is not modeled.
- [Historical ZEIT imprint](https://www.zeit.de/zeitverlag/PR/impressum) locates its Berlin office at Dorotheenstraße 33 in 2007. [Current ZEIT imprint](https://www.zeit.de/impressum/index), checked 2026-10-19, lists Schöneberger Straße 21A.
- Visual reference: [Internationales Handelszentrum Berlin Sockel Denis Apel CC.jpg](https://commons.wikimedia.org/wiki/File:Internationales_Handelszentrum_Berlin_Sockel_Denis_Apel_CC.jpg), Denis Apel / flyingpixel.de / Wikipedia, 2011-03-04, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Reference only; no photograph or texture is bundled.

Bay spacing, material colors and fitting dimensions are display estimates informed by the reference, not a measured facade survey. All building dimensions and clipping boundaries come from the existing source sheets.

## Preservation and exact correction

| Existing source owner | Source sheets | Source triangles | Selected wall sheets | Retired generic triangles |
| --- | ---: | ---: | ---: | ---: |
| DEBE01YYK0000A9a — Dorotheenstraße 33 | 153 | 377 | 16 | 0 |
| DEBE01YYK0001uk4 — main annex envelope | 236 | 614 | 26 | 5,800 |
| DEBE00YY1mz0006y — south annex auxiliary | 21 | 55 | 6 | 1,280 |
| DEBE00YY1mz00070 — north annex auxiliary | 22 | 58 | 8 | 2,000 |

All 432 source sheets / 1,104 source triangles, roofs, courts and existing native source cells remain with their previous owners. The four source records are copied exactly into `geo_data/regierungsviertel/ihz-v241-source.json.gz`; input hashes and generated counts are recorded in `ihz-v241-evidence.json`.

Only 9,080 exactly replayed generic drawn facade triangles retire: `2_-1`, fingerprint `4165914407`, 7,760 triangles; `2_0`, fingerprint `1773677354`, 1,320 triangles. These are `alt-mitte-v169` decoration, never source-body triangles. The transfer is enabled only with the required replacement model and fails closed on a changed fingerprint. Native indices are never removed.

Dorotheenstraße 33 is a retained v168 glass owner; it never received the v169 facade replay. Accordingly it has no retirement receipt and no new opaque backing or pane. Its fitting coordinates follow the measured source sheets. Native profiles are fitted to orthogonal source-derived planes, without replacing the retained native glass.

## Runtime and checks

`addIHZV241(root, native)` installs one required texture-free mesh per mode. `transferIHZTrianglesV241(enabled, tile, native, part, indices, offset)` performs the exact decoration correction. Root integration controls the `architectureV241` switch. Mobile uses identical complete geometry; no streaming thresholds, live budgets, navigation, terrain or unrelated owners change.

| Mode | Vertices | Triangles |
| --- | ---: | ---: |
| Drawn | 42,568 | 25,575 |
| Native | 53,242 | 26,844 |

Runtime JSON: 1,988,938 bytes raw / 582,738 bytes gzip. Native fittings use independently orthogonal planes; overlapping annex owners are unioned before profiling. Distinct layer depths prevent depth-buffer interference.

Focused validation: four Python preservation/receipt/geometry tests, three Bun runtime/transfer tests (210,488 assertions), and Ruff passed. Isolated Chromium previews show clean paired bays and preserved annex silhouettes in both modes. The isolated Dorotheenstraße preview uses source shell geometry; integrated viewing remains the check for its retained v168 transparent glass. No full build or full suite was run by this agent.

Review cameras: annex position `[1045,70,-60]`, target `[1197,20,-20]`; Dorotheenstraße position `[1320,45,0]`, target `[1262,18,60]`. Temporary screenshots: `/tmp/ihz-v241/drawn-annex.png`, `/tmp/ihz-v241/minecraft-annex.png`, `/tmp/ihz-v241/drawn-doro.png`.
