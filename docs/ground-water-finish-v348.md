# V348 ground and water finish

Ground receives a subtle derivative-filtered material grain without extra
textures or geometry. Only semantic core lawn, paving and road factories and
fully checked original city surface triangles qualify. Paving is less peach;
grass and asphalt are quieter. Unspecified mapped paths keep their paint, and
Native retains its independent palette. Known architectural materials remain.
Source arrays, groups, boundaries, levels and navigation are unchanged.

The existing Spree/canal faces receive low-contrast waves in day, night and
winter. Native, Versunken and Schwellenraum retain their original water.
The effect uses the shared rendering loop at at most 24 updates per second;
hidden/offscreen water and reduced-motion preference stop animation. There
are no new timers, textures, meshes, lights or shadow refreshes. Existing
material hooks are chained and released on actual owner disposal.

Mixed packets require the original water paint at the retained water datum,
with complete triangle containment in mapped water, excluding banks and holes.
Admission yields every 256 triangles and bounds navigation probes. Ambiguous
or over-budget packets keep their original still water. Core water has explicit
semantic mesh names. This is a visual effect, not hydrological simulation.

Actual-packet checks covered Landwehrkanal, Westhafenkanal and Charlottenburg
water, plus two other surrounding water packets. Ground/water admission left
all position, colour, index and navigation values identical. A complex Mitte
packet failed closed; it is not claimed as animated. Unit checks cover shader
composition, mode inheritance, source-array preservation, Native exclusion,
concave banks/islands, visibility, reduced motion and material retirement.
