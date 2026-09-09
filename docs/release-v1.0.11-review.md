# v1.0.11 review and verification

The release refines BahnTower, Musikinstrumentenmuseum and the Spreebogen bank.
It keeps the existing 93-place catalogue, bounds, raw city payloads and all
previous source records. The museum supplement appends the separately mapped
entrance pavilion; four new external Commons references bring each independent
credit manifest to 255 unique entries.

## Independent review

Separate reviewers checked the tower and museum source geometry, mode variants,
replacement masks and runtime integration. The bank received an independent
review of its rendered surfaces, shared terrain integration and walking support.

| Finding | Resolution |
|---|---|
| Museum roof heights added basement-relative height to street ground | Use original absolute NHN roof planes; preserve source basement surfaces separately. |
| Separate museum entrance was omitted and substituted too far north | Preserve and display source pavilion K0003U6g at its exact footprint, with an open passage below its roof. |
| Museum Minecraft mask claimed part of adjacent low wing K0003VMd | Require positive cell/footprint overlap and exact quantized source-height ownership. Audit: 255 removed cells, zero unowned cells, zero old owned cells left. |
| Two disconnected GML wall polygons were grouped as exterior plus hole | Extract each original Polygon independently; all 15 parts and 158 polygons checked against the two official archives. |
| Coarse park and ground surfaces buried the new lower promenade | Replace only the exact mapped park presentation, grade bounded Minecraft backing cells, retain raw source data. |
| Float32 park boundary reverted to old terrain; backing crossed the river lawn | Include the exact source boundary within 0.1 mm rounding tolerance and recess its backing; zero overlaps at all 248 paired ray samples. |
| Splitting Minecraft terrain runs changed fragment colours | Keep each original run's shade seed and source height for unaffected fragments; verify total width, outside heights and colours. |
| Walking still sampled the old ground under the reconstructed rising lawns | Derive bounded pedestrian support from the same rendered lawn triangles. |
| Native Minecraft deck rasterization left gaps on diagonal sections | Use conservative deck cell coverage shared with the mode-specific walking sampler; verify 380 actual path rays across full/mobile variants. |
| Half-cell rounding merged distinct native lawn tiles | Key horizontal blocks by their integer source cell rather than rounding half-cell centres. |
| Old lawn heights were added twice and upper deck sections did not meet | Use continuous shared cross-sections and the documented upper/lower envelope; path rays and navigation sample the same triangles. |

The tower review found no remaining blocking issue. Its 99 source wall/roof
planes, three-part crown, outward-facing DB letters, all 26 illuminated floors,
lights-off restoration and worker material transfer were checked. The museum
review confirmed the source correction and all fixes above. Existing Lenné
instance records remain byte-for-byte identical in all four detail profiles.

## Validation

Focused geometry tests cover source preservation, exterior and roof rays,
mode-specific construction, exact replacement ownership and continuous path
heights. The shared integration tests inspect the actual early Minecraft
construction stages and confirm that native bank paving remains above its
backing terrain without changing the source payload. Unrelated ground runs
retain identical transform and colour buffers.

Final verification completed:

- Frontend baseline run: 1,753 tests, with five obsolete fixture/count
  expectations updated for the new dedicated models. All 73 affected existing
  tests passed on targeted reruns. The final bank/walking checks passed all
  16 tests / 6,063 assertions; synchronous/cooperative Minecraft comparison
  passed all four tests against fresh full/mobile buffer hashes.
- Python: 355 tests passed before packaging; the one package-version readiness
  test passed after building v1.0.11, covering all 356 tests successfully.
- TypeScript, production Vite build, Ruff formatting and lint passed.
- Release readiness and the unpacked local-server smoke test passed for v1.0.11.
- Canonical features, bounds, sources, all prior museum/Lenné records and each
  independent 251-record credit prefix were verified unchanged.

Final full Minecraft has 3,794,603 instances / 96 renderables / 289,620,142
buffer bytes; mobile has 991,634 / 94 / 76,027,470 bytes. The full buffer increase
relative to v1.0.10 is approximately 0.81%. These counts describe retained
geometry, not browser memory or frame-rate measurements.

No blocking review finding remains after the corrections above.

## Visual scope and limits

Actual Three.js triangles, instance transforms and material states were
inspected in orthographic software QA for day, night, lights-off and Minecraft,
including the museum entrance and integrated riverbank with real ground,
water, quays and bridges. These are geometry images, not browser screenshots.

The Mac remained locked and computer control could not unlock it. Consequently,
a direct browser/phone interaction test, GPU tone mapping and the exact apparent
brightness of the night facade were not verified on a device. Automated material
transition tests do confirm the bright-floor state and reversible light switch.

Source-specific measurements, display estimates, evidence links and budgets:
[BahnTower](db-tower-refinement.md),
[music museum](music-museum-correction-v111.md),
[Spreebogen bank](spreebogen-bank-refinement.md).
