# Six main streets and ordinary houses — v1.0.154

Step 10, inside existing coverage. The retained 29 September 2026 OpenStreetMap
extract and complete delivered LoD2/OSM models supply the evidence. No photograph,
tenant name, new tour stop or city expansion is added.

- [Northern shopfronts](north-shopfronts-v254.md): trim around 220 existing
  Torstraße panes; 60 Danziger and 17 Kastanienallee openings bound to mapped
  commercial use and empty lower wall bands.
- [Western shopfronts](west-shopfronts-v254.md): narrow profiles within 1,796
  drawn / 2,900 independently native existing openings, including 69 eligible
  Kantstraße fronts. Sparse protected western Ku’damm owners remain protected.
- [Outer materials](outer-materials-v254.md): 191 further exact source-matched
  ordinary houses receive retained colour/material evidence, with no new
  geometry or GPU buffers.

## Street edges and signals

`build_main_streets_v254.py` retains complete named road ways and nearby mapped
controls. It derives missing longitudinal kerbs from actual delivered asphalt
boundaries, excluding previous kerbs, buildings, crossing gaps, packet cuts,
higher authored streets and the Weinberg slope. Transverse road-end caps are
rejected. Drawn kerbs follow exact edges; native geometry uses complete contained
quarter-metre cells. Nominal 22 cm width and 15 cm rise are display estimates.

The 32 existing family packets contain 225,126 additional drawn and 343,578
native encoded geometry bytes in total. Approximately 13.88 km drawn / 9.99 km
native accepted courses are refined. These counts describe the independent
delivered surfaces, not new surveyed curb measurements.

28 additional mapped controls (14 Danziger Straße, 13 Kurfürstendamm, one
Torstraße) receive grounded poles and approaching-traffic headings. Both
families require actual pavement support and clearance from both carriageway
representations. Centreline controls may move to a nearby safe verge; offsets
and headings without explicit direction tags are presentation estimates.
Other existing signals remain. Locations without proven support are not invented.
The original signal batch and update loop own these additions.
Final support is verified independently from retained horizontal triangles and
then against fully prepared runtime meshes. Eight drawn and nine native poles
stand on the existing 3.22 m pavement rather than the underlying 3.12 m generic
path. The evidence contains 56 exact support receipts; all 28 source identities,
anchors and headings remain fixed.

## Preservation and stability

All original source packets, roofs, courts, navigation and the manifest remain
byte-for-byte intact. Fittings append through existing cancellable packet
decoding or existing northern batches. No new descriptors, textures, animation
loops or mobile quality reduction; residency, upload and prefetch limits remain.

New constructor payloads and the earlier read-only v213 appearance receipts
use audited lossless compression and weak caches. The two retained legacy
Leipziger Platz and Schloss/Naturkunde navigation sources instead use eager
lossless decoding, preserving their strongly shared object identities and
mutation semantics. This keeps the progressive worker within its unchanged
16 MiB limit while retaining every source value.
The initial attempt caught the oversized worker before publication; raising the
limit or deleting detail was unnecessary.

Source/evidence archives retain exact input hashes, full source identities,
unchanged packet receipts, curb footprints and independent signal support.
Focused tests check source preservation, actual support, crossing gaps,
orthogonal native geometry, identity merging, corruption, cancellation and
per-packet budgets. Final browser and release results follow below.

## Release validation

- Production TypeScript/Vite build passed. The progressive worker is
  16,678,119 bytes, below its unchanged 16,777,216-byte ceiling.
- New street geometry, exact signal support, northern and western openings,
  outer materials and lossless codec suites passed. Final signal regression:
  five Python checks and 20 Bun checks / 221,597 assertions. Ruff is clean.
- The full Python run completed with 1,687 passes and four skips. Its one failure
  used the old signal-height assertion already collected before the concurrent
  grounding correction. Rerunning the complete final five-test street suite
  passed; no unresolved test failure remains.
- 24 production-browser cases passed: eight locations each in desktop Chromium
  Day and Minecraft and iPhone 13 WebKit Day. The actual Day→Minecraft UI switch
  was exercised. Visible north/west frames, street-edge batches, outer colours
  and the corrected Ku’damm signal were inspected; no page error, crash, context
  loss or sampled WebGL error occurred.
- The complete offline package is 930,202,098 bytes (887.110 MiB), below the
  unchanged 889 MiB limit, with 4,647 files. ZIP/TAR contents and SHA-256 checks
  pass. Keeping both prior live asset sets leaves 49,866,723 bytes below the
  1 GiB Pages ceiling.

These bounded browser checks do not replace a long-duration test on a physical
phone. No guarantee of crash-free operation under arbitrary device memory
pressure is implied.

## Publication

Source/tag: `f5e54c46`, `v1.0.154`.
Pages: `9361fdf03d333555d4dea2a0bdd8f2cdfb86c8a0`; GitHub reports the build as
`built`. The published tree contains the complete verified package and both
prior live asset sets, with no hosted data overrides.

[Release downloads](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.154)
contain the complete ZIP, static TAR.GZ and versioned checksum file. All three
uploaded assets match their final local sizes and GitHub SHA-256 digests.
Checksums are retained in `releases/SHA256SUMS-v1.0.154.txt`.

Public verification matched eight entry/manifest/worker/feature files exactly
to the final package, then passed 12 browser cases at Torstraße, Kantstraße,
the corrected Ku’damm signal and the outer material example in desktop Day,
desktop Minecraft and iPhone WebKit Day. All screenshots were inspected;
there were no recorded page errors, crashes, context losses or sampled WebGL
errors. The public signal base measured 3.2199998474 m in every profile,
matching its 3.22 m pavement.
