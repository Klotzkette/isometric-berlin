# Kraftwerk Berlin — v268

The user's corrected Köpenicker Straße request identifies **Kraftwerk Berlin**, the former heating plant now used for exhibitions/events at **Köpenicker Straße 70**. It is in Berlin-Mitte, on the requested street towards Kreuzberg. The immediately adjacent operating **BEW Heizkraftwerk Mitte**, address **Köpenicker Straße 60**, is a separate public identity. This bounded change refines the venue and restores only the active plant's two dominant missing chimneys. It introduces no district coverage, descriptor, permanent scene root, texture, animation, tour stop or runtime budget.

## Evidence and preserved owners

The venue operator's [site history](https://kraftwerkberlin.de/de/ort) identifies the 1960–1964 former plant and its subsequent conversion. Its exterior photograph was visually inspected: a tall metal screen with panel joints, dark lower bays and an upper dark band. The [Berliner Zentrum Industriekultur](https://industriekultur.berlin/ort/kraftwerk-berlin/) identifies both facilities and its Florian Rizek photograph shows the separate stepped active halls and two large light-grey stacks. The [BEW's May 2026 public information](https://www.bew.berlin/binaries/content/assets/website/erzeugungsanlagen/information-der-offentlichkeit-storfallv---hkw-mitte.pdf) confirms the current active plant's identity/address. Sources and media credits are in [the reference ledger](kraftwerk-berlin-v268-references.json). No reference pixels are bundled.

The venue is OSM **way32565606**, exact LoD2 parent **DEBE01YYK00002yj**, world bounds approximately `[3206.833,921.263,3320.387,1014.655]`. Its existing v169 model already contains **five complete measured parts and 43 original sheets**, including the differentiated roof edges. All measured drawn wall/roof triangles remain rendered; the complete original source object is retained in the new evidence. No roof or source ink is retired.

The active plant's OSM way31832012 corresponds to **DEBE01YYK00007Fz**, **DEBE01YYK00007Vq**, **DEBE01YYK0000AOd** and **DEBE01YYK00008nb**. Their complete existing sheets, stepped roofs, fittings and navigation remain unchanged. Their world bounds lie approximately within `[3280.579,800.910,3383.901,907.952]`.

## Exact correction and new construction

The earlier v169 venue treatment supplied generic residential window rows on the industrial hall. Reconstructing that exact original recipe yields **5,216 drawn triangles**. Only the complete position-and-colour matches of those triangles yield to the new industrial facade. Every other decoded triangle and all original encoded buffers remain unchanged.

In native mode, the earlier estimated window colours and cells are merged into the owner. Its complete old model is independently reconstructed and matched at **5,152 triangles**, then replaced by the complete original measured-sheet native construction without that false window recipe. This retains the existing independent cardinal two-metre source pipeline; its **1,412 source triangles** are followed by cardinal facade fields fitted to the actual native wall planes. No rotated drawn planes are reused as native walls. The original five measured part-navigation records remain unchanged.

The new facade contains metal screen fields, shallow horizontal relief, pale vertical panel joints, recessed lower bays, upper-band mullions and parapet-edge accents. Panel pitch, small depths, finish colours and band heights are **photo-guided display estimates**, not an opening survey. Lower bays do not claim new mapped doors or walkable entrances. No unrelated earlier named model contains this owner.

The major active-plant stacks are retained OSM **ways193480704 and908097945**, including every mapped ring vertex and each explicit **height=100** tag. An official Berlin planning explanation ([11-47a justification, p.234](https://www.berlin.de/bebauungsplan-lichtenberg/abgeschlossene-verfahren/festsetzungsbegreundung11-47a.pdf)) independently describes the Mitte stacks as approximately 100 metres. The existing 6_1 navigation/building inventory has neither high stack. Their added upper portions start at **y=45**, entering the retained measured high roof, and end at **y=103** above the delivered **y=3** ground. Small rim widths are estimates; mouths remain visually open. Collision and roof sampling use the exact visible rim polygons with their inner holes, so neither mouth becomes an invisible deck at y=103. Native uses independent one-metre cardinal ring footprints. Two thin nearby OSM flues with ambiguous shared 100m tags are outside this exact two-stack correction; no claim of reconstructing the complete operating installation is made.

The source and both original 6_1 packets agree on **ground y=3**. The entire venue lies east of the resident terrain raster. Native's inherited surface-cell raster reaches y=1 underneath that ground; this retained underhang is not a floating ground datum. New facade fittings start above the delivered ground.

## Integration and lifetime

All three hooks belong only in `SurroundingCityGeometry.ts`; no additional Alt-Mitte factory is needed:

- `prepareKraftwerkBerlinV268(chunk,id,native)` after the earlier immutable preparers. It validates exact original mesh/nav/replacement fingerprints, preserves all prior objects and tolerates additional earlier meshes. One complete required packed addition joins existing **6_1** in each family.
- `applyKraftwerkBerlinV268Triangles(chunk,meshIndex,indices,indexOffset)` after earlier decoded-triangle transfers. Only the exact receipted old facade/native indices become degenerate. No line hook is needed.
- `kraftwerkBerlinNavigationV268(chunk,nav)` appends only the two hollow upper-stack annuli, idempotently. It preserves all source owners, ground, roads and water. Preparation requires one inner hole per stack. The ordinary streamed navigation handoff serves both mode families.

Changed source, a missing replacement or a failed budget guard causes a conservative no-op. Original packet JSON, all encoded buffers, source sheets and line inventories remain immutable. The addition shares existing cancellation, publication, disposal and eviction. Full drawn detail is identical on mobile.

Runtime data is **909,622 bytes**, retained as encoded module data for both representations. Only the selected packet allocates geometry. The addition contains **1,674 drawn triangles** and **23,289 native triangles**, including the complete native source body. Existing 16-mesh, 400,000-vertex and 2,400,000-index guards remain unchanged. No live residency or delivery allowance is raised.

## Checks and QA

Four focused Python tests pass: original input hashes and all measured drawn sheets survive the retirement; every native triangle is orthogonal and the actual ground/budgets hold; both exact mapped stacks reach y=103 and their hollow navigation areas match the delivered horizontal rim triangles; both cameras clear actual neighbour rings. Four Bun tests pass (112 assertions), including the integrated production decoder in both families, exact retirement metrics, retained original object identities, unrelated triangle complements, changed-source rejection, idempotence and original navigation. Production collision checks prove both mouths remain open for a 0.3m person radius at y=70, 102.9 and 103, while the represented rim remains solid at those heights. Ruff passes. Root owns shared TypeScript/build/release and IAB inspection; no browser or compiler was run by this subtask.

| View | Position | Target | Real neighbour packets |
|---|---|---|---|
| Street front | `[3240.5,27,1023.5]` | `[3252,15,995.8]` | `6_1`, `6_2` |
| Whole site | `[3410,105,715]` | `[3260,24,970]` | `6_1`, `6_2` |

Both eye XZ positions are outside every building ring in those packets. Eye-to-target rays clear all unrelated source rings/heights by 0.4m in both families; the whole-site camera additionally checks rays to both chimney centres at y=85. This is a numerical visibility check, not a substitute for IAB visual acceptance. The root may use `[3410,92,715] → [3330,65,890]` for a closer stack view.

Reproduce with `uv run --no-sync python scripts/build_kraftwerk_berlin_v268.py`. Full source, exact receipts, input hashes, fitting roles and camera checks are in `geo_data/regierungsviertel/kraftwerk-berlin-v268-evidence.json.gz`; the small preserved OSM context is `kraftwerk-berlin-v268-context.json`.
