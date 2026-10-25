# Step 10 v267: Kreuzberg street fronts and public equipment

Bounded supplement for release **1.0.167**. Sixteen mapped commercial-use points add shallow lower shopfronts on thirteen retained ordinary buildings: eleven fronts on Wiener Straße and five on Görlitzer Straße. Two mapped outdoor table-tennis positions add visible playing slabs, legs and nets within the existing Görlitzer Park footprint. Four public bicycle-parking points add five cycle hoops along Oranienstraße.

## Existing detail and scope

All source vertices, old panes, original meshes, roof treatments, lines and navigation remain unchanged by this module. The three v188 Oranien building fronts did not yield a safe new mapped opening; the v167 Oranien façades already have ground shops, window surrounds and cornices. The visible Oranien gain therefore comes from mapped public cycle stands. No repeated window grid or general recolouring is added.

Görlitzer Park already has v185 path edges and thirty-nine mapped wooden benches. Wiener Straße already has v185 plinth and eave profiles. New shop frames sit entirely above the existing plinth and below the lowest retained v188 pane; existing v233 doors and all mapped entrance points retain a minimum separation. The whole new drawn rectangle must fit actual wall triangles, and the independently selected native rectangle must fit actual cardinal wall planes belonging to the same source owner.

Excluded: Feuerwache **DEBE02YY40000Avj**, its stated bounds x3826.585–3911.572/z2305.377–2363.107, and Schlesisches Tor. Neither named replacement is implemented here. No newly mapped entrance was needed (zero new doors).

## Ground evidence and estimates

Each shop stores `ground.drawn` and `ground.minecraft` after checking the entire shallow strip under its actual frame against delivered horizontal triangles. Floors are 3.00/3.01m except one independent native strip at 3.12m; they must remain within 0.15m of the retained wall bottom. Equipment requires coverage of its **entire footprint**, separately in both modes, by horizontal delivered triangles at one elevation. It may not intersect a retained building footprint. One Oranien point is on a delivered raised surface at 3.22m in both modes; other retained hoops stand at 3.00m, and both tables at 3.01m. These are actual scene-ground levels, not a claim of surveyed absolute elevation.

Three candidates fail complete-ground support and are omitted: table node2549880590 and cycle nodes4197563073/9010396871. No ground patch is invented to admit them.

Mapped commercial use does not prove an aperture. The new glazing position, dimensions, frame/fascia, colours and finish are explicit display estimates. No current tenant, logo, facade material or colour is asserted. Outdoor table positions are exact mapped nodes, but their orientation, playing-field finish and small dimensions are estimates. Hoop locations and capacities are exact source data; capacity/2 is interpreted as hoop count. Hoop orientation relative to the nearest retained Oranien road and the approximately 1.0m width / 0.8 m height / 1.3 m spacing are estimated. Native equipment uses an independent cardinal interpretation.

## Source references and attribution

The exact PBF/context/mesh receipts are in `geo_data/regierungsviertel/kreuzberg-streets-v267-evidence.json.gz` and `kreuzberg-streets-v267-context.json.gz`; all thirteen input files and twenty-eight source assets carry SHA-256 receipts. Source PBF: `berlin-260929.osm.pbf`, SHA-256 `9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9`. OSM point data is a frozen 2026-09-29 snapshot, not a live October tenant survey.

