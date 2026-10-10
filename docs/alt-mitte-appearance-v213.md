# Old-Mitte source-surface appearance — v1.0.113

Step 10 addresses ordinary buildings inside the unchanged old-Mitte selection,
excluding Wedding and Tiergarten. The retained official LoD2 geometry already
contains roof slopes, setbacks, wings and courts. Many of those shapes were
visually flattened by generic inherited paint: wall and roof shared almost the
same pale colour. The recent city-wide palette pass did not reach this separate
measured-building layer.

## Evidence and limits

The frozen [source catalogue](alt-mitte-v169-sources.md) and
[whole-catalogue review](alt-mitte-v186-audit.md) remain the source basis. Berlin
LoD2 supplies measured geometry (dl-de/zero-2-0); retained OpenStreetMap supplies
mapped colour/material context (ODbL-1.0). An overlap context is not automatically
a building identity. The new pass requires a strong, documented spatial match
before transferring its material evidence.

The catalogue contains no survey of every ordinary house's windows, cornices or
current paint. Existing source-clipped window rhythms remain documented display
estimates. This release must not be described as an individually photographed or
fully verified reconstruction of every facade. No random per-house palette,
invented historical ornament, photographic texture or additional source download
is introduced.

## Preservation contract

Appearance receipts refer to exact immutable packet meshes. Original source
packets, positions, indices, ink, navigation and later ownership-transfer
fingerprints stay intact. Only existing decoded colour cells are eligible for
changes. Ambiguous ownership or surface roles retain their previous appearance;
individually authored buildings are protected. Native Minecraft uses its own
source association and preserves block geometry.

The implementation adds no GPU attributes, buffers, draw calls or per-frame
appearance work. It retains the existing cooperative build, cancellation and
residency limits. Mode-specific receipt counts, source exclusions and validation
results are recorded with the generated evidence and release review.

## Complete compiled result

All 15,914 catalogue records are inspected; these are source records, not a count
of occupied houses. The pass considers the 8,374 measured generic families and
protects later authored owners, mapped glass and ambiguous associations. It does
not overwrite the separately retained authored/glass/overlap families or the OSM
residual representations. Of 8,286 eligible measured families, 8,255 receive an
actual colour correction in the drawn modes; 1,953 receive an unambiguous native
correction. Ineligible or ambiguous surfaces remain intact.

| Compiled correction | Drawn modes | Native Minecraft |
| --- | ---: | ---: |
| Existing wall triangles receiving changes | 182,808 | 26,713 |
| Existing roof triangles receiving changes | 128,263 | 228,666 |
| Existing colour-buffer vertices changed | 436,681 | 213,756 |

The complete catalogue scan finds 2,854 eligible families with at least 95%
reciprocal actual footprint coverage against the retained OSM context. Only 63
have usable wall colour/material evidence and 157 usable roof evidence under
that strict association. The remaining changes improve source-form legibility,
not knowledge of the current paint. The 2,368 validated storey tags are recorded
as evidence but **do not alter or certify window positions** in this release.

Source-plane matching requires the original colour, centimetre-level plane
agreement and containment of the whole triangle in the complete wall/roof
polygon, including its holes. Offset window quads are excluded. Native matching
uses the existing two-metre surface-block envelope and original role colours;
protected neighbouring envelopes explicitly block attribution to another house.
Different native roles with identical old paint remain ambiguous.

All incident triangles must agree before a shared vertex changes. A rejected
vertex keeps its entire connected face network unchanged, avoiding old-colour
ridge gradients or partial facade patches. Roof networks use a consistent roof
tone; this release does not claim independent flat shading on every roof slope.
Wall light follows the measured plane orientation. Untagged neutral roof colour
is a documented graphic separation, not an assertion that every roof is slate.

The sparse receipts contain 1,690,375 bytes (441,420 bytes when gzipped), with
1,566 linear RGB palette entries. Base64-encoded integer runs avoid a retained
district-sized JavaScript number-array graph. Validation and application decode
at most 48 KiB of run bytes at a time; encoded source fingerprints and painting
yield cooperatively. Original packet fingerprints continue to guard the later
site-owner transfers.

The complete extracted local package measures 874,993,964 bytes (834.459 MiB).
The finite archive-only ceiling is 835 MiB, allowing the added receipts while
retaining every earlier asset. This changes no live geometry, packet, GPU or
mobile residency limit.

## Reproduce and review

```sh
uv run python scripts/build_alt_mitte_protection_v213.py
uv run python scripts/build_alt_mitte_appearance_v213.py
uv run pytest tests/test_alt_mitte_appearance_v213.py tests/test_alt_mitte_protection_v213.py
cd src/app && bun test tests/alt-mitte-appearance-v213.test.ts
```

The compiler uses the retained bounded OSM candidate GeoPackage only for strict
identity validation. It never reruns the historical v169 generator or rewrites
its packets. Full source associations, exclusions, actual changed-owner lists,
source hashes and packet hashes are in
`geo_data/regierungsviertel/alt-mitte-appearance-v213-evidence.json.gz`.

## Validation

- Production TypeScript/Vite build, full Ruff formatting/lint and release
  readiness pass.
- Appearance/source-protection tests: nine Python tests pass. They cover strong
  reciprocal association, wall holes, offset window rejection, connected-face
  closure, protected native neighbours, final-only owner counts and all immutable
  packet digests.
- Actual drawn/native core and streamed decoder integration plus prior v169/v186
  coverage: 23 Bun tests pass (785,008 assertions). Coordinates, indices,
  navigation, attributes, storage and synchronous/cooperative output agree.
- Existing loading, colour and obsolete-transfer regression suites: 46 Bun tests
  pass (746 assertions), retaining the v112 background-loading changes.
- The complete Python run finished with 1,268 passed, four skipped and two
  failures: one protection test was collected during its correction, and release
  readiness ran before the new build/archives existed. Both targeted retries pass
  after completion. Six additional appearance tests written after collection
  also pass: 1,276 distinct passed tests across the full run and focused checks.
  The two existing CRS-fixture warnings remain.
- Chrome desktop: 16 completed views across all six modes, zero page errors or
  WebGL context losses, with camera-preserving transitions. All 12 views paired
  against v112 retain identical resident chunk counts, resident geometry bytes
  and visible-renderable counts. The images show roof/wall separation without
  removing prior windows, courts or authored accents.
- Mobile WebKit: 12 completed views across all six modes at Friedrichstraße
  and Linienstraße, zero page errors or WebGL context losses. The harness waits
  for native-world readiness in Minecraft and two seconds of continuous loading
  settlement after each camera move; earlier attempts exposed those two harness
  assumptions, not an application error.

Browser screenshots are QA artifacts under `/tmp/v213-before`,
`/tmp/v213-after` and `/tmp/v213-webkit-stable`; they are not claims of a street-photo
survey. Mobile WebKit uses an emulated iPhone profile, not physical-device RAM or
GPU testing. This change does not assert that a browser can never crash.
