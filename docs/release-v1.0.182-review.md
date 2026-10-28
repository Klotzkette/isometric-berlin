# Step 10 — v1.0.182 review

## Scope and result

Two bounded corrections retain the existing city coverage, all 93 tour stops,
six presentations and runtime/package limits.

The Fernsehturm keeps its source position, metric dimensions and every original
drawn/native component. A depth-tested, pixel-area coverage companion prevents
subpixel loss during distant pans. Tower-specific ordinary-fog contrast is
retained; actual submerged fog and normal foreground occlusion still apply.
See [tower evidence and remaining visual limits](fernsehturm-horizon-v283.md).

The false tall prism northeast of the Beethoven–Haydn–Mozart memorial becomes
the low, open Schutzhütte am Steppengarten. All eight original source sheets and
its measured plan remain evidence. Only the exact old prism and three exclusively
owned native columns are replaced, with matching walkable interior geometry.
Eaves, ridge and small masonry details are photo-based display estimates.
See [shelter source evidence](steppengarten-shelter-v283.md).

## Validation

GitHub Actions [run 40677648990](https://github.com/Klotzkette/isometric-berlin/actions/runs/40677648990),
job 122780039580, succeeded on the release source below.

- Model/horizon suites: 46 tests, 0 failures, 46,976 assertions in seven files.
- Lossless/portability suites: 33 tests, 0 failures, 5,702 assertions in seven files.
- Combined: 79 tests, 52,678 assertions in 14 suite files.
- Full TypeScript build and Vite 8.1.4 production build passed.
- Release readiness for 1.0.182, HTTP package smoke and archive uploads passed.
- Complete CI log: 83,415 bytes, SHA256
  `03232b1b75903e24b221931f8ad2fe9dcf715d8cddbf197d46f5772364828a2c`.
- Three new shelter Python tests passed locally with temporary capture and
  bytecode/cache writes disabled. This is not a complete Python-suite pass.

The internal-browser evidence exercised isolated production constructors:
four distant anchors in Day, Night, Snow, Minecraft, Schwellenraum and actual
submerged fog; micro-panning; opaque foreground occlusion; and both shelter
model families. The discovered shader literal and Snow contrast failures were
fixed before the passing follow-up checks. Final native row coalescing and local
fog-uniform defaults were additionally checked numerically and by regression.

A final full-city browser session, physical-device check and final native
wide-angle visual check were not completed: the Mac exhausted writable space.
These are explicit visual verification limits, not claimed passes. A normal
full Python test invocation could not start because temporary-file capture hit
ENOSPC. The three new shelter tests passed with capture disabled; other Python
tests require ignored original source archives not present in fresh CI.

## Build and storage handling

The release was built and packaged on GitHub, pinned to `b4d19da3e9a4aa187b849acffeddb834c8ef263e`. No successful
local production build or local archive receipt is claimed. The retained v181
package was not replaced on the full Mac. Only exact task-generated cache files
were removed, with inventories; no personal files or original source data were
deleted. Final remote source changes remain ahead of the local dirty checkout.

Two earlier candidates passed their focused tests, build, package readiness
and HTTP smoke but were not published because their complete retained Pages
trees exceeded the existing limit. Two extra Three.js helper exports first
renumbered shared aliases; the same four independent standard fog uniforms
are now declared locally, with identical shaders and renderer updates.
A second platform-only difference came from the gzip OS metadata byte in
build-time source strings. Fixing this byte to the existing v181 marker restores
unchanged assets across macOS and Linux. All payload bytes, CRCs, lengths,
source values, prepared Zopfli data and runtime ownership stay unchanged.
See [portability audit](source-gzip-portability-v283.md). The final full archive
and Pages inventory checks below establish the resulting sizes and retention.

## Publication evidence

Source and version tag: `b4d19da3e9a4aa187b849acffeddb834c8ef263e`.
The release source was fast-forwarded onto main after final validation. This review
and the README are a subsequent documentation-only commit; the version tag stays
on the tested build source.

[Release v1.0.182](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.182),
ID 426505438, was published at 2026-10-28T11:28:27Z.

| Asset | ID | Bytes | SHA256 |
| --- | --- | ---: | --- |
| isometric-berlin-regierungsviertel-local.zip | 684756622 | 765,487,215 | `118137b2ec5e4c765ce694fd28015a6ede2f284baa5b97f35527a78a3d4e6c85` |
| isometric-berlin-viewer-v1.0.182.tar.gz | 684756620 | 764,698,153 | `0c5d4fff2addafe4d5a5e9d0d02a26556e03640bf48e515d18c3f039b2b2b43c` |

Both complete archives were streamed and SHA256-verified. All 4,752 ZIP members
were checked for length, CRC and SHA256 before publication. The package occupies
935,302,812 bytes; 4,737 files totaling 900,481,428 bytes are byte-identical to v181.

Pages commit `ad266c88d4205763d06c5f188d39a3e79d1be4e0` has sole parent
`60eaee29f0ecf6675757d5bb2d654f64f177d98c` and tree
`feca2ba2be00db62e7eff2505d04ee88b951e03f`.
The entire resulting tree was checked against every expected path, mode, blob SHA
and size before its non-force ref advance: 4,790 files, 1,056,661,631 bytes,
17,080,193 bytes below 1 GiB. All previous assets were retained, including the
336 protected v180/v181 assets; no pruning occurred. Only 15 new blobs totaling
34,821,384 bytes were uploaded. Three other entries restore executable modes for
existing launcher/server blobs.

- Prepublication proof:
  `0b23042466da11806a585532cd0db33d615e2a0d76e19a1f49b2cf9ccb95a30f`.
- Complete prospective inventory SHA256:
  `3f37b208fe0a38090600b5ef724e8cbd6c062ed6e0332e0750a498281f62d137`.
- Package manifest SHA256:
  `d5e6d3a680bbbe87fa12e273fcaaa55960cb4cd559d16a553c7eaa6b36b317a9`.

Legacy Pages build 1321362457 completed successfully. Actions run 40680150588 and
deployment 7384133153 (status 20812595640) succeeded for the exact new Pages commit.

The public [viewer](https://klotzkette.github.io/isometric-berlin/) returned the
exact validated index (SHA256
`29e50487b83bb089b3baae0c5f7703679494b4010f54fcc3fd24cf538150c8d2`)
and manifest. The new index-BBm6DHL5.js, tower CtV35ad6, shelter-bearing
RequiredSiteEnvelopes DXe5vo94 and palastStage Fu7KFX5n modules, both retained
v180/v181 entries and OuterThinOutlines modules, and the shared Three engine
returned HTTP 200 with the exact expected lengths, SHA256 and Git blob IDs.
Both public archive URLs returned HEAD 200 with exact sizes; 64-byte Range 206
responses confirmed ZIP/GZIP signatures without downloading the archives again.

This is a representative public HTTP check, not a second download of all 4,790
public files or a new visual browser/device check. The full package and proposed
Pages inventory were independently checked before publication.
