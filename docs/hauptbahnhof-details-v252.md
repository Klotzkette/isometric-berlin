# Hauptbahnhof streets and suggested platform descents — Step 10, v252

The existing Hauptbahnhof model keeps its complete hall, roof, four panoramic
lifts, five levels, tracks, platforms, source buildings and navigation.
The refinement adds readable tread surfaces to existing descents, source-tagged
street paint and small joints on the already rendered kerbstones. It does not
introduce new road surfaces, zebra crossings or city coverage.

## Evidence and limits

The [DB station plan](https://www.bahnhof.de/downloads/station-plans/1071.pdf),
checked 20 October 2026, confirms the five-level organisation, public
Europaplatz/Washingtonplatz exits and vertical connections. The
[DB station page](https://www.bahnhof.de/berlin-hauptbahnhof) also identifies
stairs, escalators and lifts as access to the first upper floor. These references
establish the type and level arrangement, not surveyed dimensions or individual
tread positions. No plan or photograph is bundled.

The twelve retained OSM road owners in
`geo_data/regierungsviertel/hbf-details-v252-source.json` come from the existing
29 September 2026 Berlin source, ODbL 1.0. Their complete projected courses and
tags remain in the evidence:

- Invalidenstraße: `291695261`, `39350083`, `318015898`, `67713448`,
  `48859724`, `291695260`, `39487919`, `4395577`.
- Rahel-Hirsch-Straße: `44427656`, `4592633`.
- Clara-Jaschke-Straße: `305801705`, `4395253`.

Positive cycle-lane tags control the added lane boundaries; `turn:lanes`
controls arrow direction only on one-way owners with matching lane counts.
Mapped pedestrian/cycle approaches interrupt the additions. Existing lane lines
remain. Ella-Trebe-Straße's explicit `lane_markings=no` sections receive no
invented centre markings. Unmeasured road widths retain the established renderer
policy; paint width, spacing and arrow placement are display estimates.

The 54 short kerb courses use the exact retained district-kerb polylines along
the asphalt perimeter. Drawn rendering adds sparse stone joints above the existing
22 cm kerb top, with no duplicate coplanar top. Native rendering uses independent
orthogonal small blocks along those courses. The source surface file is pinned
by SHA-256, as is the district-street payload; no original road, path or ground
payload is edited. This avoids independently rounded perimeter points leaving
unsupported joints beside the existing kerb.

## Exact authored correction

Only four previously unsupported deep escalator endpoints change. Their former
absolute local endpoints were `[5.2, -5.4, 76]` and
`[9.5, -14.53, 93.347]`, mirrored across both hall axes. The first misses the
existing lower bridge at z 68.4–73.6; the second overshoots the island's z 84 end.

The new endpoints are `[5.2, -5.15, 72.8]` and `[9.5, -14.055, 81.8]`.
Both use the actual retained slab tops. The whole lower comb plate now ends at
z 83.9, within the island. `hbfFlightEndpointsV252` applies the correction only
when all six original endpoint coordinates match; changed upstream flights pass
through unchanged. The machine-readable receipt is in the source file.

All twelve flights gain horizontal tread caps within their existing ridge
batches, preserving inclined bands, glass sides and handrails. Small tread
dimensions are illustrative. This improves the view of the descent; it does
not add a new stair walking simulation. Existing navigation owns the retained
landings, and regression tests confirm both corrected endpoint floor heights.
Schwellenraum's independent circulation remains unchanged.

The native hall retains its intact existing concourse. Forty shallow block
strokes form schematic stair cues on that actual floor; they do not pretend to
be new holes or hidden underground stairs.

## Existing atrium opening and exact ground receipt

Production ray inspection found that the unrelated coarse `Drawn ground slabs`
closed the already modelled daylight slot. The gallery-to-platform ray from
station-local `[0,7,-68]` to `[9.5,-14.055,-81.8]` hit source instance 68954,
triangle 4, at world `[-144.093787275,5.200000048,-751.383340055]`, before reaching
the actual lower stairs. This was an opaque raster intrusion, not a camera
transform error.

`hbf-atrium-v252-receipt.json` records the exact existing opening: local
`|x|<9.5`, `20<|z|<82`, excluding the retained ground-level bridges at
`|z|=49.5±2.6` and service-pavilion landing `|x|≤4.8,z=37±7.1`. These are the
existing model's display dimensions. No new source survey or larger opening is
claimed. The original ground payload and northern railway table remain
SHA-pinned and unchanged.

The drawn branch reuses the existing Hbf terrain-complement call. Its combined
table retains every old north-cut numeric record byte-for-byte and adds only
201 atrium cells: 2,022.08 m² of false intrusion is removed, while all 1,193.92 m²
of outside fragments of those same cells retain their original height, depth
and paint. The existing foyer, gallery slabs, bridges, track beds and platform
surfaces remain. Native still uses the original table and intact hall.

Walking already resolves the real lower station levels in this void, including
the deep floor at world y −10.425, instead of the general terrain. Existing
guards remain solid, and gallery, bridge, foyer and platform floor samples are
unchanged. Regressions check these semantics, including a mode switch/spawn over
the void; no new stair movement simulation or navigation override is introduced.

## Lifetime and validation

Street members append to the existing `HbfNorthApproach` instance batch.
The station keeps its twelve ridge batches, and native cues append to its
existing block batch. No new material, texture, streaming descriptor, frame
loop, tour stop or live budget is introduced. Drawn touch and desktop use the
same full geometry.

Measured street additions: 667 drawn instances / 50,692 matrix-and-colour bytes;
5,036 native instances / 382,736 bytes. The complete north-approach groups remain
two drawn renderables / 334,364 bytes and one native renderable / 2,749,492 bytes,
below their existing 5 MB limit. Station treads add 312 caps, with a net
288 instances / 18,432 matrix bytes after the four corrected short flights.
Native station cues add 40 instances / 3,040 matrix-and-colour bytes, bringing
that unchanged batch to 2,747 blocks.

The 28,431-byte runtime supplement contains 54 curb courses and 31 paint strokes.
The combined drawn terrain table is 122,416 bytes (28,975 bytes larger than the
unchanged 93,441-byte north-cut table). The existing terrain-complement material
pair is reused. On the retained source slab fixture, the exact split adds 37
plain run instances and 5,352 unindexed complement vertices, 195,484 bytes before
the existing lossless geometry compaction/upload retirement, with one additional
occupied spatial tile. No live limit changes.

The focused tests verify horizontal tread orientation, exact correction guards,
complete landing support, native floor/orthogonality, source hashes, positive
marking evidence, retained kerb courses and the unobstructed identified sight
ray. Every retained atrium-cell complement is checked against the exact
polygon difference to Float32 precision. Existing Hbf tests cover all five
levels, entrance routes in all modes, roof/track alignment, lifts and rail-cut
ground ownership. Release browser review is recorded by the integration task.

To regenerate this small supplement:
`uv run python -m scripts.build_hbf_details_v252` and
`uv run python -m scripts.build_hbf_atrium_v252`.

For visual review, retain the station anchor `[-119.936, 4.575, -683.307]` and
rotation 21.82°. The upper flight is visible from local `[0,7,-48]` toward
`[5.2,2,-39]`, 70° FOV (world eye
`[-137.7772119494,11.575,-727.8680946474]`, target
`[-129.6045327888,6.575,-721.4456873622]`).
The production-verified lower-flight close view uses local `[0,2.4,-80]`
toward `[7,-10,-78]`, 65° FOV (world eye
`[-149.67135324907,6.975,-757.57549107901]`, target
`[-142.42947644843,-5.425,-758.32062221133]`). This sees the staircase, lower
comb plate and existing island through the cleared opening. A production ray
now reaches the tread at world `[-141.832544,-7.702447,-761.397911]` before any
opaque ground. Chrome reports no page error, context loss or WebGL error.
The northern street junction is around world `[-160, 5, -820]`; the west/south
street sequence around `[-250, 5, -580]`.

Final focused validation: 82 TypeScript tests across 14 Hbf/native test files,
12 Python source/ground tests, TypeScript build and focused Ruff checks pass.
