# v1.0.69 — Alt-Mitte building coverage

Pipeline step 10, within the existing 81.457 km² release bounds and unchanged
93-place tour. The owner requested a complete pass over the old Mitte district,
before its merger with Wedding and Tiergarten in 2001.

## Scope and evidence

[The boundary audit](alt-mitte-v169-scope.md) uses the official ALKIS Ortsteil
polygon as a conservative building-selection boundary. The original 2008
parliamentary map and explanation establish that a 310 m² unbuilt embankment
triangle was subsequently transferred into Mitte. The selected polygon contains
the entire pre-2001 district; it is not presented as a newly surveyed exact
historical boundary. No general expansion of the existing viewer bounds occurs.

The frozen inventory contains 13,545 official parent families and 26,768 deepest
parts. Of these, 3,983 core families (9,111 parts) and 4,391 outer families
(7,597 parts) receive complete source wall, roof and closure sheets. The remaining
5,171 official families retain existing authored models, transparent glazing or
explicitly documented source-conflict ownership. OSM-only residuals remain
independent sources rather than being assigned to a nearby official building.

New measured geometry comes from Berlin LoD2; OSM supplies mapped semantic
context and remaining footprints. Explicit material tags take precedence over
neutral display defaults. Inherited core colours come from an immutable v1.0.68
appearance snapshot. Its 10,716 prism components preserve same-ID spatial
components separately; all 403 imported repository dependencies were checked
against the release's Git objects. Existing transparent components are retained.

Window spacing, window dimensions and untagged material defaults are display
estimates, not a facade survey. No photograph, generated image, new business
identity or invented historic ornament is bundled. Original source rings remain
archived. The small number of self-intersecting source planes are repaired by
splitting their topology and interpolating new crossing points on original
edges; all positive-area pieces and original source-edge ink remain represented.
Independent triangulation verifies surface coverage and courtyard holes.

## Preservation and runtime

`build_alt_mitte_v169.py` reads immutable v1.0.68 packets. It subtracts only the
exact triangle/colour and line multisets of named old outer coarse owners,
retaining all other geometry, road/water/ground navigation and existing companion
packets. New companions carry geometry only, so an empty companion never
overrides a primary navigation tile. Packet splitting does not simplify geometry
or increase the existing byte, vertex, index or mesh limits.

Measured core shells are constructed before the world becomes interactive.
Streaming or eviction of facade detail cannot remove these complete source
envelopes. Native Minecraft uses independently generated orthogonal surface
geometry, with exact coplanar face merging. Roof queries use spatial bins;
equal-height native roof cells are losslessly compressed into row spans instead
of expanding a large per-square-metre map in the browser. Exact legacy spatial
records, including duplicate short IDs with different rings, define the old
native columns that may be replaced.

Day, Night, Snowstorm and Schwellenraum share the full drawn detail on touch
and desktop. Existing streets, paths, shorelines, landmarks and the tour are
preserved. The native and drawn payloads are separated so their loading can be
verified independently. Construction cancellation disposes incomplete models.

## Validation

The 274 previous external descriptors remain; the complete manifest now has
329 descriptors. Exact source ownership changes 59 spatial cells. The new
drawn resident shells contain 306,582 triangles in 78 bounded modules and use
9,751,776 decoded geometry-buffer bytes. Their independent native counterpart
contains 2,350,346 triangles in 101 modules and uses 39,813,492 bytes. Full and
touch geometry hashes match in both families. Facades remain independently
streamed. Existing per-packet decoding and offscreen-retirement budgets are
unchanged; the latter is not a hard cap on visible geometry.

Eight lossless navigation modules preserve all 5,427 complete legacy prism
records (5,426 distinct IDs), 9,111 leaf footprints, 75,029 roof triangles and
158,368 native roof spans, including original record order. Each navigation
module is below 2 MiB; all new geometry modules are below 3 MiB. Native modules
are requested only after Minecraft intent. Pure, side-effect-free navigation
assembly prevents a redundant 13,636,546-byte copy in the background worker;
the final worker contains no v169 navigation or resident geometry payload.

The complete static site is 473,985,486 bytes (452.0 MiB). The finite offline
package ceiling is 465 MiB to cover the requested district-wide source addition.
This download allowance does not raise any live renderer or packet limit.

Whole synchronous native construction is 4,343,042 instances / 343 renderables /
378,294,462 buffer bytes for full and 1,971,528 instances / 341 renderables /
197,609,942 bytes for mobile. These are complete construction totals, not the
smaller camera-dependent GPU working set. The new v169 fixtures preserve all
historical fixtures; ground and Moabit batch hashes remain byte-identical to
the v168 constructor. Cooperative and synchronous construction match exactly.

- Five strict published-data proofs pass: complete baseline preservation,
  measured source sheets/colours, courtyard navigation, retained authored/glass
  sources and immutable appearance evidence. The single tiny OSM residual has
  a separate exact footprint/shell proof and explicitly estimated height.
- Seven lossless-splitting regressions pass, including duplicate coloured
  vertices, winding, ink, negative origins and navigation ordering.
- Python verification: 709 tests in the complete suite excluding the five
  independently run strict published-data proofs, plus those five proofs:
  **714 passed**. Two existing temporary-fixture CRS warnings remain.
- Frontend checks pass in the 82-test core/runtime run, 18-test ownership run
  and 36-test world/construction run. These runs overlap; their totals are not
  added. The worker import graph also has a real bundler regression.
- Ruff, TypeScript/Vite, release-readiness and packaged local launch pass.
- WebKit iPhone 13 profile: 36 samples across six district views, all five modes
  and return to Day; no page error, crash, context loss or loader warning.
  Maximum observed GPU buffers: 234,928,999 bytes. Cold Day requests zero native
  packet modules.
- Desktop Chrome: nine samples across three views in Day, Schwellenraum and
  Minecraft; no page error, crash, context loss or loader warning. Maximum
  observed GPU buffers: 678,069,802 bytes.
- Chrome Pixel 5 profile: nine samples across the same three views and modes;
  no page error, crash, context loss or loader warning. Maximum observed GPU
  buffers: 176,421,000 bytes. Cold Day requests zero native packet modules.

Browser device profiles are not physical iPhone tests or a guarantee against
operating-system memory pressure. GPU measurements describe these routes, not
the browser's total memory. The release adds substantial real building geometry;
no claim of reduced total scene memory is made.

## Reproduction

`uv run python scripts/build_alt_mitte_v169.py --output /tmp/alt-mitte --apply`
creates the measured source packets and conservation audit. Follow with
`uv run python scripts/split_alt_mitte_v169_core.py /tmp/alt-mitte` to publish
bounded, mode-specific geometry and navigation modules, then run the release
tests and `bun run build` inside `src/app`. The unsplit intermediate JSON is
not a repository or hosted asset. Reproduction requires the source archives
whose exact hashes are recorded in the source manifest.
