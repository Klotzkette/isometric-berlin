# Exact drawn land/water boundary — v1.0.41

The river polygons and curved quay models were still present. However, the
four-metre raster ground beneath them retained neighbouring land cells that
extended into the mapped water. Replacing only the water surface cannot hide
those higher grass or plaza blocks. This is a presentation overlap, not loss
of the retained OSM water data.

## Source-preserving correction

`prepare-water-boundary-source.ts` runs the renderer's actual
`smoothSurfaceRing`/`surfaceCurveOptions` on all 175 retained water polygons:
76 rivers, 23 streams, 39 ponds and 37 basins. The offline Python generator
subtracts that continuous water union from each intersecting non-water raster
cell. Every nonempty land component, including small fragments and polygon
holes, is triangulated without simplification. Three.js receives its usual
Float32 coordinates. Source inputs are untouched and their SHA-256 hashes are
recorded in the 3,219,152-byte derived `drawnWaterBoundary.json`.

The unexcluded canonical source contains 11,366 affected land cells. Their
water intrusion totals 35,378.562 m² and their remaining land totals
146,477.438 m². Only three false land cells are entirely covered by water.
The station audit window contains 588 affected cells/1,967.636 m² intrusion;
the Otto-Weidt window contains 312 cells/872.991 m². These audit windows and
figures describe source overlap, not independently surveyed public-space areas.

At runtime the correction operates on the **already constructed** drawn ground
instances. Thus the existing Bebelplatz, Brandenburg approach, Spreebogen,
Tiergartentunnel and Tilla-Durieux exclusions remain authoritative. The callback
never regenerates land inside an excluded cell. An affected run is split, and
every surviving fragment keeps its original matrix height, three-metre thickness
and exact instance colour. Prepared land fragments fill the remainder of each
clipped cell, with top, bottom and side faces. The old RLE run's height and shade
are retained rather than resampled from new run lengths.

The native Minecraft ground constructor is unchanged. The new call is restricted
to the drawn city with actual surface data and the matching canonical ground grid.
The replacement meshes participate in Day, Night, Snowstorm and Schwellenraum
material switching. Their geometry is identical across those mode changes.

## Runtime costs and checks

Clipping and triangulation run only during offline generation. The runtime reads
compact typed buffers and builds spatial 256 m batches with individual bounds.
The existing exact-indexing pass deduplicates only vertices whose complete
attributes are identical; no triangle, paint, normal or coverage is removed.
The full unexcluded source probe took about 55 ms for the boundary replacement
in Bun on the development machine. This is not an iPhone or browser frame-rate
measurement.

The expanded ground probe uses the canonical terrain, tunnel course, surface
payload and existing authored exclusions, but retains raster asphalt for an
additional coverage check (`retainRasterAsphalt: true`). This probe replaces
11,257 affected cells in 188 spatial batches. Raw boundary geometry uses
23,868,000 bytes; exact indexing reduces it to
14,926,152 bytes, saving 8,941,848 bytes. All 221,000 triangles remain, with
377,782 unique vertices after indexing. The complete ground-only city probe
took 543 ms in Bun; that includes the pre-existing ground constructor and is
not the isolated clipping time.

The actual viewer sets `retainRasterAsphalt: false`: source-based streets own
the road surfaces. With the surface payload present it also sets
`retainRasterWater: false`. The final Chrome and touch-WebKit browser audits
both report 11,010 affected land cells after those exclusions. The larger
11,257-cell buffer and timing figures above describe the expanded probe,
not the viewer's measured cell count.

The preserved vertical land complements share the exact quay plane with the
authored stone walls. A browser comparison exposed depth fighting between them.
Both day and night quay materials now use polygon offset (-1 factor, -1 units)
to give the masonry depth priority. Neither surface is moved or deleted. The
original quay geometry hash remains
`7aa5be7b0c81aeb9a0faefd48cdf2be93037141a837b47db458b3eb9845a4fbc`,
with 114,246 vertices and 240,816 indices. All drawn modes, light states and the
desktop worker transfer retain this priority and the unchanged geometry.
Same-pose touch-WebKit screenshots confirm that the green speckles on the
vertical Hauptbahnhof wall disappear while the legitimate green upper bank
remains. Evidence: `/tmp/v141-quay-depth-audit/`.

Regression checks include analytical half-cell and fully water-covered cases,
unchanged neighbouring RLE heights/colours, existing authored exclusions,
nonmatching-grid isolation, known Hauptbahnhof cells, indexed triangle-attribute
parity, and all four drawn material modes. Python tests independently check land
area conservation, interior holes, disconnected/tiny remnants, source hashes,
unique cell IDs and every committed triangle remaining within its own source cell.
The Float32 land-area sum differs from the double-precision clipping ledger by
less than 0.1 m² across all affected cells.

Validation: twelve focused water/boundary Bun tests / 215 assertions and four Python tests passed;
TypeScript and Ruff checks passed. Browser visual QA and full release validation
are recorded in the release review. This fix does not claim a physical-device
crash guarantee or that every unrelated map detail was visually inspected.
