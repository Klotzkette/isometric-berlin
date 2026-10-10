# Volksbühne complete body and Orankesee, v1.0.109

Pipeline step 10 corrects the bounded theatre body and adds mapped lakeside
recognition inside previously approved coverage. No residency budget, mobile
quality setting, tour stop, original packet or unrelated source owner changes.

## Theatre evidence and ownership

`VolksbuehneV189.ts` contains only the facade and Räuberrad. Its building body
belongs to streamed tile `5_-2`, part `mitte-street-fronts-v166`. The existing
LoD2 owner `DEBE01YYK00001YG` has 75 original sheets and a uniform top of
56.430 m NHN, or viewer y=23.564 at the original ground datum y=3. That uniform
roof omits the real auditorium and high stage masses.

The bounded current [Berlin bDOM service](https://gdi.berlin.de/services/wms/bdom?service=WMS&request=GetCapabilities)
provides measured image-derived surface elevations. Its [official description](https://gdi.berlin.de/data/bdom/docs/dom.pdf)
identifies a one-metre raster derived from 2025 imagery, under dl-de/zero-2-0.
The retained 220 samples in `volksbuehne-v209-bdom-samples.json` were queried on
10 October 2026 using one-pixel, one-metre EPSG:25833 `GetFeatureInfo` requests
to layer `b_bdom`, on a bounded 4 m inspection grid inside this owner. No full
20 MB raster archive was downloaded. Each row preserves the local inspection
coordinate, projected coordinate and returned NHN height.

Interior sample medians independently establish the missing volumes:

| Body | Median roof NHN | Viewer top | Interior samples |
|---|---:|---:|---:|
| Stage tower | 75.120 m | 42.254 m | 20 |
| Auditorium | 61.755 m | 28.889 m | 36 |

The inspected [Berlin DOP2025 spring orthophoto](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
shows the rounded auditorium, higher rectangular stage tower and rear pitched
roof. Its exact request bounds, layer and image digest are retained in the
source receipt. Roof partition outlines are independently interpreted from that
orthophoto and the sampled height breaks, clipped inside the exact LoD2 owner;
they are not claimed to be newly surveyed LoD2 polygons. The rear ridge uses
its retained central bDOM transect (viewer y=33.019); interpolation between
ridge and eaves is a display interpretation. Raster medians intentionally
represent roof bodies, not small ventilation objects or image-matching noise.
No newly obtained Commons photograph was used. Existing individually credited
v189 photographs remain the unchanged facade/sculpture references.

`createVolksbuehneEnvelopeV209(native=false)` is **required city construction**.
It carries every original sheet, including the ground sheets, both little rear
holes, and the measured upper additions. The independent Minecraft body keeps
the exact original block-native v166 owner including its native window colours,
then adds orthogonal upper surface blocks. Original v168 facade fittings and the
entire v189 facade/wheel model remain intact and load once through their existing
paths. The original coarse side heights are retained; this is an additive upper
body correction, not a silent claim that the old flat LoD2 roof was accurate.

`volksbuehneOwnershipV209.json` records exact position-plus-colour triangle
multiset matches against the immutable v1.0.108 packet bytes, verified against
the release Git tag. Drawn replacement transfers 221 source-wall/roof triangles;
Minecraft transfers 13,056 original orthogonal owner triangles. The record binds
the tile, part kind, mode, owner ID, original SHA-256 and FNV-1a of the three
packed strings. Runtime gates must reject a changed fingerprint and may touch
only those listed triangles. Old packet files remain byte-identical. Retain old
line ink: all original lower sheets still exist and the added solid masses
occlude the covered roof lines. This avoids an unrelated or broad line filter.

`volksbuehneV209SolidAt(x,y,z,radius=0)` supplements existing lower-owner
navigation with only the three new upper solids. Its 2,029-byte generated
navigation recipe copies the exact auditorium/stage polygon rings and source
heights. The rear roof uses the actual narrowing horizontal gable section at
each query height; its entire footprint is not raised to the ridge. Horizontal
radius checks use distances to polygon edges and gable-section corners, and
both rear courts remain free. This adds no draw call or GPU buffer and changes
no source height, lower-owner collision or surrounding navigation.

## Exact Orankesee context

The retained 29 September 2026 OSM extract (ODbL-1.0) supplies water
`way/4788724`, Strandbad `relation/3099999`, sand `way/10354648` and all 99
selected source features. The complete 82-point coast is retained. Runtime
line fittings are clipped to the exact lake's 40 m context unioned with the
mapped lido; complete uncut source geometry is kept separately in evidence.
The official [lake account](https://www.berlin.de/tourismus/seen/4361773-4299185-orankesee.html)
identifies the lakeside walking route; the [LAGeSo profile](https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/badegewaesserprofile/artikel.339144.php)
places the operated lido on the northeastern shore. The
[strandbad operator](https://strandbad-orankesee.de/) is the primary site reference.

The optional `createVolksbuehneOrankeseeV209(native=false)` layer adds no water,
ordinary building, tree population or second filled path network. It adds thin
source-coast articulation, path margins, exact mapped sand excluding lake water,
source fence traces and public furniture: 20 benches, 14 bins, two information
boards, three bicycle-parking anchors, one life-ring anchor and two mapped
water-slide courses. Clipping produces 46 path portions and 22 fence portions.
Bench/bin/fence dimensions, untagged path width, slide elevation and surface
lifts are explicit display estimates. Both mode families use the same full
source feature list on touch and pointer devices.

### Existing presentation margin covering the lake

Integrated Chrome inspection exposed a retained presentation defect: the
western lake appeared as pale paper in drawn modes and checkered grass in
Minecraft. All three existing `east200` water packets already contain the
complete lake; this was not missing water or a streaming quota. The obsolete
eastern extrapolated band ends at x=6840+790=7630, exactly the visible diagonal
after camera projection. Its drawn top is y=1.8, its native top y=2.1, both
above the unchanged lake water datum y=-1.15.

`cutOrankeseePresentationV209(root,native)` runs on the complete provisional
world inside the required-site transaction, before publication. The generated
`orankeseeMarginV209.json` uses the full 82-point source polygon to subtract
only 25,883.142393 m² of this artificial band. It validates three exact source
triangles and their colours, or nine exact native instance matrices and
colours, before any mutation. All remaining fragments outside the lake survive;
no new water, shoreline bank wall or ground elevation is invented. Changed
receipts abort safely. The old water packets remain byte-identical, with all
six drawn/native packet hashes retained in the recipe.

The drawn cut adds 46 triangles / 4,968 GPU bytes without another draw call.
The native cut retains the unaffected instances and adds one 212-triangle
fragment mesh / 22,896 GPU bytes, with the original grass colours and native
material lighting. The source recipe occupies 40,353 JSON bytes. Native
world-space Float32 fragments can differ from the original instance arithmetic
by one sub-micrometre rounding step; source heights are unchanged.

Three focused Bun tests execute the actual small margin constructors without
building the full city, then raycast against the real retained water packets.
They verify the original obstruction, corrected water visibility in both
families, retained outside heights/materials, idempotence, and atomic rejection
of altered source receipts. Two Python tests verify exact source-area
subtraction, deterministic rebuild and unchanged water hashes. These tests,
isolated strict TypeScript compilation and Ruff pass; final integrated browser
inspection remains the release integrator's check.

## Geometry and verification

| Runtime family | Calls | Exact buffer bytes | Instances |
|---|---:|---:|---:|
| Theatre drawn | 1 | 15,018 | 0 |
| Theatre native | 1 | 489,720 | 0 (indexed block faces) |
| Orankesee drawn | 2 | 95,880 | 1,182 |
| Orankesee native | 2 | 615,112 | 8,014 |

All meshes are static, texture-free and frustum-cullable. Drawn source body has
415 triangles; the native body has 17,984 orthogonal triangles. The required
payload is 636,146 bytes of JSON; ownership receipt 80,122 bytes and lake payload
90,934 bytes. These additions do not alter the city residency limits.

Theatre drawn bounds are x=2729.524–2803.067, y=3–42.254,
z=-895.611–-801.960. Native exact original surface-cell bounds are
x=2728–2804, y=1–43, z=-896–-800. Lakeside additions span approximately
x=7404.194–7840.406, y=3–6.237, z=-3347.339–-2991.882.

Focused checks passed:

- Seven Python tests: all original source vertices/sheets and rear holes,
  bDOM height derivation, immutable exact ownership gates, deterministic owner
  rebuild, complete lake coast and sand/water separation, unchanged v189 source.
- Seven Bun tests: independent stage/auditorium ray hits before optional detail,
  open rear courts, entirely orthogonal native triangles, bounded image-free
  storage, same full detail and unchanged six-aperture Räuberrad.
- Ruff format/check on the two added Python files.
- Five additional focused navigation tests pass for agreement with rendered
  roof ray hits, open courts and surroundings, slope-dependent heights, exact
  circular radius at corners and rejection of non-finite input. The generated
  navigation recipe is also checked for deterministic source derivation.
  Isolated strict TypeScript compilation of the navigation module passes.

Useful scene review poses (world metres):

| View | Camera position | Target |
|---|---|---|
| Theatre front oblique | `[2658,89,-700]` | `[2768,15,-848]` |
| Theatre rear stage | `[2862,85,-955]` | `[2768,22,-848]` |
| Orankesee / lido | `[7853.18,210,-2865.15]` | `[7593.18,3,-3165.15]` |

A full viewer build and final integrated camera inspection belong to release
integration; this focused source change does not claim those checks itself.
