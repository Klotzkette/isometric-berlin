# v1.0.53 — Gedächtniskirche and Bikini Berlin

Pipeline step 10. This release refines the two requested City West buildings
within the existing bounds. The 93-place tour and earlier city, road and park
data remain unchanged. The v1.0.52 Schwellenraum resource-lifetime fixes remain
in place.

## Architecture

- Gedächtniskirche: aligned, fine blue concrete-glass fields on the octagonal
  church and hexagonal bell tower; blue night emission, bronze entrance,
  four gold clocks, masonry courses, layered portal arches and a thin, hollow
  fractured crown at the retained 71 m ruin height. Exact low source wings
  remain, and the lower passage stays open. Minecraft uses an independent
  five-building block model.
- Bikini Berlin: all 103 mapped building parts replace the previous tall
  generic shopping-mall envelope. The lower terrace, planted roofs, glass
  openings, four external stairs, recessed transparent storey and roof
  setback retain their mapped levels. Coloured facade bands, slender gold
  frames, zoo-side glazing and code-built lettering distinguish the long
  historic building from the independent neighbouring buildings.

## Evidence and preservation

The [church contract](gedaechtniskirche-v153.md) binds existing OSM anchors to
published architectural dimensions and licensed visual references. The
[Bikini contract](bikini-berlin-v153.md) records the bounded OSM part extract,
official operator/architect evidence, exact stair and roof openings, and
native raster ownership. Window subdivisions, small trim and ruin fracture
details are procedural recognition estimates, not survey data. No photograph,
font or photo texture is bundled or loaded at runtime.

Only four matching old drawn prism IDs are suppressed: the two church towers
and two Bikini parent volumes. Replacement geometry is staged by the existing
cancellable world construction. Church source wings outside the authored
core are retained, with the thin strip across the passage kept overhead.
Bikini replaces 660 exclusively owned native cells; all 29 mixed cells stay.
Original source records remain intact. All four drawn modes use the same full
static detail on desktop and mobile; Minecraft has its separate native form.

| Model | Draw calls | Stored vertices | Instances | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Complete drawn City West groups | 12 | 64,144 | — | 1,167,162 |
| Native church ensemble | 1 | 24 | 7,922 | 602,912 |
| Drawn Bikini Berlin | 3 | 25,758 | 3,935 | 685,718 |
| Native Bikini Berlin | 2 | 7,965 | 21,371 | 1,743,959 |

These are stored geometry-buffer measurements, not total browser memory.
Repeated details use fixed instanced or merged batches without hidden solid
building infill or per-frame allocations.

## Validation

- Ruff formatting and lint passed; all 498 Python tests passed.
- TypeScript and the production Vite build passed. The existing advisory for
  chunks larger than 500 kB remains.
- 80 focused Bun tests passed for source geometry, roof/stair raycasts,
  five-mode pedestrian access, resource bounds, cancellation/publication and
  Schwellenraum presentation. The construction fixture now includes the new
  Bikini addon; its rollback/disposal assertions remain intact.
- 188 broader Bun regressions passed: isometric world (67), Minecraft world
  (32), earlier native-model preservation (50), full/mobile exact static-detail
  parity (35), and synchronous/cooperative construction equivalence (4).
  New v153 fixtures record only the requested City West changes. Earlier
  fixtures and every unrelated model hash remain frozen.
- Independent polygon intersection found zero unrelated-building overlap in
  the 660 Bikini and 39 church native replacement cells. These 699 columns
  account for exactly 2,097 full / 699 mobile generic stack instances; local
  pane accounting explains the 890 superseded generic panes.
- Final Chrome desktop passed all five modes, unchanged camera poses, exactly
  one active Bikini representation and repeated camera moves with no runtime
  or HTTP errors. Reviewed screenshots include the church glass grid and ruin,
  Bikini street face and roof, night illumination and native Minecraft.
- Release readiness and the local-package smoke passed. The ZIP is
  35,729,893 bytes; the static TAR.GZ is 35,616,045 bytes. Both archives have
  SHA-256 checksums. All 1,372 existing Pages paths are retained alongside
  the byte-verified new build, preserving dependencies for already-open tabs.

The final native world stores 316,632,400 bytes for full and 107,095,316 bytes
for mobile. The new Bikini and church native models add three fixed draw calls;
they do not allocate hidden solid building fill.

### WebKit compatibility finding

The newly selected Playwright 1.63.0 / WebKit 2359 (26.6) test engine loses its
WebGL context during early City West camera movement. The same fresh-profile
probe also reproduces this on the unchanged live v1.0.52, before switching
modes. A recovery can rebuild the scene, but this is not a clean browser pass
and the underlying context loss remains unresolved. It is not evidence of a
v153-only geometry regression, nor proof of a crash on a physical iPhone.
The previously used Playwright 1.62.0 / WebKit 2336 engine passed the same final
build with its iPhone 13 profile: all five modes, camera continuity, single
active representation, repeated travel and zero console/page/HTTP errors.
No geometry or resolution was reduced to mask the newer engine's failure.
