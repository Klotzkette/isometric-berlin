# Street surfaces around Gymnasium Steglitz

The Heesestraße route runs from Bergstraße to Albrechtstraße. Ten current OSM
road ways identify 308.27 m of carriageway. The separately named bus platform
belongs to another feature. The Albrechtstraße refinement covers 398.71 m of
the arterial east of the A103, including the Heesestraße junction and the
continuation toward Birkbuschstraße. The adjacent existing modeled A103
bridge and western Albrechtstraße approaches keep their own layers.

The 2014–2015 Berlin street survey provides the actual carriageway edges,
pavements, constructed parking bays and tree pits. The current named OSM
axes select the relevant survey features and limit shared intersection
polygons to the immediate approaches. The survey covers 302.61 m of the
current Heesestraße axis and the full selected Albrechtstraße axis. The
small remaining gaps follow the retained ground. The extracted input records
the survey and OSM hashes, identifiers, scope and both data licences.
[Geoportal Berlin street survey](https://www.geoportal.de/info/d4c0abae-dabe-34ec-9fb1-851b1f4af986) ·
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

The builder subtracts both existing building envelopes, previously paved
ground and measured local detail from the surveyed shapes. It adds 6,858 m²
of carriageway, 3,980 m² of pavement, 880 m² of constructed parking bays and
430 m² of tree pits in Drawn. The separate Native reading uses complete
half-metre cells and merges adjacent runs by material. Display colours and
the three to nine centimetre surface offsets are estimates. Street marks,
traffic controls and contemporary paint require separate current evidence.

The additions use one existing tile per display mode. They add no new
descriptor or rendering buffer. Four original flat ground triangles per display mode receive the same-colour,
same-height outside complement. Removing only the ground under the new
surfaces prevents flicker in aerial views. The retained terrain still supplies
the walking floor. Packed Drawn seam differences total 0.2433 m² and stay
within 25 mm of the original boundary. The Native complement matches its
source footprint exactly. The two V328 historic frontage recipes, the exact old
Postamt replacement and the previously published V320/V326 layers compose
with the surfaces in the actual tile decoder. The compiler can be replayed
with `uv run --no-sync python scripts/build_steglitz_streets_v328.py`.
