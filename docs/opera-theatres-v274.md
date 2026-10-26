# Five theatre sites, v274 / Step 10

The Deutsche Oper and Schillertheater now use their complete retained official LoD2 families instead of the former coarse fallback bodies. GRIPS, Staatsoper Unter den Linden and the Komische Oper main building on Behrenstraße retain all earlier source bodies and authored details; their additions are bounded entrance, stair and facade fittings. The Komische Oper main house is not confused with its temporary Schillertheater venue, and no planned extension is presented as built.

## Architecture and evidence

| Site | Physical correction | Source versus interpretation |
| --- | --- | --- |
| Schillertheater, Bismarckstraße 110 | Full stage tower, differentiated wings/roofs and the convex, faceted glazed foyer; facade frames, transoms and theatre lettering | Seven existing v182 official parents, 71-part combined family below. The main parent reaches scene Y 42.718 m, replacing a 15 m high fallback prism. Foyer curvature follows the actual source wall facets. Glazing subdivisions, letter sizes and subdued colour accents are visual estimates. The accents do not reproduce Ludwig Peter Kowalski's panorama. |
| Deutsche Oper, Bismarckstraße 35 | Differentiated auditorium, stage tower, workshops and courtyards; blank street concrete wall versus glazed eastern foyer | Two existing v182 official parents. The former entire 38.98 m extrusion was wrong for the lower spectator building. At the foyer sample (-4268, 650), the drawn roof is Y 22.5704 m; at the stage sample (-4300, 620), it is Y 41.983 m. Panel joints and foyer mullions are explicitly estimated recognition details. |
| GRIPS, Altonaer Straße 22 | Folded returns along the existing metal panel joints and nosings on all 28 existing exterior spiral-stair treads | Exact existing v139 facade/stair axes and distinct native stair position. No replacement stair, new doorway, missing original part or speculative interior. Fine dimensions are estimates. |
| Staatsoper Unter den Linden | Layered plinth/capital mouldings on the existing six-column portico and a dentil course | All v169 source roofs/walls and v240 facade, sculptures and inscriptions remain unchanged. Additions use the same measured north-front axis and original column positions; moulding subdivisions are estimates. |
| Komische Oper, Behrenstraße 55–57 | Copper portal side returns, bronze door jambs/heads and paired pulls | Complete original source body, copper-fold facade and existing doorway construction remain. Public Behrenstraße entrance axis, not the current temporary venue. Small metal fittings are estimates. |

Primary architectural references:

