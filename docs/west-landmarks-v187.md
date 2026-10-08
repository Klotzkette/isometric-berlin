# Western landmarks — v1.0.87

The owner's 8 October extension adds an Olympic-site recognition model and a
first Citadel reading, and refines the existing Funkturm. Earlier city geometry,
Funkturm hairlines and the v182 deck glazing remain unchanged. This is a bounded
procedural architectural interpretation, not a new survey of every facade or
individual seat. No photograph, protected site plan or texture is distributed.

## Delivered reading

- **Funkturm:** the retained exact OSM anchor and 147 m profile carry physical
  fine crossed steelwork, four tapering legs, a slim central lift shaft, and
  framed restaurant and observation decks at the operator's 55/126 m levels.
  Beam sections and frame subdivisions are display estimates. This layer is
  additive; no prior Funkturm source or detail is suppressed.
- **Olympiastadion:** measured roof sheets and the western Marathon opening,
  pale stone colonnade, blue terraced seating, mapped athletics track and green
  infield. The main pitch stays below the surrounding plaza. Its exact outer
  ground opening uses the official enclosing owner boundary, not a bounding box.
- **Olympiapark:** exact mapped Maifeld and other sports pitches, swimming pools,
  athletics and bleacher sectors, and six slender gateway pylons. The eastern Preußen-/Bayernturm include their
  low source wings as separate parts, never giant tower-height wings. Generic source
  buildings, park vegetation and streets are supplied by the independent v187
  coverage layer. This module does not claim an interior reconstruction of all
  park buildings or an individual depiction of every seat.
- **Glockenturm:** the source plan and shaft height, with an open upper bell
  chamber, visible bell, corner piers, roof and parapet. The wider Langemarckhalle
  is a separate surrounding source building rather than one giant tower block.
- **Zitadelle Spandau:** the exact four-bastion fortress outline stays hollow;
  its mapped curtain wall does not fill the court or the moat. Complete official
  Juliusturm, Palas and gatehouse profiles supply the distinctive built masses.
  Other Citadel buildings remain in the surrounding coverage. The curtain's 8 m
  display height and sparse tower slit windows are not surveyed dimensions.

## Source inventory and explicit conflicts

The [bounded OSM selection](../geo_data/regierungsviertel/west-landmarks-v187-osm.json)
contains 79 source features from the retained Geofabrik Berlin extract dated
29 September 2026: 34 pitches, 10 track areas, six pools, 13 bleacher sectors,
two stadium boundaries and the named building/site records. OSM is ODbL-1.0;
the original extract's SHA-256 is retained. No raw extract is newly committed.

Twelve official Berlin LoD2 parents, from `LoD2_380_5819.zip` and
`LoD2_378_5822.zip` and `LoD2_383_5818.zip`, anchor the new hero owners. The
[complete original source profiles](../geo_data/regierungsviertel/west-landmarks-v187-source.json)
retain all parts and wall/roof sheets, original heights and per-file hashes under
dl-de/zero-2-0. The [owner exclusions](../geo_data/regierungsviertel/west-landmarks-v187-exclusions.geojson)
identify eleven exact OSM anchors plus twelve complete official parent-footprint
unions, retaining every source part and hole. The latter are necessary because
OSM C-shaped stadium rings omit the inner court and tiny pylon anchors omit low
source wings. Only matching newly introduced generic masses are replaced; all
previous city and tower detail remains.

The gateway towers preserve their complete three-part source families: the
roughly 3 m low wings remain low beside the 32.418/32.479 m measured shafts,
which take precedence over the unsurveyed OSM 36 m tags. The other four pylons
retain their explicit OSM height interpretation.

Three known coarse-source conflicts are resolved explicitly in the new models:

