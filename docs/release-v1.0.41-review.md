# v1.0.41 review — restoration of omitted city detail

Step 10 repairs confirmed presentation regressions reported at Invalidenpark,
Otto-Weidt-Platz and the Spree/Hauptbahnhof. The complete source data were still
present; prior mobile loaders and reduced model profiles failed to display them.
This was real quality loss and must not be described as a lossless optimization.
See the [source/history audit](source-quality-audit-v141.md) and
[static model comparisons](static-detail-restoration-v141.md).

## Surface and building restoration

Touch installs the complete water family before showing its drawn scene: all
175 water polygons, 37 basins and the retained 39 m Sinkende Mauer, including
its wedge, crown path, basin and railings. Its old generic marker is suppressed
only when the retained source model is present. Desktop uses the same exact
water constructor through its worker.

Both device profiles load all 2,193 park polygons, scrub points, special road
materials and lane markings. Asphalt and paving are triangulated offline from
the actual renderer's source-preserving curves. Actual newer district surfaces,
Brandenburg approach, Bebel glass/library, Hansaplatz courts/U9/buildings,
Hand mit Uhr paving and the T4 field retain ownership. Source curbs follow
original edges; clipping boundaries never create artificial kerbs.

The prepared street geometry is partitioned spatially and transferred with
acknowledgement before another surface batch is built. The worker's ready signal
requires every surface to be attached and the current requested building view
to be settled. Both profiles remain available for subsequent journeys and
resume by stable IDs without duplicating retained geometry.

Desktop now makes all 29,818 source building parts eligible for their existing
exact detail. It retains up to 9,000 requested parts plus 420 initial parts;
mobile keeps its existing bounded residency. Complete source envelopes remain
visible before refinement and are restored before disposal. This is not a claim
that every city-wide window is simultaneously resident or that travel has zero
refinement latency.

Full static architecture is restored on touch. Independent pre-restoration
comparisons preserve 33 full model signatures and 50 native Minecraft variants.
The Tränenpalast's remaining reduced glazing is restored as well. The initial
park restores its full existing path, foliage, wall and playground geometry.
Existing indexing, instancing, cancellation and transfer bounds are retained.
Restored content increases storage compared with the incomplete former scene;
no resolution, source detail or drawing distance is reduced to conceal that cost.

## Validation

The complete frontend suite passes **2,237 tests across 277 files**, with
8,507,363 assertions. After the final material-only quay correction, the focused
water/boundary suite passes another 12 tests / 215 assertions, including
unchanged quay geometry hashes, mode changes and worker transfer. TypeScript,
Ruff and diff checks pass.

The restored 425 road batches use **32,025,228 bytes** of geometry buffers after
exact indexing, saving 18,325,428 bytes without changing any expanded triangle
or line attributes. Stream decoding is bounded even when a browser supplies the
entire response in one network chunk. Source area accounting preserves actual
newer district ownership, including 38.804 m² of overlapping paving source
polygons rather than misclassifying that overlap as missing coverage.

The [land/water boundary correction](drawn-water-boundary-v141.md) preserves
every retained land complement and all existing authored exclusions. Actual
Chrome and touch-WebKit scenes replace 11,010 offending raster cells. Same-pose
Hauptbahnhof checks show the stepped intrusions removed; the final quay depth
priority also eliminates green fragments without moving or deleting geometry.

Fresh production Chrome and touch-WebKit checks cover Invalidenpark,
Otto-Weidt-Platz, the Hauptbahnhof bank and the drawn modes. All 425 road packets,
the complete 175-water/37-basin/one-wall family, park and special road packets
attach without missing or duplicate IDs. Bebelplatz's glass/library and the
GRIPS courts remain open. Browser emulation is not a physical older-iPhone
memory or frame-rate guarantee. These source and geometry audits cover the
delivered city; selected visual checks do not establish pixel-by-pixel
equivalence at every location.

The final built candidate repeats the Chrome and touch-WebKit checks with the
shipped quay material settings and 187 spatial bank batches over the same
11,010 cells. An independently extracted ZIP passes the touch-WebKit menu gate
at five viewport layouts in all five modes, including light toggles. Simulated
WebGL context loss recovers once with the camera pose preserved; a repeated
failure does not enter a reload loop.

Some legacy ground transitions remain approximate. The brown granite-sett
ribbon around Invalidenpark's basin (`28882867:0`), its granite approach
(`40432525:0`) and outer compacted-aggregate paths (`53786340:0`,
`53786349:0`) are retained mapped paths with distinct materials. They must not
be deleted as presumed raster artifacts. Fine fringes between these paths,
other paving and the lawn can still reflect the older four-metre ground grid;
this release does not claim every ground transition is now survey-precise.

All **455 Python tests** pass. Release readiness and the packaged HTTP server
smoke pass for v1.0.41. The packaged viewer is 88,095,251 bytes unpacked; the
ZIP is 33,985,185 bytes and the standalone tarball 33,865,996 bytes.

SHA-256:

- ZIP: `ca8ce478c87911821ad92ae7afe430ecd5822f36d834b28f01e94d05eaf09fff`
- Tarball: `67bd72df2648a3bcf67d9b703abc0853358371f318954faa2812d7ec3a3e6ee7`

The release publishes these exact artifacts and merges the current hashed
assets into GitHub Pages without deleting older assets needed by open tabs.
