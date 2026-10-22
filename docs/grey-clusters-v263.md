# Step 10 — remaining generic house clusters, v263

Release 1.0.163 refines existing ordinary houses without expanding geographic
coverage, the 93-place tour, live packet limits or residency budgets.

## Result and evidence

- **449 owners in 15 existing legacy city packets** receive retained mapped
  wall/roof colours or material tones. Older passes had omitted this packet
  family. Explicit mapped grey remains grey. [Material evidence](outer-materials-v263.md).
- **146 street fronts in 25 existing packets** gain 1,031 drawn or 687 native
  windows, with frames, glass and sills. These include City West, Spandau,
  Pankow, southwest Berlin, Hohenschönhausen and Adlershof samples.
  [Exact source-wall evidence](grey-facades-v263.md).
- Nine sampled generic clusters receive an additional ownership audit of grey
  corner vertices. Only vertices whose incident source triangles agree on one
  complete building owner can change. Truly shared or uncertain corners remain.
  Explicit material observations are applied afterwards and retain priority.
  [Corner audit](grey-cluster-colours-v263.md).

This is a finite refinement of identified clusters, not a claim of a full
photographic survey of every Berlin house. Source-supported colours are
separated from illustrative window subdivisions and fallback material tones.
Earlier source geometry, roofs, authored detail, open courts, navigation and
independent native construction remain preserved.

## Integration and verification

The additions use the existing cooperative packet decoder, source fingerprints,
renderer buffers and disposal lifetime. New colour receipts are losslessly
compressed constructor inputs. No new texture, animation, descriptor or draw
call is introduced; full mobile geometry and live memory limits remain.

Internal-browser review covered mapped colours in legacy packet `2_6`, new
fronts on Rintelner Straße and Abtstraße, and repaired Spandau corners. Drawn
and independent native views were checked with one temporary WebGL renderer;
previous roots were disposed between views. No external browser was opened.

To keep the complete package and both previous live asset graphs below the
unchanged hosting limit, the build also stores a finite set of existing sources
more compactly. Source values and strong/weak lifetime contracts remain exact;
see [retained-source storage](lossless-retained-sources-v263.md). No geometry
or previous release dependency is removed to make room.

Final checks: **109 Bun tests in 24 files passed** (21,146,950 assertions),
including exact integrated geometry accounting, previous roof preservation,
all transformed source-value round-trips, cache collection and GPU residency.
**112 focused Python tests passed**; the final early-cache-rejection correction
also passed its three source/evidence checks and four runtime tests. TypeScript,
production build, Ruff format/lint and complete source/build/staged-package
readiness passed. The separate historical all-Python run was stopped after 97
passes as its process approached 2.16 GB RSS; it is not reported as a full pass.

[Finite lossless encoding](lossless-base85-v263.md) preserves all source values
and avoids the temporary base64 binary string. Eighteen eager tile keys now
reject unrelated grey-corner requests before accessing the weak receipt cache.
The final deployment preflight totals **1,073,255,262 bytes**, including both
previous complete live asset graphs: **486,562 bytes below 1 GiB**. Package
archives are built and fully validated one at a time in memory, avoiding two
additional large disk copies. Publication receipts follow below.


## Publication receipt — 2026-10-23

Source commit `cb050b95`, tag and [release v1.0.163](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.163). Pages commit `85f51bd46634b11a13ddd55edb9c9e44c30e1b3e`; [workflow 39873732915](https://github.com/Klotzkette/isometric-berlin/actions/runs/39873732915) completed successfully.

The complete package contains 4,747 files and 927,482,915 bytes (884.517 MiB). Both original archive validators passed in RAM; GitHub asset sizes and SHA-256 digests match exactly.

- `isometric-berlin-regierungsviertel-local.zip` — 756,888,199 bytes, SHA-256 `5b2f84e7fe7cf10b815b3845eabdaf336cd67a390dd6fabe527ce162057aeee4`.
- `isometric-berlin-viewer-v1.0.163.tar.gz` — 756,116,697 bytes, SHA-256 `c2c9a30a562f430090a5366b48fc97e855d39c2fe2a4ac42f895f132932ae70e`.

Ten live files were byte-compared with the staged package, including the entry page, package/city manifests, attribution, main viewer, outer models, required sites, surrounding-city decoder and progressive worker. All matched. The three withdrawn Columbiahalle recordings remain HTTP 404. Both previous live asset graphs are retained; no hosted source override or geometry omission is used.
