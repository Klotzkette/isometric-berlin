# Minecraft tree density and pedestrian collision — step 10

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
cells, Lenné-Eiche, Day → Minecraft → Day restoration, loading/failure fallback,
unusable cell sizes and preservation of non-tree/protected obstacles.
