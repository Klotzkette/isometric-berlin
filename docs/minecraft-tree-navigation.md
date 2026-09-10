# Minecraft tree density and pedestrian collision — step 10

v1.0.27 reduces the secondary deterministic hash threshold from five to four
of six buckets in both profiles. This removes about one fifth of the existing
generic Minecraft trees while preserving every source record, each surviving
tree's cell, the Lenné-Eiche signature and protected memorial/tunnel exclusions.
The complete world now displays 19,721 trees in full and 9,901 on mobile,
including the signature oak, from the same 44,222-entry source inventory.
Compared with v1.0.26 this saves 1,108,992 / 541,044 geometry/instance bytes
and 11,602 / 5,676 rendered instances; draw-call counts remain 98 / 96.
The full/mobile construction snapshots compare independent synchronous buffers
against cooperative construction, including all surviving tree transforms and
colours. `minecraft-tree-density.test.ts` separately checks against the frozen
v1.0.26 selection that no omitted tree returns and mobile remains a subset.

The Minecraft tree-density change also needs to release invisible source trunks
from pedestrian collision after the viewer has loaded Day's deferred park layer.
The shared obstacle index still retains all source records; only its tree-circle
collision query changes while a complete voxel world is attached and active.

The query uses the same `minecraftVoxelTreeRetained` policy and full/mobile
profile as the renderer, mapping source X/Z to cells with `floor(position /
cell_m)`, as the voxel exporter does. The source-identified Lenné-Eiche remains
solid in both profiles. Loading/failure fallback, invalid grid scale and all
other modes keep the ordinary collision. Returning to Day restores it without
rebuilding the obstacle index. Lamp posts, shrub patches, playground fixtures,
buildings and protected volumes are outside this tree-only filter.

This narrowly corrects omitted-tree blockers. The previous cold-Minecraft path
does not construct the deferred park obstacle index until the drawn world is
loaded; that existing absence is unchanged. Likewise, retained ordinary trees
still use source trunk positions for pedestrian collision while their voxel
reading is centred on the exported cell. Correcting those pre-existing broader
representation differences requires a separate voxel-native navigation pass.

Regression tests in `minecraft-pedestrian-tree-collision.test.ts` cover a real
newly omitted Tiergarten trunk at `[-1656.21, 5.245, 688.7]`, retained full/mobile
cells, the v1.0.27 removal at `[-1652.08, 5.245, 682.89]`, Lenné-Eiche,
Day → Minecraft → Day restoration, loading/failure fallback,
unusable cell sizes and preservation of non-tree/protected obstacles.
