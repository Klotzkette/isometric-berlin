# Nikolaikirchplatz and the church lanes

The public space around the Nikolaikirche follows 81 records from Berlin’s street
survey. They include the 590.41 m² small-stone forecourt in front of the west
portal, the walking strips on Propststraße and Nikolaikirchplatz, the west side
of Poststraße beside the square, the paved exit through Eiergasse and five planted
areas beside the church. The total surface represented is about 4,233 m².

The walking strips use the recorded natural-stone slabs or small setts. The
larger setts of the pedestrian carriageway and the gravel path beside the
southern chapel use their own finishes. Kerbs follow the survey polylines.
Transverse slab divisions occur only on long, straight strips of recorded
natural-stone paving. Slab lengths, stone shades and the illustrated kerb width
are estimates. The five survey holes in the forecourt retain their boundaries. The fountain recess contains a stone apron up to the outer survey line around the model’s octagonal steps. Small and large setts have
distinct joint spacing up close. The individual courses are illustrative and
fade out when a stone occupies only a few screen pixels.

The surveyed fountain footprint places the Gründungsbrunnen 3.7 m southwest
of its point in the public fountain register. Both the existing Wappenbrunnen
model and its collision body now sit at the polygon centroid. Seven short
backless benches follow the individual bench survey lines around the fountain.
The slats and metal supports approximate the photographed furniture.

## Sources and reproduction

- Berlin’s 2014–2015 street survey supplies the surfaces, kerb lines, bench lines
  and fountain footprint. The source archive contains the complete geometries and
  original properties of the selected features in EPSG:25833. The WFS window was
  (391859, 5819670, 392024, 5819763). [Street survey WFS](https://gdi.berlin.de/services/wfs/strassenbefahrung)
- The 2026 orthophoto was inspected for the church approaches and street alignment
  using the 240 × 210 m window around the church. [Berlin TrueDOP 2026](https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833&BBOX=391780,5819590,392020,5819800&WIDTH=1200&HEIGHT=1050&FORMAT=image/png)
- The photographed bench seats, paving and Wappenbrunnen can be seen at ground
  level. [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/wappenbrunnen-7845/)

Rebuild from the retained survey with
`python scripts/build_nikolaikirchplatz_v367.py`. Both projections share one
bounded draw call per active scene. Drawn uses triangulated measured outlines.
Native uses quarter-metre paving cells merged into strips and finer cardinal
blocks for bench slats. The embedded data is 33,524 bytes with ordinary gzip.
The viewer requests no survey service or photographic texture.

A camera at (2368, 58, 337) targeting (2415, 11, 291) shows the west portal,
fountain square and adjacent house fronts in one view.
