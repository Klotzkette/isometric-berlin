# Retained global props on the northern terrain

`northTerrainDrapingV309.ts` places existing global source trees and park-path
ribbons onto the finite v306/v307 terrain after the complete northern ensemble
is ready. It adds no geometry, photographic pixels, material, timer or animation.
Original source files, every XZ coordinate, shape/scale/rotation, colour,
instance ordering and outside member remain unchanged.

The complete global `park-details.json` has 45,540 source trees. Exactly 25 lie
in the new finite domains; the original voxel source also has 25 relevant tree
anchors. No source public-lighting point lies in these domains. The retained
street-light batches therefore remain unchanged. Existing packet-owned roads,
station architecture and props remain the terrain packet transactions' concern.

The small `northTerrainPropsV309.json` catalogue has 264 exact members in eight
original batch names. `capture-north-terrain-props-v309.ts` invokes the unchanged
real single-tree ParkDetails factory for each relevant original source tree,
and the exact original voxel-tree formula for native trees. It records two
independent full Float32-matrix byte hashes and the original tree anchor. All
trunk, branch, crown, snow-cap and microcrown members move by one delta sampled
at that source anchor. No nearest-tree guess, height-based reassignment or
independent lobe drape can deform the original tree.

Root passes `{enabled, native, parkOffsetAt, railGroundAt, oldGroundAt}` to
`stageNorthTerrainDrapingV309Steps`. It returns a private transaction with
`commit(liveCompleteGate)`, `rollback()` and `complete()` methods. Stage never
changes a visible source Y word. The root publisher first attaches the complete
northern terrain, then commits its terrain clones and this transaction together
in the same synchronous publication. A pending abandoned transaction must be
rolled back to remove its listeners. `prepareNorthTerrainDrapingV309Steps` and
`syncNorthTerrainDrapingV309` remain conveniences for a deferred props root that
has not yet joined the visible scene. The default is closed. `enabled` must come from
the private complete v309 ensemble gate. No public model readiness flag is read.
`parkOffsetAt` is the v306 delta to the existing v182 terrain;
`railGroundAt` is the absolute v307 floor and wins where fields overlap.
`oldGroundAt` must be the actual original global ground sampler before the new
northern field is installed, including the existing precise park relief.
Original source trees already carry v182/v190 placement. All 25 anchors were
checked against `parkReliefAt(x,z,worldGroundSampler(original)(x,z)??3,native)`:
drawn source-base clearance ranges from 0.02956 to 0.16211 m, native from
−0.274 to 0.148 m. None is buried under an older hill. Exact catalogue trees are
nevertheless replanted from their original source base onto the new absolute
rendered floor, so a proved older erroneous base can also be corrected without
splitting a crown. Paths preserve their original small clearance. A flat 3 m
assumption must not replace the original sampler when applying a delta field.

Only exact catalogue members in the actual ParkDetails/voxel-tree batches are
eligible. The spatial-cell suffix is removed solely for batch-name lookup;
no public source-name marker authorizes a row. Non-instanced park-path ribbons
receive per-vertex Y changes only where their old ground clearance is plausible.
Shared path geometry, elevated bridge paths, arbitrary meshes, railway members,
architectural batches, animated objects and transformed coordinate frames are
excluded. Every new bounding box/sphere is recomputed after placement.

Preparation yields before mutations. Complete word audits, final hashes and
new culling bounds are calculated cooperatively. The publisher writes only the
owned Y slots and adopts precomputed bounds after exact private attribute/storage
identities, versions, counts, index/colour bindings, local/world poses, ancestry
and resource lifetimes still match. No city-wide matrix scan or hash runs in
the publisher. Cancellation removes its
listeners and leaves every original array untouched. Mutation first leaves
legal lossless CPU parking through the storage's ordinary update contract.
The helper preserves all foreign components of an interleaved buffer.

`restoreNorthTerrainDrapingV309(root)` restores exactly the privately owned
original Y slots. Repeated calls do not compound placement; a new mode/sampler
first restores the old transaction. A foreign buffer/row change is never
overwritten by rollback. Disposal, detachment or changed poses invalidate the
old receipt. Listener cleanup follows cancellation, restore and eviction.

Nine Bun tests cover actual single-tree factory members, rigid whole-tree
movement, absolute-field precedence, no compounded displacement, cancelled
preparation, interleaved/parked large batches, complete foreign matrix/colour
preservation, exact rollback, plausible path placement and rejection of foreign
row changes, a wrongly buried source anchor and separate gated publication.
The catalogue is approximately 4.8 KB gzip; all original photos,
tree sources and source metadata remain unchanged.
