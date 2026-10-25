# Auguststraße 92 mural — v270

The supplied Tacheles photographs 3 and 10 show Benzi Brofman's **Bring them home**
mural on the western gable of **Auguststraße 92**, at Oranienburger Straße.
The initially spoken Johannisstraße location is not used. The primary Zentralrat
image caption identifies the artist and Auguststraße/Oranienburger corner; the
Jewish Cultural Days' July 2024 press release identifies the Oranienburger work
as made in late 2023. Jüdische Gemeinde Münster's December 2023 account identifies
the child, teddy bear, interrupted balloon cord and sun. These sources establish
identity and composition; the appearance here follows the user's photographs.

The photographs were received 25 October 2026. Neither reference has an EXIF capture
date, so this is a photographic appearance state, not a claim of a surveyed
October 2026 condition. Neither photograph nor externally sourced image pixels are
bundled, traced or processed into the construction.

## Exact building and preservation

- Original visible core prism: `97856098`, Auguststraße 92, five storeys.
- Complete retained official owner: `DEBE01YYK0000ArM`, including both parts
  `DEBE3DZ0DWuTkJ6V` and `DEBE3DhEjKbIXgGk`, all 31 original source sheets.
- Source: `alt-mitte-v169/source-390_5820-00.json.gz`. The original owner remains
  classified `retain-old-mass-source-conflict`. Its complete source object and
  exact core record are retained again in the small evidence archive, with full
  input file hashes and source-object SHA256
  `43612b27981fcd8b89817f2d5c7a59b4a1eef87832f098c84950b25dd0f9a050`.
- Western wall: `[1288.403,-760.590]` to `[1292.023,-746.563]`.
  The outward normal is approximately`[-.9683,+.2499]`. Source ground is **5.2m**;
  the actual core and original native columns agree. Terrain displacement here
  is zero, checked against the production sampler.
- Core roof is 20.2 m; original native column roof 21.2 m. The missing upper portion
  is published **additively** by clipping every complete measured roof/wall sheet
  at those existing roofs. The evidence records every surface UUID, lower cut and
  resulting triangle. There is no source-building deletion, footprint simplification
  or neighbour retirement. One precisely identified generic flat-roof cornice
  estimate yields to this complete measured gable, as documented below.
- The drawn addition includes all 82 upper triangles, including the smaller rear
  part, with original highest source point 24.354 m, displayed to centimetres.
  The independent native addition evaluates the complete measured roof at 746
  occupied 0.5 m cell centres, with all cardinal risers and roof treads; top 24.5 m.

## Procedural artwork and limitations

117 hand-authored vector shapes produce the dark field, light sky, child, teddy,
balloon, cord, sun, small flag and exact words **BRING THEM HOME NOW**. This is a
stylised interpretation, not a photographic likeness. All composition coordinates,
facial shapes, colours, lettering, stroke widths and wall offsets are illustrative
display estimates. Background and foreground polygons are resolved into one
non-overlapping field before triangulation. Its plane sits27 cm outside the measured
wall, clear of the retained slightly different coarse facade and old details.
The original measured gable silhouette clips the artwork.

The native image is independently constructed from occupancy of these authored
polygons on 10 cm cardinal paint runs. It never samples an image. Paint follows
the actual outer skin of the 11 retained 4 m columns, 38 same-owner 2 m facade cells
and independent 0.5 m upper roof shell, at a 2 cm display clearance. The generator
replays and matches all 308 published v166 facade triangles against the actual
`2_-2` native packet before using their cells as support. Paint also wraps their
cardinal step sides and horizontal ledges, so retained block faces cannot interrupt
the lettering or subject. Native letter strokes are slightly widened to remain
readable. Every paint run and wrap has recorded actual wall support; the balloon
and all four words stay complete. Structural roof navigation follows the support
surface; the thin paint skin does not create separate navigation ledges.
The source building is not rotated or replaced by a new flat mural billboard.

## Integration

