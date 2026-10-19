# Hermann-Ehlers-Platz paving — v247

This restrained Step 10 addition belongs to the existing Steglitz batches. The
retained OSM pedestrian area `relation/10741017` has a 49-point outer ring and
two complete 24-/9-point holes for the fountain and U-Bahn access. Its full
5,270.871 m² contour is represented by 81 constrained triangles; no convex hull,
rectangular replacement or simplified boundary is used. A quiet stone tone makes
the previously bare ground read as the mapped `surface=paving_stones` plaza.
The filled source contour and both openings remain exact. Plaza paving is
excluded from the architectural edge pass, avoiding heavy dark outlines across
the public ground while leaving every earlier building edge unchanged.

The independent native reading includes every complete one-metre cell inside
that same mapped area: 4,975 cells, losslessly merged into 143 equal-material
rectangles. The previously delivered ground remains visible at the conservative
native boundary fringe. Neither family changes existing ground, source packets,
buildings, trees, the Spiegelwand or its inscriptions. This is a paving finish,
not an implementation of the proposed square redesign.

The existing surrounding tile floor is world Y3.0. The finish is only 25 mm
above it (Y3.025), with no raised kerb, new solid or new walking level. Both
source holes stay entirely open, as do all earlier mapped road surfaces. The
neutral tone and millimetric offset are display estimates, not surveyed stone
colours or an inferred historic paving pattern.

## Sources and preservation

- Retained Geofabrik Berlin OSM extract, 29 September 2026, ODbL-1.0:
  [relation/10741017](https://www.openstreetmap.org/relation/10741017), including
  `area:highway=pedestrian`, `highway=pedestrian`, `surface=paving_stones`.
- [Senate project account](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsplanung/fussverkehr/fussverkehrsprojekte/modellprojekte/hermann-ehlers-platz/),
  Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt: text reference
  distinguishes existing mixed paving from future redesign proposals.
- [District project record](https://mein.berlin.de/vorhaben/2024-00949/),
  Bezirksamt Steglitz-Zehlendorf / meinBerlin: project-status reference only.

No photograph, design plan, image pixel or photographic texture is used. The
exact source feature and world rings, old v182/v246 data hashes and all four
overlapping drawn/native packet hashes are retained in
`geo_data/regierungsviertel/hermann-ehlers-v247-evidence.json`.

## Integration and checks

`hermannEhlersV247Details.json` provides `surfaces` (same shape as v182), empty
`boxes`, and `nativeRows`. Append the surfaces before allocating the existing
Steglitz shell buffers and append native rows to the existing native instance
batch. Keep the earlier architectural edge pass restricted to original shells.
There is no new renderable, descriptor, material, runtime work or tour stop.
Complete drawn detail is identical on mobile. The new plane arrays require
8,748 B; native instance attributes add 10,868 B.

Focused tests replay the generator and preservation hashes, prove exact complete
drawn union and source-vertex retention, keep both holes empty, prove native cell
occupancy equality without overlap, and bound actual Three.js buffers.

Review view: eye `[-3515,42,6885]`, target `[-3500,3.025,6815]`.
