# v1.0.103 — Startup memory and stability

Step 10 only. This release changes how the complete existing city is prepared
and held in memory. It changes no source asset, landmark, road, shoreline,
facade, terrain field, draw distance, resolution or rendering/residency limit.
All 1,891 city cells, 93 tour stops and six modes remain available.

## Changes

- Finished static CPU geometry and architectural placement matrices use
  block-wise lossless DEFLATE storage. Reads restore the original typed-array
  bytes synchronously; WebGL receives the same original precision and counts.
  Dynamic data, morphs and mutable mode-colour geometry are excluded. Explicit
  array replacement or `needsUpdate` permanently restores writable storage.
- Only proven exclusive constructor-owned buffers are explicitly detached.
  Shared source data remains weakly cached. Consumers of exclusive storage may
  use a decoded array synchronously but must not retain that borrowed view
  across tasks; a later read restores it. Ownership checks protect aliased and
  partial views. Warmup bookkeeping retains scalar metadata and identity tokens,
  not full decoded arrays.
- The two progressive worker lanes acknowledge complete visible packets after
  their CPU storage preparation finishes. This bounds overlapping allocations
  without dropping packets. Cancellation never acknowledges a retired worker.
- Outer landmark families yield between constructors so temporary decoded
  source graphs can be collected. Cancellation disposes unpublished work.
- Temporary inflate/index buffers are released promptly, and two unnecessary
  typed-array copies during surface decoding are removed.

## Measured cold start

Fresh Chromium, Pixel 5 browser profile, normal Day scene, local production
build. Baseline is v1.0.102. Measurements cover the main JavaScript realm's
heap plus backing storage, **not total browser/process RAM**, workers, textures
or driver memory. Both runs complete the same startup scene with no errors,
context losses, page reloads or runtime replacement.

| Measurement | v1.0.102 | v1.0.103 |
| --- | ---: | ---: |
| Peak sampled JS heap + backing bytes | 1,241,658,035 | 998,326,545 |
| Final ordinary sample bytes | 829,517,196 | 665,902,328 |
| After explicit end-of-test GC | 826,841,994 | 664,654,534 |
| Peak actual WebGL buffer bytes | 243,285,794 | 243,285,794 |

The observed peak falls 19.6%, and retained memory after GC falls 19.6%.
GC is invoked only after the ordinary observation window. The baseline window
is 60 seconds and the candidate window 45 seconds; loading completes in both.
Readiness was 4.99 s versus 7.68 s in these local runs. Compression introduces
preparation work: these results support lower memory, not a faster-ready claim.
Test-machine load and browser GC timing affect both latency and peak samples.

## Preservation and checks

- Frozen v1.0.102 hashes verify the complete drawn and native outer-landmark
  geometry, indices, matrices and transforms byte for byte (47/49 families).
- Lossless storage tests cover exact float bits (including negative zero and
  NaN payloads), multiple compressed blocks, repeated reads, GPU re-upload data,
  mutation, cancellation and shared-buffer ownership. Scratch tests verify exact
  outputs and graceful fallback when explicit buffer transfer is unavailable.
- Focused final integration and lifecycle runs pass, including progressive
  worker backpressure, full source coverage, mode construction, GPU warmup,
  disposal and cooperative cancellation. TypeScript and Vite build pass.
- Full Python run: 1,147 passed, four skipped, with three version/package
  assertions requiring a fresh run after the version bump and packaging. The
  fresh final release/package/smoke run passes all 117 tests, including those
  three assertions. Ruff format/check and whitespace checks pass.
- A broad Bun attempt was stopped under host resource pressure. Its transient
  test-harness failures were fixed and retested; it is not claimed as a full
  green run. Historical native-envelope snapshots also differ from the current
  v1.0.102 geometry and were not replaced to hide the discrepancy.

Chrome desktop and touch WebKit each pass 28 near/far views through all six
modes, including complete source-content hashes before and after GPU retirement.
Neither records a page error or WebGL context loss; camera continuity passes.
Touch mode-family changes perform only the existing intentional runtime
replacement. The first WebKit run with intermediate screenshots was interrupted
after it stopped progressing between Night and Snowstorm, with no reported page
error or context loss. The same build passes the complete repeated route without
intermediate screenshots. This interruption is recorded rather than counted as
a successful run or a reproduced application crash.
A separate 45-second WebKit cold start with the iPad (7th generation) browser
profile completes all 452 progressive batches and the surrounding city with no
errors, context loss, page reload or unexpected runtime replacement.

Release readiness and local-package HTTP smoke pass. Extracted package size is
862,162,174 B (822.22 MiB), below the unchanged 824 MiB limit; ZIP is
702,090,831 B and hosting TAR.GZ is 701,419,850 B. Source data and all public
asset files are unchanged relative to v1.0.102. SHA256 sums accompany the release.

No physical iPhone crash was reproduced here. Browser-profile tests
cannot establish a universal device-memory limit or guarantee that every phone
will never crash; the user-reported early crash requires confirmation on the
affected hardware after publication.
