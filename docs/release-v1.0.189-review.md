# v1.0.189 — lossless loading and bounded storage cleanup

Published 1 November 2026. The [viewer](https://klotzkette.github.io/isometric-berlin/)
and [release](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.189)
were read back after publication. Shared exact source-part fingerprints and
direct Base64 decoding remove repeated work. Source geometry, materials,
navigation, six modes, 93 tour stops, resolution, sight distance and every
runtime/release ceiling remain unchanged.
[Implementation, measurements and limits](lossless-loading-v290.md).

## Verified source and outputs

- Built runtime source: `73295a35b7c36f219c83628241eda132338d4332`.
- Annotated tag target: `d124aeaee74e055b993f29b61d617d7a00be593d`.
  Only measured documentation and archive checksums differ from the built source.
- Annotated tag object: `6006a3ee53d1b1c5939c125364ffbe1d23831dc1`.
- Pages commit: `02638e2e0a6e891fdc5e2dd9985076f6ed201139`,
  parent `d871de0e5bb1602b905bbd8a51809598ff4db519`.
- Pages tree: `3e589feb9248ac4cfb4a61a417217f7afe11ecef`.
- Exact [Pages run 41340960741](https://github.com/Klotzkette/isometric-berlin/actions/runs/41340960741)
  completed successfully for that commit.
- Public release ID `430797708`, published `2026-11-01T19:23:47Z`;
  latest and tag endpoints identify the same release and assets.

The extracted package contains 4,754 files / 936,374,015 bytes, leaving 4,353
bytes below the unchanged 893 MiB ceiling. Manifest SHA-256:
`82e8fbeaa97d0c065a9c35e5d644b2b6a33c07a4e9f03d5b376d573f5e0df956`.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| ZIP | 765,922,327 | `a57d687a48ec96b961a9bc0fef3e252a8ab4315d29b23199e545862736e69577` |
| TAR.GZ | 765,139,403 | `568bf085eede669bcb0dea780439ff52a4639415e1ff5a1be7fb337b607dcd1f` |

Both complete archives pass canonical inventory validation. GitHub uploaded
states, sizes and server digests match the local archives exactly.
[Versioned checksums](../releases/SHA256SUMS-v1.0.189.txt).

## Performance and quality evidence

Five alternating local comparisons of twelve real packet constructors retain
all 33,553,620 geometry bytes, indices, bounds, transforms, materials, navigation
and counts. Median CPU time changes from 1,189.58 to 887.27 ms, about 25.4% less.
This measures sampled repeated district construction, not whole-viewer loading.
All 72 audited Base64 streams and ten complete architectural model variants
retain their exact bytes in both decoder branches. Mutation, interruption,
concurrent-generator and malformed-input checks preserve validation behaviour.

A quiet one-tab local comparison records preview readiness at 7,117 ms for both
v188 and v189; exact readiness is 13,667 versus 13,676 ms. No measurable overall
startup improvement is claimed. The road-gzip experiment is excluded: Pages
already compresses its transfer and a second inflater added CPU work.

The normal TypeScript/Vite build, unchanged budget gates, Ruff and formatting
pass. The final focused frontend set passes 45 tests / 6,128 assertions; 111
focused Python tests pass. Complete ZIP/TAR validation, canonical release
readiness and extracted-package HTTP launch pass. An existing Alt-Mitte
integration assertion fails identically with unchanged consumers and remains
documented; a complete repository-wide suite is not claimed.

One internal full-city browser checks all six modes and five seconds of upward
flight. The Three.js texture-serialization warning on entering Schwellenraum
also occurs in unchanged v188. No new application error is observed. Public
browser inspection confirms v1.0.189 and the rendered normal scene; music and
soundtrack are left off. This is not physical-phone certification.

Public HTTP verification matches 75 files / 119,457,806 bytes: every changed
path, current manifest, scene metadata and both distinct protected prior workers.
The exact Pages ref matches before and after the HTTP checks.

## Initial storage and retention

The created Pages tree matches every planned path, mode, blob and size:
4,831 files / 1,057,168,015 bytes, leaving 16,573,809 bytes below the unchanged
1 GiB ceiling. All 326 protected v187/v188 assets remain. Exactly fourteen
proven v186-only assets / 70,780,099 bytes are removed. Changed hashed modules
retained for existing tabs make this temporary three-version store **26,013,542
bytes larger overall**. No net hosted-storage saving is claimed. Historical
public releases and their usable downloads remain intact.

Local `git gc --no-prune` preserves all refs and objects without rewriting
history. Object storage falls from 4,059,581 to 2,227,383 KiB, reclaiming
1,832,198 KiB (about 1.75 GiB). Connectivity checks pass.

After live publication and fresh public v188/v189 archive checks, exactly four
old generated v188 paths are removed: previous dist, extracted package, local
ZIP and versioned TAR. Fresh inventories cover 9,501 regular files / 3,403,789,112
logical bytes. All candidate files have one hardlink; all target ancestors and
subdirectories are checked for symlinks. No source, raw cache, QA receipt, Git
history or public release is removed. Current v189 dist/package inventories
and manifest match before and after; cleanup changes no Git ref or tracked file.

Available filesystem space rises from 55,130,120,192 to 57,953,120,256 bytes
during deletion, an observed increase of 2,823,000,064 bytes. APFS sharing,
snapshots and concurrent activity affect physical accounting. Logical deleted
bytes, allocated bytes and this delta must not be added or reported as net
baseline savings. Identical current source/dist/package files share verified
local hardlinks; edits must replace those paths atomically. Both published
archives contain complete ordinary files.

## Owner-authorized old-tab cleanup

The owner's continuation explicitly permits closing or disregarding previously
opened tabs. The one remaining task viewer tab was closed and the task browser
tab list was empty. This releases the previous-two-live-version asset retention
requirement. No new browser tab was opened for this cleanup.

A fresh audit hashes all 4,754 current package files and recomputes the complete
dependency graph: all 318 current assets remain reachable, with no missing
reference and exactly the original current graph. Exactly 77 old-only v187/v188
assets / **120,794,000 bytes** are removed. Every retained path, mode, Git blob
and size is unchanged; the live tree now equals the full canonical current
package: **4,754 files / 936,374,015 bytes**, 137,367,809 bytes below 1 GiB.
No nonasset path, source, public release or archive is deleted. The live tree is
94,780,458 bytes smaller than the pre-v189 live tree; retained history means this
is not an equivalent reduction in total GitHub object storage.

Cleanup Pages commit: `d72cdf3649605230d7b4f6ff4842d3fd132d098f`,
parent `02638e2e0a6e891fdc5e2dd9985076f6ed201139`,
tree `7e4351ef939a9e858e6b1f92bb3c4a23bca35c79`.
[Pages run 41345735981](https://github.com/Klotzkette/isometric-berlin/actions/runs/41345735981)
completed successfully for that exact commit. Public HTTP checks confirm 73
unchanged current files / 96,856,561 bytes, including the index, manifest,
scene metadata and current worker. Both removed prior workers return HTTP 404.
The live branch ref matches after those checks. Version v1.0.189, its manifest,
geometry, quality, runtime limits and published archive digests are unchanged;
no rebuild or new application release is needed. Old sessions may require a
reload, as explicitly authorized.
