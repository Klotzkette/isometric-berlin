# v1.0.14 review and verification

Pipeline step 10. Correct the Humboldthafen buildings and economic ministry
in the actual initial scene, including the mobile profile, and restore mapped
Invalidenfriedhof graves in Minecraft.

## Reproduced findings

The previous mobile partition permanently assigned all 66 Humboldthafen parts
and all six ministry parts to the distant box representation. The detailed
facades existed, but their true base geometry never arrived. The ministry box
filled eleven source courtyards. H4's longest-edge box covered 528.316 m² of
committed OSM water: its false eastern corner reached x=201.576 m rather than
the source perimeter at x<=166.9 m. This is a representation error, not a
reason to rotate or relocate the source buildings.

The corrected partition puts all 72 parts in the first exact selection.
Together with the previous 34 mandatory parts, all 106 fit within the unchanged
160-part mobile startup. The desktop startup remains 420 parts and complete
exact-city caps remain 3,600 / 9,000. The original 29,818 records are retained.
Authored replacement bodies, where required for roof accuracy, share the same
source identity and initial-context lifetime.

H3 also had a source overlap: its high main prism covered three lower court
roofs. The courtyard resolution preserves all records, uses existing measured
inner-wall vertices, and exposes the lower roofs. Geometry, Minecraft source
replacement and pedestrian support use the same interpretation.

The economic ministry has distinct historic and modern bodies and roof detail;
its modern solar strip follows official DOP evidence. See the
[ministry source contract](economic-ministry-refinement-v114.md) and
[harbour source contract](humboldthafen-buildings-refinement.md) for measured
source geometry versus procedural subdivisions.

Minecraft's cemetery omitted 29 ordinary mapped graves when its native world
hid the drawn cultural layer. These now join the existing palette batches at
their exact retained OSM points. Scharnhorst's structural lion, sarcophagus and
railing remain intact; see [cemetery audit](invalidenfriedhof-audit-v114.md).

## Validation

The new production-partition regressions fail all three tests against v1.0.13.
The corrected partition passes source coverage, unchanged limits, real rooftop
rays, eleven clear ministry courts, the H4 courtyard, and the former false
water corner in Day, Night, Snowstorm and Schwellenraum. Testing isolated
architecture alone would have missed the startup bug.

Independent review additionally found and corrected buried Minecraft solar
panels and collision heights above low eaves. All 447 native panels clear their
stepped roofs in both profiles; precise roof planes and decimetre obstacle
plans share a bounded 0.1 m edge probe when needed.

An oblique geometry review then exposed gaps between Minecraft roof steps.
Neighbour-aware roof thickness closes those gaps without changing the measured
roof tops, horizontal footprint or courtyard openings. Short oblique rays
verify the actual full/mobile instances; restoring the old thin tiles in the
same test reproduces the gaps.

The ministry source generator reproduces the 223,301-byte supplement exactly
from its retained official ZIP. Its 2,253 derived main-roof triangles cover
10,886.895 m² with zero missing area, zero excess and zero courtyard overlap.
All source surfaces remain within the release polygon.

- Complete frontend: all 1,819 tests passed across 230 files, with 7,030,501
  assertions (311.54 seconds). The final run used the frozen source and covers
  both device profiles and all five visual modes.
- All 361 Python tests passed on the final package (34.54 seconds). Ruff
  formatting and lint passed.
- TypeScript, production build, release readiness and the local-package server
  smoke test passed. Every packaged hashed asset matches the final build.
- Independent geometry/source review found no remaining release blockers.
  No source records, catalogue places or release bounds were removed.

The downloadable ZIP is 36,298,499 bytes; the viewer archive is 35,719,925
bytes. Their SHA-256 checksums are supplied in `SHA256SUMS-v1.0.14.txt` with
the GitHub release.

The Mac was locked during the direct browser attempt. Software geometry images
use actual Three.js triangles and instance matrices with orthographic
projection; they are not browser screenshots or a physical iPhone test.
