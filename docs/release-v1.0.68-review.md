# v1.0.68 — Scheunenviertel, universities and English Garden

Pipeline step 10, within the existing 81.5 km² boundary and 93-place tour.

## Source and visible changes

- [Scheunenviertel](scheunenviertel-v168.md): 331 complete LoD2 families,
  715 parts, 58 previously plain core fronts and face-specific additions to
  326 previously detailed families and seven core records. The finite working
  area covers the streets and courts between Rosenthaler Straße, Torstraße,
  Karl-Liebknecht-Straße and Hackescher Markt. Existing Tacheles, synagogue,
  Hackesche Höfe and other named models retain their previous geometry.
- [HU main building](humboldt-main-v168.md): additive column fluting,
  capitals, window relief, keystone and portal details on existing measured
  facade planes. The previous shell, court, source data and facade module
  remain byte-identical.
- [TU Berlin and Umlauftank 2](tu-water-v168.md): five complete parent
  buildings and 24 measured parts, historic sandstone wings, northern ribbon
  facade and Audimax, and the pink loop/raised blue laboratory on Schleuseninsel.
  The industrial LoD2 envelope incorrectly filled the pipe clearance; its
  13 affected polygons are retained as evidence with explicit display corrections.
  All 414 original boundaries remain archived. The water-testing facility is
  part of TU Berlin, near Bahnhof Tiergarten.
- [English Garden Teehaus](teehaus-ruin-v168.md): the documented post-fire
  ruin replaces the former offset solid placeholder. All six original source
  parts/90 boundaries remain archived, with one disposition per boundary.
  Standing gables, five upper windows, chimneys, charred wall edges and members,
  a surviving low roof fragment and the sky-open interior are represented.
  Its state is explicitly dated to December 2025 photographs; completion of
  the announced 2026 clearing is not claimed.

Metric footprints and measured source parts remain separate from estimated
facade subdivisions, industrial components, ornament and fire damage. Twelve
new free per-file references bring both Commons attribution manifests to
475 entries, preserving all 463 earlier entries unchanged. No photographs,
textures, generated fonts or Google assets were added to the viewer.

## Preservation and bounded loading

`integrate_scheunen_refinements_v168.py` compares every changed packet with
released v1.0.67. Only the 331 named coarse source owners are subtracted;
all earlier special meshes, unowned triangle/color multisets and navigation
remain exact. All measured new wall/roof sheets and leaf footprints have an
independent published-data coverage test. The historical v167 audit stays
frozen against its release; the new v168 audit checks current publication.

Nine primary chunk pairs are updated. One geometry-only companion for
`4_-2` splits both drawn and native transfer/decoding without discarding geometry. All 273 earlier
descriptors remain; the total is 274. The 12 MiB decoded-packet and 24 MiB
surrounding residency settings are unchanged. Empty companion navigation is
excluded from ground/water lookup, including when a failed primary retries
after its companion arrived. Exact coplanar native face merging preserves
full color coverage; it changes neither geometry silhouette nor detail.

Final visual inspection caught a drawn packet whose 526,284 aggregate vertices
exceeded the renderer's 400,000-vertex limit despite fitting the byte limit. The
exact new mesh now lives in the companion: the primary has 143,803 vertices and
the companion 382,481. Their combined triangle/color multiset is unchanged.
The final integrator and whole-site release check enforce aggregate vertex,
index, line and mesh counts. A regression also constructs and disposes all
20 affected published packets through the real runtime geometry loader.
Browser QA now treats surrounding-loader warnings as failures and requires
both source-bearing scene roots to be present; merely finishing the queue is
insufficient.

The four drawn styles use identical complete geometry on touch and desktop.
Minecraft uses separate orthogonal models. New global construction stages are
cancellable and covered by publication, rollback and disposal tests. TU roof
queries use an 8 m spatial index; precise pipe solids preserve the real air gap.
All 1,268 previous TU/VWS voxel columns, including 30 old roof-tier bands, are
replaced exactly. Ground and unrelated nearby columns remain.

Full native construction: 4,747,879 instances, 242 renderables, 369,248,582
buffer bytes. Mobile native construction: 2,044,957 instances, 240 renderables,
163,377,054 buffer bytes. These are complete construction totals, not the
smaller GPU-resident working set. The synchronous v168 fixture is independent
of the cooperative-construction comparison; previous fixtures remain intact.

The complete offline site is approximately 302.0 MiB. Its finite package-size
ceiling rises from 285 to 310 MiB to include this additional source geometry.
This changes no live decode, draw-quality or GPU-residency setting.

## Verification

Source ownership, courtyard retention, exact legacy suppression, mobile/full
detail parity, native geometry, real pedestrian clearance through UT2 and
asynchronous detail-companion retry behavior are covered by focused tests.
Browser engine profiles exercise rendering and lifecycle, not physical iPhone
RAM limits. Final release checks and browser measurements are recorded below.

- `uv run pytest -q`: **675 passed**; two existing CRS warnings in temporary
  geodata fixtures.
- Focused frontend suite: **226 passed**, 508,073 assertions across 18 files.
- Ruff format/lint, TypeScript/Vite production build, packaged local launch,
  and release-readiness checks all pass. All 548 external packets are checked
  against their hashes, decoded sizes and renderer geometry limits.
- Desktop Chrome: university and ruin views inspected; the corrected quarter
  passes six samples across Day, Schwellenraum and Minecraft, with both primary
  and companion meshes present. Maximum tracked GPU buffers: 530,177,199 bytes
  in that desktop multi-mode round.
- WebKit iPhone 13 profile: 24 samples across HU, UT2, Teehaus and Scheunenviertel,
  all five modes and a return to Day; maximum tracked GPU buffers 120,551,156
  bytes, no page crash, context loss or surrounding-loader warning.
- Chrome Pixel 5 profile: nine samples across UT2, Teehaus and Scheunenviertel
  in Day, Schwellenraum and Minecraft; maximum tracked GPU buffers 117,244,718
  bytes, no page crash, context loss or surrounding-loader warning.

GPU buffer measurements are observed working sets from these routes, not whole
browser memory or guarantees for every physical device. No static model detail
was removed to achieve these results.