- © OpenStreetMap contributors, **ODbL-1.0**; [source extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf).
- Geoportal Berlin / official LoD2, **dl-de/zero-2-0**, inherited complete building/source receipts from v188.
- [Official Zentrum Kreuzberg context](https://www.quartiersmanagement-berlin.de/quartiere/zentrum-kreuzberg?type=98), checked 2026-10-25; retained Gründerzeit fabric only, no individual facade dimensions inferred.
- [Official Görlitzer Park page](https://www.berlin.de/tourismus/parks-und-gaerten/3560154-1740419-goerlitzer-park.html) and [February 2026 opening-hours decision](https://www.berlin.de/sen/uvk/presse/weitere-meldungen/2026/oeffnungszeiten-goerlitzer-park-1646373.php), checked 2026-10-25; context only. Exact selected table positions come from OSM. No fence, gate or sign is inferred.
- [Senate street-space design rulebook 2025, p. 47](https://www.berlin.de/sen/bauen/_assets/baukultur/regelwerke-stadtgestaltung/regelwerk-strassenraumgestaltung-fdf_online_2025.pdf?ts=1765872919), checked 2026-10-25; supports the general Kreuzberger hoop-with-crossbar type. It is not site-specific evidence for the selected stands.

No images, plans, textures or proprietary map tiles are copied or redistributed. The machine-readable primary-reference ledger is `kreuzberg-streets-v267-references.json`.

## Retained source IDs

| Street | Source owner | Mapped commercial node | Packet |
|---|---|---|---|
| Wiener Straße | `DEBE02YY4000018R` | `node/410135944` | `7_4` |
| Wiener Straße | `DEBE02YY4000018R` | `node/1425004085` | `7_4` |
| Wiener Straße | `DEBE02YY400001mo` | `node/1831473808` | `7_4` |
| Wiener Straße | `DEBE02YY400003yU` | `node/4107978941` | `7_4` |
| Wiener Straße | `DEBE02YY400007pu` | `node/916565221` | `7_4` |
| Wiener Straße | `DEBE02YY400007pu` | `node/13000132702` | `7_4` |
| Wiener Straße | `DEBE02YY40000AhF` | `node/13232485578` | `7_4` |
| Wiener Straße | `DEBE02YY40000CXr` | `node/391401480` | `7_4` |
| Wiener Straße | `DEBE02YY40000CXr` | `node/12645178501` | `7_4` |
| Wiener Straße | `DEBE02YY40000DIf` | `node/1345222867` | `7_4` |
| Wiener Straße | `DEBE02YY40000E0W` | `node/886097100` | `7_4` |
| Görlitzer Straße | `DEBE02YY400002du` | `node/8769753601` | `8_4` |
| Görlitzer Straße | `DEBE02YY400002ep` | `node/1248728521` | `8_4` |
| Görlitzer Straße | `DEBE02YY400003Dy` | `node/8746181562` | `8_4` |
| Görlitzer Straße | `DEBE02YY400005bG` | `node/4450505158` | `9_5` |
| Görlitzer Straße | `DEBE02YY400009Tw` | `node/5486696112` | `9_5` |

| Public object | Exact node | Packet | Scene floor drawn/native |
|---|---|---|---|
| cycle-stands (1 hoops) | `node/13233543861` | `5_3` | 3.00/3.00m |
| cycle-stands (2 hoops) | `node/13233543862` | `5_3` | 3.00/3.00m |
| cycle-stands (1 hoops) | `node/7001467385` | `6_4` | 3.22/3.22m |
| cycle-stands (1 hoops) | `node/9010396870` | `6_4` | 3.00/3.00m |
| table-tennis | `node/13668760365` | `8_4` | 3.01/3.01m |
| table-tennis | `node/13952438918` | `8_4` | 3.01/3.01m |

## Runtime integration and verification

Import `prepareKreuzbergStreetsV267` from `KreuzbergStreetsV267.ts`. Production order: all existing v266/v265/v264/v233…v238 preparers → `prepareEurefTransfersV262` → **`prepareKreuzbergStreetsV267`** → `prepareFeuerwacheKreuzbergV267` → the unchanged decoder. The source guard validates every original mesh at its original index and permits already appended meshes. Idempotence prevents duplicate supplementation. The production regression test compares the same complete preparation order before decoding.

Five existing packets; one bounded appended mesh per selected packet; **198 drawn / 166 native boxes**, **32,832-byte** runtime recipe. No additional descriptor, root, cache, fetch policy, city coverage, residency or decoder budget. Unknown packets return before touching encoded data. Existing16-mesh/400,000-vertex/2,400,000-index limits remain enforced. Work yields during receipt hashing and every 16 box constructions. No device branch: mobile drawn receives the same complete recipe.

| Packet | Drawn boxes | Native boxes |
|---|---:|---:|
| `5_3` | 12 | 12 |
| `6_4` | 8 | 8 |
| `7_4` | 110 | 88 |
| `8_4` | 48 | 42 |
| `9_5` | 20 | 16 |

Validation: **6 Python tests passed** (2.63s); **8 Bun tests / 944 assertions passed** (3.80s); Ruff check passed. Tests cover exact source/file receipts, all original object identities, complete rectangles and ground footprints, no entrance overlap, independent cardinal native geometry, malformed-source rejection, all earlier preparers, actual production stream decoding, and coexistence with the complete fire-station replacement in both append orders. Existing navigation, old geometry and old line buffers survive unchanged by the street supplement.

## QA cameras

All five eye-to-target segments were checked against local building polygons in drawn and native; no obstructing building segment. These are close views for small real-world street furniture. Root owns the in-app-browser review and overall mobile/93-stop/residency checks.

| Site | Packet | Eye | Target |
|---|---|---|---|
| Wiener lower fronts | `7_4` | `[4036.1, 7.3, 2475.5]` | `[4028.72, 5.05, 2488.1]` |
| Görlitzer lower front | `8_4` | `[4237.7, 7.3, 2368.2]` | `[4244.5, 5.05, 2355.95]` |
| Görlitzer Park outdoor tables | `8_4` | `[4318, 7.3, 2490]` | `[4328, 3.8, 2478]` |
| Oranien west cycle stands | `5_3` | `[2652, 6.3, 1770]` | `[2662, 3.5, 1757]` |
| Oranien east cycle stand | `6_4` | `[3450, 6.3, 2122]` | `[3459.3, 3.8, 2130.86]` |
