# BND public art and Otto-Weidt-Platz

## BND headquarters

The pair on the Pankepark side is Ulrich Brüschke's *0° Breite*. The federal
art inventory gives heights of 22.55 and 25.55 m, a 0.508 m painted steel mast
diameter and 5.60 m crowns. The drawn crowns use separate folded fronds and
the native crowns use independent cardinal cells. The anchors use apparent
centres in Berlin's spring 2025 orthophoto. The assignment of the shorter mast
to the higher terrace and the exact frond arrangement are display fits.
[Federal art inventory](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/0deg-breite-modified-cellular-towers)

Stefan Sous's untitled work occupies the Chausseestraße approach between the
gatehouses. Its 20 × 10 × 4.30 m envelope comes from the federal art inventory.
The authored folded surfaces express the rusty Corten steel, wide back,
irregular shoulders, small ground contact and raised end.
[Federal art inventory](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/o-t-skulptur)

Berlin DOP shows the western terrace and eastern approach open to the sky.
The resident lower BND shell formerly covered both art anchors with a flat
roof at 18.29 m in the drawn city and 19 m in the native city. The renderer
opens the two bounded visible domains using the existing exact raw and
prepared packet receipts. It retains the source records and each complete
outside triangle and ink complement at the existing centimetre resolution.
The existing mapped upper parts and three nearby retained building owners
remain outside the cut. The native openings keep half a cell diagonal of
clearance around those neighbouring source owners.

The terrace is fitted at 8.78 m and the approach plateau at 8.48 m in scene
coordinates. Public bDOM samples support these heights and the approach
grades through 7.47, 6.75 and 6.25 m. Interpolation and the short join to
retained 5.2 m terrain are display fits. The taller palm uses the delivered
5.2 m grade of its separate south court. The nearby official 3.83 m reading
would require an additional correction to that court's terrain. The model
depicts the publicly visible exterior and adds no new route into the site.

The two alignment images use 540 × 450 pixels over EPSG:25833 bounds
`[389922,5821655,390012,5821730]` and 876 × 870 pixels over
`[389745,5821530,389891,5821675]`. Their SHA256 values are
`c76848a815ca2419841991d7b9012e547040a2d279163caedb8030f2cb2e3bcb` and
`fdfb297903773b13672d2df6fec33c52e358fdae7f0984994fe8b32def2a68b3`.
The 14 bDOM response records have SHA256
`b79d2b11c1d221368e1ec78d3c0e3c6eaa338cd71c30e6d687ab273814c0ed33`.
The sources are published under Berlin's data licence (dl-de/zero-2-0).
The renderer uses procedural geometry and colour, with the original pixels
reserved for alignment. [Berlin orthophoto WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
· [Berlin bDOM WMS](https://gdi.berlin.de/services/wms/bdom)

## Otto-Weidt-Platz

The Berlin Senate describes the completed fountain as a rounded dark granite
water stone of about 16 × 8 m with small jets and spray. The model places a
low crowned stone, thin drainage slot, wet streaks and a representative spray
pattern over the original mapped location. The 0.65 m rise and sixteen nozzle
positions are display estimates. The existing mapped benches and plaza
landscaping continue to supply the surrounding scene.
[Berlin Senate as-built account](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/aktuell/artikel.1589135.php)
· [Project and landscape architect](https://www.nachhaltige-erneuerung.berlin.de/tiergarten-nordring-heidestrasse/otto-weidt-platz)

The full retained decimetre ring of OSM way 1313858079 identifies the one
drawn basin. The raised stone and its paved surround replace that basin's
generic plate, edge and ripple in the displayed scene. The fountain's named
material hooks participate in the existing presentation modes. Minecraft
matches the twelve retained basin-class cells and covers their exposed tops
with independently cardinal granite and paving. Jet geometry depicts one
static spray state in both families. [Mapped fountain](https://www.openstreetmap.org/way/1313858079)

## Validation

Reproduce the compact BND packet recipe and its complement evidence with
`uv run --no-sync python scripts/build_bnd_art_courts_v314.py`. The actual
packet decoder admits 33 drawn triangles and 15 ink segments for replacement,
and 978 native triangles. Both families retain the original packet sources
and every unrelated surface. Local tests raycast the two opened support
surfaces, all three pieces of art, and the east sightline from street height
with the original v174 recognition present. They also exercise the exact
fountain source match and native cap fallback.
