# Lossless loading and storage — v1.0.189

The owner requests a smaller repository and faster startup/high-altitude loading,
with no loss of visual quality. This change removes repeated work while keeping
all original source files and all rendered detail. It changes neither coverage,
geometry, material values, resolution, sight distance, navigation, six visual
modes, 93 tour stops nor any residency, decode, prefetch or release ceiling.

## Identical source fingerprints

Six existing packet consumers share the original FNV-1a fingerprint of a source
part's encoded positions, colours and indices. A WeakMap uses the actual source
object as owner; every lookup compares all three exact strings. Changed inputs
are hashed again. Interrupted hashes are never cached, and the original
65,536-character construction yields remain on a cold hash. A material-kind
adapter retains its original packet owner rather than caching a temporary clone.
The cache cannot keep a visited packet alive.

An audit of 43 receipt families covers 2,242 source parts. All 580 parts with
overlapping guards match their original receipts, with no missing or different
fingerprint. Sharing those checks avoids 511,510,184 of 986,320,932 character hash
steps in that overlapping subset. It does not bypass receipt comparisons or
accept changed geometry.

Five alternating local constructor comparisons cover twelve real drawn/native
packets and 33,553,620 geometry bytes. Every pair has identical complete geometry,
indices, bounds, transforms, material metadata, navigation and counts. Their
median CPU time changes from **1,189.58 ms to 887.27 ms**. A separate hash-only
microbenchmark changes from 536.03 ms to 197.79 ms. These are workstation CPU
measurements for the sampled work, not whole-city, network, GPU or phone timings.

## Direct Base64 byte decoding

Seven audited consumers use a small shared decoder. Engines that provide
`Uint8Array.fromBase64` produce the same owned bytes directly, without a temporary
binary string and per-byte callback. Older engines retain the established
`atob` conversion; a native rejection falls back to that same acceptance/error
behaviour. Existing gzip codecs, parsed values and scratch-buffer release remain
unchanged. Potsdamer Corridor keeps its original per-site source-buffer lifetime.

All 72 audited streams, totalling 2,364,510 decoded bytes, retain their exact
combined SHA-256:
`b3c784ac43f8181855d4399fed7638faa63b11990672b381eaa2c07cc5cb4578`.
All ten complete architectural model variants match their pre-change geometry
receipts in both decoder branches. Additional checks cover negative zero, typed
array bytes, padding, whitespace, malformed inputs and independent ownership.
An independent comparison covers 154,240 additional short/random inputs.

Nine local decoder repetitions produce medians of **12.689 ms before**, **1.206 ms
with the native operation**, and **2.420 ms with the loop fallback**. These numbers
measure the 72-stream decoder workload only. The reproducible harness is
`src/app/scripts/benchmark-base64-v290.ts`.

## Storage audit and rejected road compression

The original road NDJSON contains 30,512,656 bytes. A tested, byte-exact gzip
asset would occupy 16,509,082 bytes. However, fresh HTTP inspection establishes
that GitHub Pages already transfers the existing asset with `Content-Encoding:
gzip`, at 16,289,518 bytes. Application-level gzip would add about 631 ms of local
Worker decode CPU even with 16 KiB slices, without improving that transfer.
That experiment is excluded. The production road loader, its source and build
asset path remain unchanged.

The audit finds no large, safely disposable source family. Small duplicate
source receipts remain because they preserve independent provenance and
reproducibility. Historical public releases and usable downloads remain intact.
The initial v189 retention audit protected all 326 v187/v188 assets and identified
fourteen v186-only candidates totalling 70,780,099 bytes. The owner's subsequent
instruction permits closing or ignoring old tabs, releasing that compatibility
window. A fresh complete current-package and dependency audit permits removing
77 further old-only assets / 120,794,000 bytes. Current files remain unchanged;
the [publication report](release-v1.0.189-review.md) records both stages.

The complete candidate has 4,754 files / 936,374,015 bytes, 270 bytes smaller
than v188. Its initial hosted tree had 4,831 files / 1,057,168,015 bytes, within
the unchanged 1 GiB ceiling. Although fourteen obsolete files yield 70,780,099
bytes, changed hashed modules retained alongside v187/v188 make that temporary
three-version store 26,013,542 bytes larger overall. This is not reported as a
net hosted-storage reduction for that initial deployment. After the explicitly
authorized old-tab cleanup, the hosted tree matches the complete current package:
4,754 files / 936,374,015 bytes. All 318 current assets and their dependencies
remain. Previously opened old sessions may need to reload. Historical Git blobs
and release archives remain; live-tree reduction is not total GitHub disk recovery.

Local `git gc --no-prune` packs the same repository objects more efficiently.
Every Git ref remains byte-for-byte unchanged and connectivity verification
succeeds. Object storage changes from 4,059,581 KiB to 2,227,383 KiB, reclaiming
1,832,198 KiB (about 1.75 GiB), without rewriting history or pruning objects.
This is local disk recovery, separate from hosted Pages storage.

## Verification and limits

Focused tests exercise cold/warm fingerprints, each input mutation, interruption,
mid-yield mutation, separate owners, adapter guards, real packet receipts,
complete constructors and both Base64 branches. Existing material, roof,
architecture and navigation suites supplement those checks. An old Alt-Mitte
integration assertion expects 3,623,088 geometry bytes but receives 3,982,848;
the identical failure is reproduced with unmodified HEAD consumers and is not
reported as passing or changed to hide it.

Release verification includes the normal TypeScript/Vite budget gates, package
and archive inventory checks, and a single internal full-city browser. The
[publication report](release-v1.0.189-review.md) records actual results; physical
phones and every network condition are outside this workstation verification.

The normal production build passes in 3m30s with unchanged startup/worker gates.
The release-focused frontend set passes 45 tests / 6,128 assertions. Complete
ZIP and TAR validators, 111 focused Python tests and the extracted-package HTTP
launch pass. A quiet
single-tab local browser comparison records preview readiness at 7,117 ms for
both v188 and v189, and exact readiness at 13,667 versus 13,676 ms. That sample
supports no overall startup-speed claim. The measured gain is in the repeated
district work above.

The internal browser renders Day, Night, Minecraft, Snowstorm, Schwellenraum and
Flooded Berlin and checks five seconds of upward flight. Entering Schwellenraum
logs Three's `Unable to serialize Texture` warning in both the unchanged v188
and v189 builds; no new application error is observed. A separate MutationObserver
observation error originates in the browser tool while navigating the old
comparison page; the application contains no MutationObserver use.
