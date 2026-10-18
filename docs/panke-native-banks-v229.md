# Native Panke raster-bank correction — v229

The drawn Panke bank follows the retained curved water edges. Applying those
same curves to the block city leaves many wall faces behind its unchanged
four-metre terrain slabs. The native supplement therefore has a separate,
source-derived placement file, `pankeNativeBanksV229.json`.

`build_panke_native_banks_v229.py` retains 942 actual water/land cell edges in
the same bounded lower-Panke corridor. Every edge has a receipt identifying
the original water cell, neighbouring land cell, complete land run and its
rendered height. Heights reproduce the original full run midpoint used by
`createGroundSlabsSteps`; the script does not first split runs and then sample
a different height. Bank normals face into the existing water cells. The wall,
coping, masonry courses and original illustrative paint sit just in front of
these existing land slabs. No source block, source water, original navigation
surface or source height changes.

The entire possible native box footprint, including AABB corners of diagonal
legacy segments and the paint strokes, avoids the mapped tunnel buffers,
Nordhafen mouth and actual core bridge cells. This excludes 91 candidate cell
edges. Outside the core's northern edge at world Z −3620, 57 existing source
bank axes remain after the same passage check; the correction does not invent
a new four-metre terrain grid there. These remain the independent orthogonal
box interpretation of the existing source boundary.

The runtime data is 57,223 bytes before bundling; evidence stays outside the
viewer bundle. Static geometry remains in the same bounded 256 m culling cells
and uses construction-only decoded arrays, with no new textures or live budget.
Material choices and masonry/paint remain documented display estimates.

Validation replays the generator byte-for-byte, verifies all 942 neighbours
against original terrain runs and confirms all four water-facing directions.
Seventy-three actual horizontal Three.js rays, spread across the full reach,
hit the native bank before the unchanged original terrain slab at upper-wall
height. The existing orthogonality/static-memory test also passes. Useful QA
anchors are the channel around world (192, −2610) and the downstream forebasin;
the upstream tunnels remain intentionally open.
