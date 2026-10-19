# Step 10 — ordinary-street complements v249

This bounded continuation adds positively mapped zebra crossings and raised
kerb courses to existing ordinary city packets. It changes no source packet,
building, navigation polygon, city boundary or descriptor.

The retained 29 September 2026 Geofabrik Berlin OSM snapshot supplies 249
previously unrepresented zebra-way candidates and 65 short raised-kerb
candidates inside existing streamed coverage. These are candidate counts, not
a claim that all 314 were missing visible features. Every published piece must
also lie on the actual delivered source ground in its own mode family.

The drawn result represents 155 distinct zebra ways and 41 distinct kerb ways
over 113 existing packet locations. Native independently represents 152 and
42 ways over 117 locations; native raster floors differ from drawn footprints.
Across both families the finite catalogue touches 126 existing locations.
Split ways account for 158/156 crossing contributions and 44/45 kerb
contributions respectively. Existing Alt-Mitte paint, boulevard paint, City
West details, earlier kerbs and source access gaps remain clear. This is a
targeted citywide complement, not reconstruction of every Berlin street.
The repaired source crossing `way/1266275581` at Friedenstraße is present in
both families; its native road support was previously wholly cut out by the
generic path sheet. The final payload is 1,041,619 JSON bytes and contains
270,504 drawn plus 477,798 native packed geometry bytes.

## Evidence and containment

- OSM `crossing:markings=zebra`, or an explicit legacy zebra tag, is required.
  Signal-only, unmarked and unspecified crossings never receive zebra stripes.
- A kerb needs `barrier=kerb` plus `kerb=raised|regular` or a positive tagged
  height. Only complete 2–120 m source courses are considered. Flush, lowered,
  rolled and untyped courses are excluded; explicitly tall boundaries above
  18 cm are left for complete obstacle modelling.
- Road paint is clipped to actual horizontal source `city` asphalt triangles
  with the retained road colour and top at 3.09 m. The old exporter gives path
  sheets priority and cuts them out of roads, including at tagged crossings.
  Only for the already selected zebra owners, the recorded original OSM road
  corridor intersected with the crossing band and actual 3.12 m path faces
  receives an asphalt correction at 3.15 m. Complete stripes sit at 3.18 m,
  above both original and corrected faces with a robust centimetre gap.
  Road widths use the unchanged original tagged-width/lane/class fallback
  policy, with that evidence tier retained per crossed road.
  This leaves every path outside that evidenced road intersection untouched;
  no grass, missing ground, rail sheet or other road footprint is replaced.
  Higher existing authored street floors and paint (including the Oranien
  corridor) are explicitly excluded rather than covered by a lower duplicate.
- Each curb is clipped against represented ground, original building footprints,
  earlier curb details, and mapped access clearances. Full native cells are
  separately checked against these openings. Unmodeled hills and raised street
  owners do not receive a floating copy at the ordinary ground datum.
- Original navigation remains unchanged. These low curb details preserve source
  access gaps; they do not create new walls or lift the surrounding ground.

Unsurveyed dimensions are explicit illustration estimates: a missing crossing
width uses 3 m; zebra bars and gaps use 0.5 m; kerb width is 0.22 m in drawn
mode, with an independent 0.5 m course rasterized into contained 0.25 m native
cells; unspecified kerb rise is 0.12 m above the inherited pavement datum.
No signal phase, traffic rule, new carriageway or unbuilt redesign is inferred.

## Lifetime and preservation

`CityStreetsV249.prepareCityStreetsV249` appends one already packed mesh only to
its matching existing packet and family. Origin, ground height and full ground
ring guard must match. Unknown packets do not decode the packed data field;
preparation yields before publishing and is idempotent. The constructor field
uses the existing lossless weak cache. The existing serial decoder combines the
extra faces into its original city batch, so there is no added scene root,
request, texture, animation, descriptor or draw call. Existing resident,
prefetch, transfer and vertex/index limits remain unchanged.

The source/evidence files record stable OSM identities, exclusions, original
packet SHA-256 receipts, emitted per-owner polygons, family counts and exact
output fingerprints. The generator never rewrites a source packet or manifest.
Tests check source eligibility, byte preservation, actual support, native axes,
complete access clearance, finite bytes, decode bounds, cancellation and
unrelated-packet no-op behavior. Independent downward rays through the complete
decoded packets check that repaired stripes are the actual top visible surface
in both families, rather than hidden below the retained path sheets.

Source credit: © OpenStreetMap contributors, ODbL 1.0;
[Geofabrik Berlin snapshot](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf).
No external image or new photographic source is used.
