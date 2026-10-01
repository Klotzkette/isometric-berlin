# v1.0.57 — ULAP and the Moabit prison memorial park

Pipeline step 10. This bounded refinement covers ULAP south of the railway,
retained quarter buildings north of it, and the nearby Geschichtspark Ehemaliges
Zellengefängnis Moabit. The 93-stop catalogue and world bounds remain unchanged.

## Model changes and evidence

The [ULAP source audit](ulap-v157-sources.md) records the exact park boundary,
31 mapped bench positions, five stair flights and their connecting footways.
The recognition layer adds weathered stone treads, the lower gravel grove,
backless timber light benches and two explicitly mapped concrete benches.
All existing source trees and paths remain. The existing coarse height data
conflict with the published four-metre park/street difference, so the stairs
follow the delivered surface; a fully surveyed historic vertical grade is not
claimed. Widths, subdivisions, furniture orientation and dimensions are
labelled display estimates.

The northern quarter keeps its current source envelopes. The former Urania
hall receives its curved blind brick facade and pale coping. Adjacent current
police/office and retail envelopes receive restrained facade rhythms. These
are source-bound material/recognition interpretations, not measured inventories
of individual windows. Planned future blocks are not added. The older
Landeslabor envelope remains retained evidence with its demolition conflict
recorded; it receives no new refinement.

The [Moabit park refinement](moabit-park-v157.md) preserves all 19 source wall
segments and corrects two real access openings previously blocked by a
continuous wall: Invalidenstraße and Minna-Cauer-Straße. Rendering and walking
collision share the openings. The two retained closed gate envelopes
`pF0000BI`/`pF0000BJ` are replaced only in display/collision by the open frame;
the original records remain. The court clears the existing source lawn. Hornbeam cell divisions, the source circular
court, concrete portals, fine brickwork and inward whitewash make the present
park legible without reconstructing the demolished prison.

The [three surviving officers’ houses](moabit-guard-houses-v157.md),
Lehrter Straße 5B–5D, retain all five source parts. They now have brick faces,
external windows, attic corbels and the intentionally blank park-facing walls.
The 5D hipped-roof interpretation uses both distant and refined drawn paths.
Minecraft uses separate surface shells with exact footprint ownership.
Memorial materials remain protected in Schwellenraum.

## Preservation and resources

The raw prism, voxel, park, ground, railway, street, surface, scene, catalogue
and boundary files are byte-identical to v1.0.56. Existing geometry outside
this requested scope remains under frozen preservation tests. Prior fixtures
remain present; new v157 overrides cover only the intentional Moabit changes.
Eight licensed external image references are added to both matching attribution
manifests. No image, protected plan or runtime texture is added.

Full static drawn detail is shared by touch and desktop. New repeated details
use compact instance batches. The v1.0.56 camera-local GPU prewarming,
cooperative park construction, cancellation and resource disposal are retained.
No global resolution, viewing-distance or geometry-quality reduction is made.

## Validation

- TypeScript and production build passed. The existing large-chunk advisory remains.
- Ruff formatting/lint passed; all 501 Python tests passed.
- 102 Moabit/source-replacement and frozen static-preservation checks passed.
- 13 ULAP/quarter/house checks passed, including complete source ownership,
  trunk openings, native geometry, full detail and reversible light switching.
- 38 mobile GPU/park lifecycle/construction checks passed; the isometric-world
  and publication suites passed their 78 checks after accounting for facade
  ownership moved into the new complete ULAP models.
- All four complete native-world construction checks passed. Synchronous and
  cooperative buffers match: 321,143,882 bytes full and 111,957,082 bytes mobile.
- Production Chrome completed 36 initial mode/view checks, five additional
  quarter views, and 12 final gate/court checks across all five modes after
  source-envelope replacement. No runtime errors or WebGL context loss.
  Screenshots confirm open portals, visible court, brick house facades and
  the curved windowless Urania hall.
- WebKit with the iPhone 13 profile passed cold startup plus a 45-second hold
  and the two distant ULAP/Moabit views. An abrupt third camera jump to the
  close Moabit garden lost its WebGL context. The same sequence against the
  published v1.0.56 reproduced the same loss at the same view; both versions
  automatically rebuilt the viewer and were ready ten seconds later without
  a page reload. This is an existing mobile-engine limitation, not a passed
  all-mode stability test. The new model batches were separately checked for
  finite transforms, valid indices/capacities and valid bounds. No speculative
  global quality reduction was made to hide the failure.
- The separate normal mobile workflow passed in both WebKit/iPhone SE and
  Chrome/Pixel 5 emulation:
  cold load, menu, joystick movement and Day → Night → Snowstorm → Schwellenraum
  → Minecraft → Day, with no page errors, console errors or context losses.
- Final package readiness and extracted local-server smoke checks passed.
- Pages staging retains all 1,393 previously published files and matches all
  63 current build files byte-for-byte; old hashed modules remain available.

New drawn geometry totals 105,608 bytes for the ULAP park (four draws),
339,000 bytes for its quarter facades (one draw), and 186,012 bytes for the
three officers’ houses (one draw). The park memorial stays at five draws and
364,110 bytes, including its finer wall and planting detail. These figures
measure stored buffers, not total browser memory.

Browser emulation cannot guarantee memory behaviour on every physical iPhone.
The release keeps the existing mobile safeguards, but does not claim that
every camera jump is free of graphics-context loss.

Release archive checksums:

- `isometric-berlin-regierungsviertel-local.zip`: 35,824,507 bytes; SHA-256
  `ace78f399ee05c30c744fcc1af519de4346d7ac23a10557903cea8f3ba1ad511`.
- `isometric-berlin-viewer-v1.0.57.tar.gz`: 35,695,871 bytes; SHA-256
  `64bc3e8260334126a2025f969d22aa04e4cc25904cb75d9e95546abbbac68f57`.
