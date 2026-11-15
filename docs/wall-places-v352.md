# Wall memorial inventory and Peter Fechter

The complete published [Berlin Wall Foundation map](https://www.stiftung-berliner-mauer.de/de/stiftung/karte-der-erinnerungsorte)
was captured on 15 November 2026: 196 records, comprising 68 information panels,
55 victim entries, 21 memorial places, 18 exhibitions, 18 artworks and 16 former
crossings. This is an inventory, not a claim that 196 monuments were rebuilt.

`wall-places-v352-source.json.gz` preserves the directory identities, categories,
links and coordinates. `wall-places-v352-osm.json.gz` contains only the 178 nearby
mapped memorial/current-wall candidates from the dated Geofabrik snapshot.
Proximity is explicitly not an automatic identity match. The per-record audit
keeps unresolved physical forms and the conflicting two Udo Düllick pins visible.
Historical 1989 border lines are never treated as surviving walls.

The added Peter Fechter steel column uses the exact mapped Zimmerstraße anchor
`node/3624148007`, the documented 2.60 m height and the cylindrical weathered-steel
form in the [memorial register photographs](https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/peter-fechter/841).
Diameter and colour are display estimates. Lettering and photographic pixels are
not copied. Native has an independent cardinal silhouette and collision solids.

The existing memorial controller admits it only on actual resident dry, clear,
level ground, checking all 25 footprint samples. Its admission disk is disjoint
from the existing Fontane and Hoffmann disks, so at most one memorial mesh and
material is resident; there is no new controller, timer or ground surface. Loss
of ground support, a mode switch or departure releases geometry and collision
together. The original grave dataset is byte-identical.

The Dieter Wohlfahrt cross in Staaken and the photographed Kliem/Schulze and
Schwietzer outer-ring steles remain explicit gaps: their exact mapped anchors
have no current resident ground. In Staaken the nearest retained ground ends
405 m away. They are not moved to nearby buildings or placed over empty space.
The detailed Bernauer Straße, East Side Gallery, Topography of Terror, Litfin
watchtower and Weiße Kreuze implementations are retained.

Validation: independent Drawn/Native real-Core-ground admission, exact collision,
full Native cardinality, wet/missing/blocked footprint rejection, disposal and
byte-identical prior models. The inventory and derivative are reproducible with
`uv run python -m scripts.build_wall_markers_v352 --check`.
