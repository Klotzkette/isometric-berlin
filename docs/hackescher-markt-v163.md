# Hackescher Markt and Hackesche Höfe, v1.0.63

Step 10, inside the existing release bounds. The 93-stop tour is unchanged.

The replacement retains 29 official LoD2 parents and all 50 source parts:
all ground rings, courtyard voids, wall sheets and roof sheets are stored in
`hackescherMarktV163Source.json`. The drawn model uses their full geometry,
with a rigid elevation translation to the retained core terrain. Ten exact
old prism IDs are replaced; their original records remain in the payload.
No other building is suppressed by a geographic blanket.

The eight historical courts form an irregular connected complex, not eight
invented rectangular holes. Ten OSM `building_passage` paths open the lower
wall faces and the separate native skin. Their surveyed route is retained;
3 m clear width and 4.2 m height are explicit display estimates. Navigation
uses the same routes, bounded to the actual replacement parents. Upper walls
and roofs remain. No facade window is introduced across an opened passage.

Endell's first-court cream/cobalt glazed fields, green inlays, taller window
bands and shallow surrounds are reconstructed as flat coloured primitives.
The street front keeps the source footprint and roof silhouette, green glazing
and code-built lettering. Rear court windows and narrow plaster courses are
procedural readings of the source facades, not a measured window inventory.
The station keeps its actual roof/wall geometry, brick courses, terracotta
bands and round-headed glazing. Colour and small facade dimensions are visual
estimates. Photographs are reference evidence only, never bundled or sampled.

A source conflict was checked explicitly: old OSM prism `70063224` also spans
open through-track approaches. The western 384 m² sliver lies along rail ways
23809674/32590637, north of platform relation3724111. Every official building
parent intersecting the old envelope is already included, including the
separate canopy corresponding to OSM way377110613. The obsolete 9 m solid box
is therefore not restored over open tracks. Existing rail geometry is retained.

Both desktop and touch build the same complete drawn model: four submissions,
about 231,000 triangles including instances, approximately1.90 MB geometry and
instance buffers. Minecraft uses an independent surface-only cube skin and
mapped pavement cells: two submissions, approximately16,900 blocks and1.29 MB
buffers. Those figures describe these new components, not the whole viewer.
There are no per-frame constructors, textures or additional animation loops.

## Sources

- [Berlin LoD2 tile391_5820](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip), dl-de/zero-2-0; original archive SHA256 and unaltered source sheets retained.
- OpenStreetMap siteway337201828, stationway170063224, marketrelation6137529, the ten stored passage ways; ODbL, ©OpenStreetMap contributors. Current bounded API snapshot2026-10-01.
- [Hackesche Höfe architecture](https://www.hackesche-hoefe.de/de/architecture) and [history](https://www.hackesche-hoefe.de/de/history): eight courts, Berndt/Endell and the first-court ceramic facades.
- [Berlin monument register, station09011325](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011325) and [Berlin station description](https://www.berlin.de/sehenswuerdigkeiten/3560417-3558930-s-bahnhof-hackescher-markt.html).
- [East face of first court](https://commons.wikimedia.org/wiki/File:Berlin-mitte-hacke-hof1-osten.jpg), Bgabel, CC BY-SA3.0.
- [Street front](https://commons.wikimedia.org/wiki/File:Berlin-Mitte-hacke-hoefe-aussen.jpg), Bgabel, CC BY-SA3.0.
- [Station hall](https://commons.wikimedia.org/wiki/File:Hackescher_Markt_November_2013.jpg), Arild Vågen, CC BY-SA3.0.

Rosenthaler Platz is documented in `east-places-v163.md`, with its separate
bounded packet exporter and source preservation audit.