- [Schillertheater building history, Staatsoper](https://www.staatsoper-berlin.de/en/staatsoper/schiller-theater/baugeschichte/) and [current venue, Komische Oper](https://www.komische-oper-berlin.de/planen/spielorte/schillertheater/).
- [Deutsche Oper monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096099,T) and [conservation architects' documentation](https://www.dhl-architekten.de/projekt/deutsche-oper-denkmalgerechte-sanierung/).
- [Komische Oper conservation architects](https://buero-pms.de/projekt/komische-oper-berlin/) and [Berlin's renovation programme](https://www.berlin.de/sen/kultur/infrastruktur/komische-oper/).
- [GRIPS operator address/access](https://www.grips-theater.de/de/service/anreise) and [Hansaviertel monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387).
- [Staatsoper monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095952) and [operator renovation documentation](https://www.staatsoper-berlin.de/de/staatsoper/unter-den-linden/sanierung/).

Official geometry is extracted reproducibly from the already retained `LoD2_385_5819.zip`. Its SHA-256, original unshifted source leaves, every wall/roof polygon and hole, and the exact v182 ground translation remain in `geo_data/regierungsviertel/opera-theatres-v274-source.json.gz`. No source XZ vertex or relative height is changed. No remote image, texture, video or font asset is loaded at runtime or bundled. Existing source-model hashes are recorded in `opera-theatres-v274-evidence.json` and tested unchanged.

## Exact transfer and integration

The required factory is `createOperaTheatresV274(native, {mobileLike})`. It attaches a complete nine-parent, 71-leaf, 545-surface family: 1,514 source triangles, 305 facade boxes, 15,984 independently sampled native surface cells, 1,161 independent native fitting cells and two geometric signs. The native construction contains no hidden solid infill or rotated drawn building proxies. Every static detail is retained on touch devices.

Six exact old Schiller prisms yield: `49449348`, `67502908`, `74917641`, `49449351`, `49449350`, `23471381`. The adjacent `49449347` is retained. Each source plan, holes, base, height, class, roof and optional tone must match its retained tuple. The measured combined Schiller family covers more than 94% of each old approximate plan; the surveyed plans take precedence at the small old outline discrepancies. Native core transfer has 361 immutable exclusive column tuples; 30 shared neighbour columns remain. Missing, duplicate or changed selected prisms disable the native transfer. New or changed nearby neighbours retain any intersecting column.

For Deutsche Oper, the retained original outer-v159 source recipe is replayed byte-for-byte against immutable `-9_0` and `-9_1` packets. Six triangle receipts transfer exactly 1,220 original triangles; three drawn ink receipts transfer exactly 100 line segments. Full encoded position/colour/index fingerprints gate each transfer. Every other index and every other endpoint is preserved. Changed packets conservatively retain their original geometry. The streamed collision rows retire only when the corresponding complete packet triangle transfer succeeded. The 71 measured replacement collision parts are registered by the same required-world option and use actual roofs for drawn/native walking.

The optional v182 recognition layer retires exactly 30 obsolete generic window boxes and 60 matching estimated sill lines on the new Schiller/east-foyer glazing. Each original index and complete row must match; all measured roof/wall ink and other prior windows remain. Predicates compose on original indices, never on already filtered arrays.

Production integration is in `RequiredSiteEnvelopesV209`, `IsometricCityWorld`, `MinecraftVoxelWorld`, `SurroundingCityGeometry`, `SurroundingCity`, `ThreeViewer`, `pedestrianNavigation`, `CityRecognitionV182`, `OutlineLandmarksV182`, `progressiveBuildingCoverage` and `progressiveWorld.worker`. The flag `operaTheatresV274` is enabled only by the complete required-city construction before it is attached to the live scene, including later worker refinements. The required factory remains attached before a cooperative yield, preserving cancellation ownership. NorthCulture v274 remains alongside it.

## Validation and cost

- Five Python tests: complete retained geometry/datum, exact production owner replay, preserved historic details, source-only native cells and fitting clearance, and architectural identity.
- Seven Bun tests: desktop/touch equality, orthogonal native transforms, complete roof navigation, exact/changed owner guards, exclusive/shared native columns, all original production indices/endpoints, actual decoder navigation, initial/distant/worker core ownership.
- Actual render arrays: drawn **200,264 bytes / 2 calls / 476 instances**; native **1,325,864 bytes / 1 call / 17,438 instances**. Mobile equals desktop in each mode.
- Three runtime JSON files: **1,008,551 bytes** raw, **129,521 bytes** gzip before the repository's lossless module transformation. No descriptor, residency, prefetch, pixel, tour-stop or other budget was changed.
- No Safari or external browser was opened. The internal browser was unavailable. The separately generated local inspection image shows actual retained source triangles and construction boxes in both modes; it is not a browser screenshot and omits lettering and earlier v182 ink.

Reproduce with `uv run --no-sync python -m scripts.build_opera_theatres_v274`, then `uv run --no-sync python -m scripts.build_opera_theatres_ownership_v274`. The preview is generated by `uv run --no-sync python -m scripts.preview_opera_theatres_v274` in the local cache. Focused commands are `uv run --no-sync pytest -q tests/test_opera_theatres_v274.py` and, in `src/app`, `bun test tests/opera-theatres-v274.test.ts tests/opera-theatres-v274-integration.test.ts`.

Validation logs: `~/.cache/codex-berlin-v274/opera-python.log`, `opera-bun.log`; inspection image: `opera-theatres-models.png`. The standalone default Node TypeScript attempt exceeded its 4 GB heap before completion; the root release verification owns the repository-wide TypeScript/build checks.
