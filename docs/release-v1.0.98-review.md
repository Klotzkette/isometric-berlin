# v1.0.98 — memory overhead and named park refinements

Step 10, continuing the owner's quality-preservation policy. Scope remains finite;
the existing city, all 93 tour stops and all rendering/residency budgets remain.

## Stability

The Alt-Mitte navigation now stores the same 75,029 roof triangles in contiguous
Float64 buffers rather than hundreds of thousands of nested arrays/records.
All 675,261 coordinates are bit-identical; the original source packets are retained.
Root-array JSON literals additionally use the existing lossless codec when smaller.
In the isolated same-pose Chrome comparison, post-GC heap plus backing storage
fell by 25,050,826 bytes. Every scene render buffer, vertex and object was identical.
This measurement excludes this release's new content and is not a total-device
memory figure or a proven reduction in startup peak. See
[the reproducible comparison and recovery check](viewer-stability-v198.md).

A forced WebGL context loss restored the exact camera and target and allowed the
old runtime/scene to be collected. No recovery safeguards were removed. Physical
iPhone process termination was not reproduced, and this release does not claim
that every device can never crash.

## Named additions

- [Tegel and Spandau](tegel-spandau-v198.md): source-aligned red Sechserbrücke,
  its open deck, eight Windrelief accents and cornices at Schloss Tegel, and
  modest source-supported Zitadelle frontage and approach details.
- [Northern parks and Panke](north-parks-v198.md): Schloss Schönhausen and both
  gatehouses from complete official LoD2 sheets; Schlosspark, Schönholzer Heide,
  Soviet cemetery with obelisk/Mother recognition models; mapped recessed Panke,
  paths and finite nearby building context. Natural banks and identified
  retaining walls remain distinct. Measured terrain blends on the new side of
  the earlier display-datum boundary; no old terrain was moved.
- [Treptower Park and Köpenick](east-parks-v198.md): complete mapped park with
  paths, open fields and modest woodland; Soviet memorial mound, 36 treads,
  sixteen source cenotaphs, both banners and open entrance arches; soldier with
  child on anatomical left, sword on right and broken Nazi emblem in its
  historical memorial context. Köpenick gains small source-wall facade accents.

These are bounded isometric recognition refinements, not exhaustive surveyed
sculptural reproductions. Estimated colours, facade rhythm, channel depth and
illustrative woodland are labeled in the source reviews. “Oberschönhausen” was
not silently interpreted as Hohenschönhausen or Oberschöneweide.

## Preservation and ownership

The one correction to earlier geometry is the documented false Tegeler shoreline
strip that crossed the mapped harbour mouth under the bridge. Only 39 drawn and
139 native erroneous bank/ground triangles were excluded. Complete prior Tegel
site arrays are archived with hashes; all old water triangles, source positions,
colours and the other seven v194 sites remain exact. The deterministic v194
builder reapplies that narrowly scoped correction. There is no quality-budget cut.

New factories copy source graphs into typed render buffers and share the existing
one-representation lifetime, spatial culling and disposal. Constructor-only source
fields have an audited weak cache; separate compact navigation metadata remains
strongly owned. A production-bundler test compares every rendered attribute and
material through drawn/native/drawn reconstruction after source collection.

The new named scope is the exact union of requested mapped polygons (1.995 km²),
not a northern-district rectangle. Newly drawn ordinary ground/context is clipped
to the difference from old scopes. Two new free visual-reference image credits
are mirrored in both attribution manifests; photographs are not bundled.

## Validation

- Production TypeScript/Vite build passed.
- Bit-identical roof storage, all-triangle navigation equivalence and original
  published navigation fingerprint passed.
- Complete JSON round-trips and strong/weak/eager/lazy ownership semantics passed.
- 212 navigation/recovery/residency tests passed; source-cache reconstruction and
  targeted new geometry/navigation tests passed.
- Independent integration review found no blocker; disposal and full geometry
  reconstruction across mode families passed.

- Chrome desktop and WebKit touch: all six modes, 28 near/far views each,
  no page errors, WebGL loss or unexpected runtime replacement. Resident source
  identities and complete buffers stayed intact through GPU retirement.
- Seven full-city Day inspection cameras cover Tegel, Spandau, Schönhausen,
  Panke and Schönholzer Heide; all ready/presented with no runtime replacement.
- Release readiness and the packaged local HTTP launch passed. The extracted
  package remains below the unchanged 810 MiB limit.

- Full Python run: 1,066 passed and four skipped. Its two failures read the old
  northern file name while that new artifact was being split for the final edge
  correction. After generation finished, all six northern tests and the scope
  test passed (seven tests), including both failed cases. No failure remains.
- Final build and 14 focused Bun tests passed with 1,165,381 assertions, including
  complete weak-cache reconstruction after the northern data split.
- Final Panke, palace, Schönholz and Treptow camera checks passed after the path
  sides and local display palette correction. No page error or remount occurred.
- Final combined post-GC storage was 782,484,765 B, about 8 MB below v1.0.97 even
  including the added content; the isolated navigation saving remains about 25 MB.

Publication keeps previous hashed assets so already-open pages retain their lazy
modules. Live entry points, assets and release checksums are verified after push.
