# v1.0.93 — Zionskirchplatz and Arkonaplatz

## Delivered scope

- [Zionskirchplatz](zionskirchplatz-v193.md): the complete directly square-facing
  source inventory covers 20 parents and 30 wall planes. Two planes already have
  authored detail; 28 further planes receive muted plaster colours, divided
  window frames, sills, cornices and ground-floor door/window treatments. The
  exposed upper wall above the low neighbour is included through a height-aware
  visibility check.
- [Arkonaplatz](arkonaplatz-v193.md): mapped trees, benches and planted-bed edges,
  plus a representative Sunday flea market with 15 stalls and 10 light canopies.
  The central market paving follows the retained square and terrain; real lawns,
  playgrounds and the mapped paths remain open. Books/records, small radios and
  frames are geometric display examples, not a live trader or product inventory.

Berlin LoD2 walls and OSM ground features remain the metric anchors. Individual
window divisions, member sizes, dated photo-guided colours and movable market
objects are display estimates, not a measured facade survey. Three additional
Zionskirchplatz photographs and one market photograph are individually credited;
all 515 previous source notices remain intact in the closed source menu.

## Preservation and runtime

Existing city packets, source shells/roofs, street/path rings, trees, terrain,
the 93-place tour, view distance, resolution and residency budgets remain.
All eleven earlier v175 frontage planes and their historical Café 103 reference
stay intact. The church and hill payloads are byte-identical to v1.0.92.
No photograph, texture, animation or unrelated city expansion is introduced.
Touch and pointer retain the same complete drawn detail; Minecraft uses its own
orthogonal representation and the previously requested reduced tree density.
Each family uses the existing mode-switch release/rebuild lifecycle.

## Validation

- Complete Python sweep: 991 passed and four skipped. The initial package-readiness
  test ran before the v1.0.93 package existed; the completed package is checked
  separately below. Eleven focused source/preservation tests subsequently pass,
  including all eight new v193 tests.
- Eleven focused Bun checks pass with 182,124 assertions: per-owner terrain,
  source-wall bounds, existing frontage preservation, market/path clearances,
  exact draped paving, independent support feet, native orthogonal geometry,
  memory/draw limits and complete shared-mode resource release/reconstruction.
- Production TypeScript/Vite build and Ruff pass. All earlier public city packets,
  church/hill/frontage payloads and 515 earlier credit records remain intact.
- Chrome: six overview/detail visits plus three close Zionskirchplatz faces, with
  no page/console errors or WebGL context loss. Early obstructed QA camera poses
  were corrected before assessing the market, without changing viewer controls.
- Mobile WebKit with the iPhone 13 browser profile: seven sequential visits through
  all six modes and back to Day pass. Tracked vertex/index/instance GPU buffers
  peak at 350.3 MiB on that route; this excludes driver/texture memory and is not
  a physical iPhone RAM measurement. Final paving is additionally checked in
  desktop Day and mobile Day/Minecraft/Night close views.
- Independent review caught the low-neighbour visibility issue, an incorrect
  test-only unit-cube bound assertion, the missing central paving appearance and
  rigid supports floating on the slope. All four are corrected.

Added component buffers total **525,796 bytes / six draw calls** in drawn modes
and **930,972 bytes / five draw calls** in Minecraft, including the source-clipped
market paving. There are no new textures or per-frame animation callbacks.

Final package checks pass: all 76 release-readiness tests, the readiness script
and the extracted-package launcher smoke check. The release ZIP and static tar
share this complete viewer. Public asset digests and fresh browser startup are
checked again during deployment.