1. **Stadium voids.** Parent `DEBE04AL5LX00004` is a closed 56,125.991 m²,
   three-metre-high plate covering the full stadium, including the documented
   sunken pitch. Its original profile remains in evidence. Its active reading is
   an exact-boundary six-metre circulation rim at plaza level. The source roof
   sheets are preserved, while artificial canopy-to-ground vertical extrusion
   walls are limited to their upper 0.85 m fascia. Open colonnade/post geometry
   replaces those closed spaces below the canopy. This follows the operator's
   documented architecture; it is not a claim that LoD2 resolves roof supports.
2. **Bell chamber.** The Glockenturm parent is a closed cuboid. Its surveyed plan
   and 74.866 m shaft height are retained, while its upper 12 m are interpreted
   as the known open chamber and platform. Berlin's published 77.17 m whole-tower
   height uses a different architectural base; the two numbers are not silently
   treated as equivalent. Original source geometry remains in the receipt.

3. **Funkturm opaque shafts.** The new geographical extension initially supplied
   closed LoD2 owners `DEBE04YY500006Zr` and `DEBE04YY50002bpq`, hiding the existing
   tower's lattice. Their complete original source profiles and exact footprints
   are retained; only these new generic enclosing masses are replaced by the
   combined v179/v182/v187 steel/deck model. They do not remain invisible solid
   navigation volumes. No previous Funkturm detail is removed.

A common estimated plaza datum of NHN 67 m places the source pitch at
`y=-12.667` in the viewer. Thirty-six terrace rows are a compact display reading
of the bowl, not a seat count. The 24.65 m western opening follows the operator's
published minimum width. The colonnade rhythm is guided by its published 136
pillars, with the western opening kept free; local bay placement is estimated.

## Primary references

Checked on 8 October 2026:

- [Messe Berlin Funkturm facts](https://www.messe-berlin.de/de/veranstalter/locations/funkturm/fakten)
  and [2026 anniversary account](https://www.messe-berlin.de/de/presse/pressemitteilungen/news_21504.html).
- [Olympiastadion dimensions and structural facts](https://olympiastadion.berlin/en/facts-figures/)
  and [history of the open western roof](https://olympiastadion.berlin/de/geschichte/).
- [Berlin heritage inventory 09040530](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040530):
  Olympic site axes, towers, Maifeld and Langemarckhalle.
- [Berlin's Glockenturm account](https://www.berlin.de/sehenswuerdigkeiten/3561753-3558930-glockenturm.html).
- [District account of Zitadelle Spandau](https://www.berlin.de/ba-spandau/ueber-den-bezirk/tourismus/sehenswertes/artikel.288536.php).

The sources guide factual proportions and recognition. No internet image has been
traced, bundled or used as a runtime material.

## Delivery, navigation and validation

`uv run python scripts/build_west_landmarks_v187.py` reproduces the derived data
from the bounded committed OSM selection and the named official ZIPs in the
ignored cache. It changes only this feature family's own files.

The selected drawn representation has 44,077 triangles and 2,231 final-count
instances, across 12 independently culled feature/cell groups. Its position,
normal, colour and instance arrays total approximately 4.93 MB. The independent
Minecraft surface interpretation has 32,005 final-count instances (2.43 MB of
instance arrays), without a smooth duplicate or hidden volume fill. Exact
coalescing combines adjacent native surface boxes into runs. Only the active
representation is allocated. No textures, animations or per-frame model rebuilds
are introduced; touch and pointer use the same geometry.

The [stadium ground cutout](../geo_data/regierungsviertel/west-landmarks-v187-stadium-cutout.geojson)
uses the exact outer official source ring in CRS84. Its tiny navigation model
samples the same pitch, stepped bowl, west opening and rim. The separate
`westLandmarksV187Navigation.json` lists individual displayed solids rather than
invisible compound-parent envelopes; in particular the stadium roof does not
block the entire space below it.

Three focused Python tests verify exact owner exclusions/source receipts,
open pitch and finite bounded payloads. Two Bun tests (205 assertions) verify
frozen independent representations, final-count allocations and sunken-ground
navigation. TypeScript compilation passes. Standalone Chrome renders of all four
landmarks were inspected; no browser exception occurred. Complete integrated
viewer/device validation belongs to the release review, not this standalone check.
