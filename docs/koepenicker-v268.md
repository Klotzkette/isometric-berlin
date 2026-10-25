# Step 10 — Köpenicker Straße and Kraftwerk (v268)

Release 1.0.168 implements the owner's explicit clarification: **Köpenicker Straße in Kreuzberg**, not the previously unresolved spoken street name. This bounded continuation refines the existing street and named power-station context; no new district coverage, tour stops, animation or photographic texture is added.

The former Kraftwerk Berlin hall and adjacent active Heizkraftwerk Mitte are separate owners. Their architecture and the historic Heeresbäckerei use complete retained LoD2 sources and public operator/heritage references. Ordinary frontage refinements fit existing source walls and window positions rather than introducing a new speculative window grid. Unsurveyed fittings remain display estimates.

All additions stay in existing streamed packets, with full drawn mobile detail, separately constructed orthogonal native geometry and unchanged residency, decode and prefetch limits. Source retirement is restricted to exact documented inaccurate owners or facade recipes and occurs only after a complete replacement is validated in the same packet transaction. All original source sheets remain retained as evidence.

## Delivered changes

- [Ordinary street fronts](koepenicker-streets-v268.md): 24 existing owners across five packets. Shallow surrounds/sills fit 287 retained drawn and 36 independently verified native panes. All 288 drawn/82 native original panes remain. Four mapped-use lower shopfronts are added; no speculative door, tenant name or new window grid. Unsupported frame candidates remain untouched.
- [Heeresbäckerei](koepenicker-landmarks-v268.md): the exact old flat prism yields to all 11 measured parts and 97 original wall/roof sheets, with the stepped roof hierarchy, yellow/red clinker cues, segmental steel windows, lunettes and cornices. Exact transfer is 184 drawn/514 native old triangles and 65 drawn ink segments. All source evidence remains. Navigation follows measured roof height within 0.10 m in drawn mode and the independent 0.5-m cardinal native grid.
- [Kraftwerk Berlin and HKW Mitte](kraftwerk-berlin-v268.md): the former venue at number 70 receives metal-screen facade relief, dark lower bays and industrial window bands. Only its false residential recipe yields in drawn mode; native replaces the exact merged owner with its complete five-part/43-sheet cardinal reconstruction. The distinct active plant at number 60 retains all four source owners and gains its two mapped major 100-m chimneys, including open mouths. This is not the Scharnhorststraße plant discussed in an earlier request.

## Verification

- Focused integration: 66 Bun tests / 249,810 assertions passed across 13 files, covering the three new refinements, v267 context, streamed decode/cancellation, actual neighbour packets, walking navigation, residency policy and upload lifetime. All 26 focused Python tests across the six v267/v268 modules passed. Repository-wide Ruff format/check passed (839 files unchanged); final TypeScript and Vite production builds passed.
- One Codex internal browser only; no external browser. Actual local source packets and matching district companions were inspected in both drawn and native modes at the Heeresbäckerei corner/roof, Kraftwerk front/full plant, west/central/east street fittings and the Schlesisches Tor approach. The latter includes the real station model. These are bounded visual checks, not a full-city performance certification. Two errors in the temporary harness itself (double decompression and an interrupted input edit) were corrected; successful production-geometry views rendered afterward.
- Independent source/transaction review found no remaining Heeresbäckerei findings. An independently found invisible collision cap over the open chimneys is corrected before publication, with production-navigation regression checks in both modes.
- Full drawn mobile detail, all original source sheets, 93 tour stops and every live residency/decode/prefetch limit remain unchanged. No zero-crash guarantee or surveyed accuracy for estimated facade fittings is asserted.

Primary references, exact source receipts and material/shape estimates are linked in the three model notes and the packaged visual-reference attribution ledger.


## Package preflight

The complete staged package contains 4,747 files / 934,627,505 bytes. The prospective Pages tree, including both retained v166/v167 dependency graphs, is 1,069,680,029 bytes, 4,061,795 bytes below 1 GiB. All 326 prior hashed assets remain eligible; 29 retained-only files contribute 135,052,524 bytes. No current asset is omitted and no live budget is increased. Complete release-readiness validation reports zero failures.

The additional repository-wide Python run was manually interrupted after 319 passing tests in 618.48 seconds while executing historical Shapely geometry checks, to bound local resource use. No failure occurred before interruption; the complete historical suite is not certified complete. All 26 focused Python checks and all 66 focused integration/runtime tests completed successfully. The full-run stopping point is disclosed separately from those completed checks.

## Publication receipts

Implementation commit: `6e479c13`; tag: `v1.0.168`. Complete package inventory SHA-256: `a614b97b71d92cee94a6e416b7d8eb6ec4e2fc139a1cd4d6609da97c6493945d`. Both archives use the original deterministic writers and complete validators, built and uploaded sequentially in memory to avoid duplicate on-disk archives.

- `isometric-berlin-regierungsviertel-local.zip`: 759,046,867 bytes; SHA-256 `37b24720332c089bb88bcdcb7b3f5d40728d973bcbcdd7f6b9a0b5ae8c155022`. Complete validation passed; GitHub size/digest/state match.
- `isometric-berlin-viewer-v1.0.168.tar.gz`: 758,263,027 bytes; SHA-256 `8a3d0776baa4a9801fe2b6aa4d35dfe00df9807849173a7e92f864a59b3a2f7d`. Complete validation passed; GitHub size/digest/state match.

Pages commit: `b9d38c2f09ef4cbe4711c1a7b80f851329bfa1e2`. GitHub Pages workflow40204046690 completed successfully. Public release: [v1.0.168](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.168). All ten checked hosted files match the staged package byte-for-byte, including the index, package/stream manifests, attribution and viewer/site/stream/worker bundles. Both published archive size/digest/state checks match GitHub. All three withdrawn Columbiahalle recordings still return404. The temporary internal-browser QA tab and development server were closed; no external browser was launched.