- `createAuguststrasseMuralV270(native=false)` is one required, static mesh in
  `RequiredSiteEnvelopesV209`. It provides the same full detail on touch devices.
- `AuguststrasseMuralV270Profile.ts` imports only a 4350 byte roof/profile file,
  never the artwork or encoded constructor mesh.
- `auguststrasseRoofAtV270(x,z,native=false)` evaluates the 12 source roof triangles
  and, in native mode, their independent 0.5 m column height.
- `auguststrasseUpperSolidsV270(native=false)` appends only the source-bound upper
  footprint with minY 20.2 m / 21.2 m. Root's `includeAuguststrasseMuralV270` navigation
  option appends these solids and selects their top callback on mode changes.
  The original lower core obstacle is retained.
- `isAuguststrasseOldGableRimV270(...)` rejects unrelated IDs before computing
  a fingerprint. It matches the complete original prism, the exact west edge,
  15 m body height and 0.22 × 0.48 m cornice dimensions. Only inside the ready
  `tachelesFrontsV270` branch, that edge's old generic cornice is skipped. Its
  ten Float32 triangles and twelve line segments at y 19.94–20.16 m are retained
  in `supersededCoreCornice`. Every other cornice, sockel, source wall, source roof
  and old facade panel remains intact. This removes the erroneous flat-roof
  crossbar through the complete measured gable, not an artwork-wide line filter.

The new constructor data is 511643 bytes. Drawn geometry has 5687 vertices and 5505
triangles; native 14269 vertices and 11478 triangles. Actual GPU arrays occupy 185487
and 308964 bytes respectively, including normals/indices. There is one draw batch
per active mode, no texture/UV, animation, per-frame construction, new coverage,
tour stop or residency/decode/prefetch limit change. Root additionally applies the
existing immutable-constructor compression pipeline during production packaging.

## Verification and QA

Seven focused Python tests verify all source hashes and the complete clipped
upper complement, native coverage/cardinality, every paint run/wrap's real support,
original voxel tuples, exact old ornament/cornice receipts and a real neighbour
sightline. Five Bun tests (1130 assertions) verify bounded GPU buffers, texture-free full detail,
the selective cornice hook, production roof raycasts and the integrated production
pedestrian environment across drawn→native→drawn. The native visibility test
loads real `2_-2` and resident `056`/`057` packets through the integrated production
decoder and asserts that the mural is the first visible surface along sampled
camera rays, including the earlier obstructed lettering and subject region.
The old body's collision and new represented roof height remain consistent.

QA camera: eye `[1235,31,-732]`, target `[1290,14.5,-753]`.
The sightline and three additional upper/lower mural targets clear all intersecting
retained core neighbours and the complete nearby official source sheets from
`source-390_5820-00`. Render the ordinary core/Alt-Mitte context with the required
site root; an isolated flat ground plane is not a sufficient visual check.
Final internal-browser QA in the actual neighbouring scene confirmed continuous
text and subject in both modes and removal of the two incorrect drawn cornice
lines. Unpainted faces at the extreme native outer edge remain visible outside
the principal composition.

Rebuild with `uv run --no-sync python -m scripts.build_auguststrasse_mural_v270`.
Focused checks: `tests/test_auguststrasse_mural_v270.py` and
`src/app/tests/auguststrasse-mural-v270.test.ts`.

Reference ledger additions are in `auguststrasse-mural-v270-references.json`.

The final +3 cm drawn-only clearance correction was measured against the exact old
Auguststraße 92 v167 gable fragments. Their unrounded maximum was 0.253319 m;
the actual published centimetre-quantised faces reach 0.256956 m. The new plane
at 0.27 m clears even their quantised vertices by more than 7 mm. The source
recipe, exact published triangle IDs/vertices and both input hashes are retained
in `oldGableClearance`; a focused test replays them. Those old v167 facade details
remain intact. The separate cornice correction is restricted to the exact
superseded estimate described above.
