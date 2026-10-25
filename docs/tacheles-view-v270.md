# Tacheles photographic view v270 / release 1.0.170

Step10 refines the finite photographed Oranienburger Straße / Auguststraße
ensemble. The ten owner-supplied photographs are reference evidence. They are
not bundled or turned into raster textures. Dimensions of small facade fittings
remain documented estimates; this is a source-supported procedural model,
not a photogrammetric reconstruction.

## Visible changes

* Five distinct front owners: Oranienburger Straße45,46–47,48–49,50 and the
  rounded red corner at Auguststraße. Their23 complete LoD2 parts and267
  original wall/roof sheets replace five exact15m fallback bodies. The red
  corner gains the photographed stepped glass floors; historic fronts gain
  separate masonry, window-head, bay, cornice and parapet treatment.
* Auguststraße92: the complete measured gable above the former flat cap and
  a stylized geometric interpretation of Benzi Brofman's **Bring Them Home NOW**
  mural. The existing building remains. Detailed placement and source evidence
  are in [mural notes](auguststrasse-mural-v270.md).
* Golgathakirche: the near red spire in photos5/6 now has the evidenced steep
  helm, four pinnacles, clock gables and paired belfry openings. Lower masonry
  receives the evidenced brick tone. Zionskirche, Sophienkirche and Neue
  Synagoge keep their existing complete models and distinct sight axes.
  [Church evidence and limits](golgatha-v270.md).
* Six retained tram courses on Oranienburger Straße gain actual rail heads at
  the source-tagged1435mm gauge. Every original course point remains; existing
  road surfaces, curbs, marks, contact wires and masts remain. The75mm head
  width is a display estimate, not an engineering survey.

The facade owners, complete source archive and exact old-detail transfer
receipts are documented in [front notes](tacheles-fronts-v270.md). There is no
area-wide removal or new district coverage. Altered or missing old source
fingerprints keep their original geometry. Corrected roots finish in the same
unpublished city transaction before ownership passes to them.

## Runtime and navigation

All additions have independent drawn and world-cardinal native geometry and
retain the same full static detail on mobile. Construction-only JSON fields
use the existing lossless weak decoding mechanism. Separate small roof and
collision profiles remain strongly owned; scene roots retain typed geometry,
not encoded construction payloads. No texture, animation, light, timer, video
or second city-rendering loop is added. Existing residency/decode/GPU limits,
stream cancellation, 93-place tour and initial fly mode remain unchanged.

New roofs and raised facade fittings use their real model solids in walking
navigation, gated dynamically to the current visual mode. Roads and courtyard
voids remain open. The mural roof is additive; its original body stays.

## Verification

Visual inspection uses only the app's internal browser, one temporary tab,
with the actual production factories and adjacent source/core/stream packets.
A bounded local-only terrain crop allows comparison without loading the entire
city into a second viewer. No QA harness or cropped source is shipped.

Reproducible geometry, original-sheet preservation, exact packet transfer,
native cardinal construction, disposal and actual walking/roof checks are
covered by focused Python/Bun tests.

## Lossless delivery encoding

The current package and the exact two preceding live asset closures initially
exceeded the unchanged 1 GiB Pages ceiling by 5,203,831 bytes. A finite audited
list of 432 already-eager fields in 234 sources now uses per-field gzip encoding.
These fields remain eager, strongly owned ordinary data properties, with identical
named-export identity and independently removable pure initializers. Existing
lazy/weak fields retain their previous lifetime and accessors. The startup
landmark catalogue is explicitly excluded so that its decoder cannot import
Three.js into the initial graph. No geometry, numeric value, source vertex,
runtime residency limit or previous-live asset is removed.

The exact list and pre-encoding measurements are in
[lossless-eager-v270-audit.json](lossless-eager-v270-audit.json). Source-level
round trips cover every transformed committed JSON payload, while focused
tests cover descriptors, field replacement, aliases, default imports and
tree shaking. Independent review compared every opt-in with its previous
transformation and found no lazy/weak-to-eager ownership change.

The final complete uncompressed package is 926,563,613 bytes. With all 326
assets in the two previous live closures retained, the prospective deployment
is 1,071,207,966 bytes (2,533,858 bytes below 1 GiB). These are complete-asset
counts, not network-compression estimates.

## Validation record

* Full Python run: 1,921 passed, 4 skipped, 6 failed during concurrent generation
  and the version/build change. Failures were stale in-process model/version
  expectations and the previous built release. The final 23 focused geometry
  and smoke tests and all 80 release-readiness checks passed after generation
  and packaging completed; no unresolved failure remains from that run.
* Geometry/navigation Bun checks: 18 passed, 372,230 assertions. Existing
  lifecycle, source-cache, stream and cancellation regressions: 137 passed,
  568,334 assertions across 16 files.
* Final lossless-delivery checks: 34 passed, 6,152 assertions across seven
  files, including complete committed-payload round trips and the explicit
  startup-graph exclusion.
* TypeScript and the production build passed, including the unchanged startup
  and worker budgets. Ruff formatting and lint passed (855 Python files
  unchanged by formatting), as did the final whitespace/diff check.
* Internal-browser inspection covers the drawn fronts, red corner, mural and
  tower plus the world-cardinal mural with actual adjacent source geometry.
  The temporary QA tab/server and local-only harness are closed/removed.
