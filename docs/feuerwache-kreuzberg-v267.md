# Feuerwache Kreuzberg — v267

The bounded improvement concerns Berliner Feuerwehr's station 1600 at Wiener Straße 64. It preserves the exact existing owner `DEBE02YY40000Avj`, every measured sheet, neighbouring buildings and all unrelated earlier detail. The former single 15.5 m parent extrusion is replaced atomically by the complete six-part source in the existing `7_4` stream lifetime. No new descriptor, resident root, texture, animation, tour stop or loading/memory allowance is added.

## Evidence and current appearance

The [operator](https://www.berliner-feuerwehr.de/ueber-uns/standorte/feuerwache-kreuzberg/) confirms the address, station identity, construction starting in 1973 and opening on 20 October 1976. Its current public exterior photograph shows the dark horizontal cladding, red window fields, pale frames, glazed vehicle gates and mast. The operator dates the nearly 100 m painted facade to October 2002.

The [district's 9 September 2026 visit](https://www.berlin.de/ba-friedrichshain-kreuzberg/aktuelles/bezirksticker/2026/feuerwache-kreuzberg-1711918.php) provides current exterior references by **Sara Lühmann**. Two exterior photographs were visually inspected: `image00002.jpeg` and `feuerwache_kreuzberg.jpeg`. They corroborate dark tile courses, silver gate grids and warm painted supports. The photograph named `feuerwache_wienerstrasse.jpeg` is an interior wall and was not used for exterior geometry. No photographic pixels or mural artwork are redistributed. Small warm strips are original abstract recognition cues, not a copy of the protected mural.

The [DDB / Akademie der Künste archival record](https://www.deutsche-digitale-bibliothek.de/item/VJK2FM2DSD6MC44RZ4ETQLQINTZ2VV2Q), Reinhard-Friedrich-Archiv, signature Friedrich-Reinhard 126, identifies Rainer G. Rümmler and photographs dated 1977. This is historical identity/architect attribution; it does not override the current facade references.

Six complete LoD2 leaf parts and **148 original wall/roof sheets** are retained byte-for-byte as parsed source evidence. The original ground is 5.433 m in the source's NHN-relative frame. Their measured heights range from **5.261 m to 15.499 m**. All source rings, curved-corner vertices, holes, roofs and height differences remain, including the tall thin measured sections. These can be more emphatic than the photographic reading; no source wall was silently shortened to match a photograph.

## New detail and ground

The complete dark shell receives shallow horizontal cladding joints, parapet edges, red window fields, pale/yellow frames, glazing, mullions, gate grids, low service windows and the mast. **11 gate panels** occupy three identified source front sheets. Their spacing/count, small frame sizes, colours and 5 m mast are photo-guided display estimates, not a surveyed gate inventory. Gates remain closed; no walkable interior or new passage is claimed. The original solid navigation is replaced by complete measured part envelopes in drawn mode and the actual cardinal height groups in native mode.

The building lies entirely east of the resident ground raster. Both original `7_4` packets declare the actual streamed ground **y=3 m**. The full source is rigidly shifted by **−2.433 m**, preserving all measured relative heights; this avoids confusing raw source elevation with delivered ground. Source and display datums are recorded separately and tested. Native geometry independently samples the full measured roofs on a **0.5 m cardinal grid** (5,664 occupied cells), emits unioned roof plates/exposed walls, then fits rectangular colour panels to the actual resulting cardinal walls. No rotated drawn wall is copied into native mode.

The older v185 frontage treatment contains two lower courses and one upper course following the obsolete parent cap. The two lower courses remain identical. Only **one drawn / eight native upper-course rows**, identified by complete row equality, index and exact owner, move to the retained lower east-wing roof edge. All their XZ positions, widths, section sizes and colours remain. The original rows remain in the immutable predecessor files and the new receipt.

## Exact transfer and integration

`FeuerwacheKreuzbergV267.ts` supplies:

- `prepareFeuerwacheKreuzbergV267(chunk,id,native)`: validates the exact original mesh, line and navigation fingerprints and the complete replacement; appends one new mesh. Additional earlier meshes are allowed. Place after other immutable preparers so their original mesh-count guards still see their expected input.
- `applyFeuerwacheKreuzbergV267Triangles(chunk,meshIndex,indices,indexOffset)`: retires exactly **337 drawn / 376 native** reconstructed old-parent triangles after successful preparation.
- `applyFeuerwacheKreuzbergV267Lines(chunk,values,stride)`: retires exactly **113 drawn** old top-outline segments. Native has no transferred ink.
- `feuerwacheKreuzbergNavigationV267(chunk,nav)`: replaces only this owner with six measured drawn parts / 28 native height polygons, preserving every unrelated navigation record.

Original encoded mesh, line and nav objects remain unchanged throughout preparation, preserving older palette/detail/roof receipts. Retirement occurs only in the final decoded buffers. Changed source, missing replacement or failed budget guard is a conservative no-op. The entire transaction belongs to the existing packet and its cancellation/disposal.

`feuerwacheKreuzbergV267Profiles.ts` is the lightweight helper for the two existing v185 factories: pass `source.boxes,false` or `source.nativeRows,true` to `correctFeuerwacheProfilesV267`. It imports only the small exact profile receipt, avoiding a new early import of the complete replacement data.

## Size, checks and QA

Runtime source: **635,420 bytes**. One added mesh per family: drawn **3,231 vertices / 1,865 triangles**; native **23,672 vertices / 15,574 triangles**. The static source strings remain module-resident; only the active streamed packet allocates geometry. Existing 16-part/400,000-vertex/2,400,000-index packet limits remain enforced. All drawn input profiles use the identical geometry.

Three Python tests pass for all original inputs/sheets, complete drawn source triangles, exact old proxy/profile scope, actual ground and independent orthogonal native geometry. Four Bun tests pass (246,844 assertions), including both production decoder families, all prior raw packet bytes, exact transfer complements, changed-source rejection, idempotence, extra prior meshes and profile no-op behavior. Ruff passes. A separate default-Node TypeScript attempt exhausted its 4 GiB build heap; no successful standalone compiler result is claimed here. Coordinated release compilation and IAB visual QA belong to root.

QA cameras:

| View | Position | Target |
|---|---|---|
| Street front | `[3868.19,24,2375.02]` | `[3883.3,10,2349.1]` |
| West garage / tower | `[3831.89,24,2354.12]` | `[3847,8.5,2328.2]` |

Reproduce: `uv run --no-sync python scripts/build_feuerwache_kreuzberg_v267.py`. Evidence: `geo_data/regierungsviertel/feuerwache-kreuzberg-v267-evidence.json.gz`. The retained original `7_4` assets, source ZIP and v185 data are never rewritten.

Root IAB review (25 October 2026): front passed in both modes with the actual7_4 tile, district188 facade detail and corrected SouthKiez profiles. Closed gates and cladding visible; no floating base. The west camera is source-checked but not separately visually certified. Final coordinated compiler/build results are recorded in the v267 overview.
