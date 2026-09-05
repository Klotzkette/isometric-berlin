# Lossless box contours, v0.72.41

Scope: step 10, procedural viewer construction. No data source or visible
geometry is removed. The desktop and mobile drawn kits use the same helper;
Minecraft-specific geometry and all five visual-mode policies are unchanged.

## Reproduction

From `src/app`, run `bun run benchmark:box-outlines`. It constructs 8,000
representative world-space boxes, hashes all contour positions for both the
Three.js classifier and the new topology-copy path, then measures seven
alternating runs. It fails before reporting timings if the hashes differ.

Observed on the development Windows PC with Bun 1.4.0:

| Contour construction | Median |
| --- | ---: |
| Three.js EdgesGeometry | 359.13 ms |
| Reused corner topology | 10.59 ms |

Both outputs: `5f5a6e8ce18e243d626abf4b23e7303bef54df4a7c611fa0093c7bfcd70c0847`.
This 33.9x local microbenchmark gain is not a whole-viewer or FPS multiplier.
Near-degenerate boxes intentionally retain the original classifier. Tests also
compare 1,200 thin-part/large-coordinate cases, independent mutable buffers,
and more than 20,000 Tilla-Durieux polygon queries including boundary points.

The production-payload progressive harness retained 199 draw calls, 299 scene
objects, 5,708,185 stored vertices and 84.9 MiB of geometry both before and
after this change. The first uncontended preview measurement moved from
1,554.6 to 1,238.6 ms. These are individual construction observations, not a
cross-device performance guarantee. Runs made while the full regression suite
was consuming CPU were excluded from performance conclusions. Network, GPU,
browser, thermal state and device memory still affect end-user smoothness.
