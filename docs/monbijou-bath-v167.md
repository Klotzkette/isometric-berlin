# Kinderbad Monbijou — v1.0.67

Pipeline step 10. The two original OSM pool rings are retained without smoothing
or rectangular replacement: way 30876932 (293.934 m², concave main basin) and
way 51167567 (100.500 m², smaller wading basin), within site way 30876915.
Coordinates use the established EPSG:25833 scene transform.

The [operator](https://www.berlinerbaeder.de/baeder/detail/kinderbad-monbijou/)
documents the 25 m non-swimmer pool, maximum depth 1.30 m, separate 20–35 cm
wading pool, lawn, kiosk, playground and accessible changing provision.
This is a summer presentation, not a claim that the seasonal bath is open
in October. No unverified lane markings or historical equipment were added.

The inspected official DOP2025 spring image confirms both outlines, the stone
surrounds and the west changing buildings. The approximate terrace edge was
picked from that orthophoto; coping width, colour and paving joints are display
estimates. The WMS request, bounding box, raster hash and facts are recorded in
`monbijouBathV167Evidence.json`. Berlin DOP is dl-de/zero-2-0; OSM is ODbL 1.0.
The raster stays in ignored raw QA data and is not distributed or textured.

All six existing source building parts, mapped paths, fences and trees remain
under their v166 owners. This module adds only the pools and surrounds in one
static drawn mesh. The native model uses 698 merged orthogonal quarter-metre
surface runs in one instanced mesh. Surface offsets accommodate the existing
city ground plates; the bath does not excavate or replace shared terrain.
Both basins participate in the walking water check. Static drawn detail is the
same for pointer and touch, with no new images, animations or shader effects.
