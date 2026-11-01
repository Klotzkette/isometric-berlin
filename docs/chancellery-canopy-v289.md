# Step 10 — open Ehrenhof entrance canopy (v289)

The owner's 1 November correction concerns the frontal Chancellery entrance
between the two office wings. The side vehicle entrance is outside this change.
The supplied photographs, especially images 2, 5, 6 and 7 in the 31 October
Chancellery series, show a thin pale tensile roof with upturned ends, slender
supports and an open approach to the glazed entrance. Their existing evidence
record is [chancellery-photo-v287-evidence.json](../geo_data/regierungsviertel/chancellery-photo-v287-evidence.json).
No photographic pixels or textures are delivered.

## Identified defect and retained source

The visible solid box was the retained LoD2 prism `K0003Umc`, full source ID
`DEBE01YYK0003Umc`. Its 46-point curved footprint was extruded from the ground
to the maximum canopy height, closing the space below the real roof. The
earlier authored rectangular saddle roof did not remove that opaque extrusion.

The original CityGML contains two roof surfaces with 126 points including their
two repeated closing points (124 ring entries after removing the closing duplicates) for this
canopy. The correction uses their actual three-dimensional roof vertices and
complete contours. A single rigid height translation aligns the source ground
datum of 33.951 m NHN to the existing viewer ground of 5.1 m. The translation
is −28.851 m; the original absolute source coordinates remain evidence. The
thin membrane section and small support sections are display estimates.

The small rear vestibule is a separate source owner, `1rlNcfOH`, full source
ID `DEBE3Djn1rlNcfOH`. It retains its own footprint and two original roof
surfaces. Applying the same site datum places its roof below the canopy. The
older independent extrusion incorrectly added the whole basement-inclusive
height to courtyard level. The corrected entrance uses translucent glazing.

All original scene, prism, voxel and surface payloads remain unchanged. The
bounded ownership record retains the preceding owners, roof evidence and
neighbour identities. New or changed overlapping owners must keep the old
fallback rather than silently yielding to the replacement.

## Both presentations and walking

The drawn replacement uses the original triangulated roof sheets, a thin
underside, complete edge courses and slender supports. Its admitted complete
replacement also supersedes the precisely identified earlier authored lower
canopy and its two masts, avoiding overlapping roofs.

The native family builds its own cardinal roof courses and supports. Exact
exclusive old voxel columns may yield; the shared rear cell belonging partly
to the leadership building remains. Walking collision follows the thin roof
and its underside, supports and retained vestibule, keeping the forecourt
below the canopy open. Fifteen exclusive preceding native columns yield;
the mixed leadership/vestibule cell is retained. The independent roof family
uses 512 instances and one draw call.

The high monumental roof, side wings, green climbing cover, court paving,
lawns, fence, Chillida sculpture, true flags, surrounding trees and all other
city details remain. There is no new geographic coverage, tour stop, texture,
animation or residency-limit increase. Drawn touch mode keeps full geometry.

The separate Reichstag correction is documented in
[reichstag-photo-v285.md](reichstag-photo-v285.md): only the two batches of
detached dark basement windows and frames yield; the genuine flags remain.

## Source replay and checks

The retained archive `LoD2_389_5820.zip` has SHA-256
`dcbbcf6837ec0b767bdabba8ad03e4d1384de3b506982b1d97c23405f0022068`.
Its XML `LoD2_33_389_5820_1_BE.xml` has SHA-256
`7bfb0aaf384244ae7f069af48e5dd072208e5446e11b61c65af183c314b5717e`.
The original canopy and door wall sheets remain in this archive. The bounded
extractor and Python replay test verify the delivered source evidence.

Seventy-two focused frontend tests passed across fourteen suites (84,177
assertions), including exact owner rejection, full/mobile cooperative native
construction, all six navigation modes, preceding facade details and genuine
flag inventory. The legacy roof guard also accepts normal lighting, ink colour
and anti-flicker fading in all five drawn modes while rejecting changed source
geometry, fittings and materials. Ruff and formatting checks pass.

A broad Python run passed 135 tests before an unrelated historical v239
city-front generator replay was interrupted after nearly twelve minutes.
The focused source and package/release tests are checked independently; this
does not claim a completed full Python suite.

The v1.0.188 production build passed TypeScript and Vite. All 102 focused
Python source/package/release tests passed on the final tree, including the
fresh canonical-package case. ZIP and TAR inventories, manifest integrity,
HTTP launch and normal production startup were verified. Four original
runtime source payloads retain their exact pre-change bytes.

The complete package contains 4,754 files / 936,374,285 bytes, within the fixed
893 MiB limit (4,083 bytes spare). Its manifest SHA-256 is
`41fe591623fdcd7e51491c4efbdccf2247dbe4030628b589f53c7bec8713cc5f`.
The exact current-plus-v186/v187 Pages plan retains 332 protected prior assets;
only nine source-proven v185-exclusive assets yield. Runtime/release caps were
not changed.

Published as v1.0.188 after the exact Pages deployment, public HTTP and browser
checks passed. [Publication receipts](release-v1.0.188-review.md).
