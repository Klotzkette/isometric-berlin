# Economic ministry: open courts, old roofs and the new solar wing

Pipeline step 10, 10 September 2026. The correction keeps all six original
prism records and their footprints; it does not enlarge or rotate the campus.
The viewer's previously permanent mobile bounding boxes concealed the actual
courtyards and facade details. The replacement now starts with source-bound
architecture rather than those envelopes.

## Evidence and source conflicts

The five official parts come from the [Geoportal Berlin LoD2 tile
389_5821](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5821.zip), dated
2 March 2026, under dl-de/zero-2-0. `economicMinistrySource.json` preserves
328 original wall, roof and closure surfaces. Their coordinates retain the
original easting/northing and are translated vertically by each original
prism's viewer ground minus the source minimum ground. Each translation is
recorded separately; it is not a new ground survey.

- `yAAWS2KQ` keeps the two original asymmetric pitched roof planes of the
  long modern wing, parallel to the canal.
- `K0000EU2` and `K0000B4S` keep the six and four original hip-roof planes
  of the two older Invalidenhaus wings.
- `K0000A7g` keeps its three separate original roof planes.
- `K00008CN` retains the exact main-house footprint and all eleven holes.
  Its original LoD2 roof is genuinely a single flat surface at 50.685 m
  above the source datum. That surface remains recorded in the supplement,
  but is not displayed as a broad roof plate.
- The older OSM-derived podium `-3202585` retains all five courtyard holes,
  its original footprint and nine-metre height. It remains a separate lower
  part beside the taller modern wing.

The [official 2025 spring DOP](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected using layer `dop_2025`, EPSG:25833, bounds
`389520,5820990,389840,5821380`, at 1280 × 1560 pixels. It confirms the
old red roof wings, separate courts and continuous narrow photovoltaic strip
on the canal-facing slope of the modern tall wing. No raster is shipped or
loaded by the viewer.

For `K00008CN`, the DOP conflicts with the flat source roof: it shows pitched
perimeter and courtyard wings. The display subdivision fits continuous roof
bands to the retained footprint and its eleven openings, rising from the
procedural 18.85 m eave to the retained 23.50 m envelope top. Exact local
pitches, ridges, roof-light positions and the division between tiled and flat
inner roof fields are not surveyed. The original flat source surface remains
available in the supplement, making this source conflict explicit.

The [ministry's architecture account](https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Textsammlungen/Ministerium/architektur.html),
[the federal Buildings E, F and G record](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/gebaude-e-f-und-g-ehem-invalidenhaus)
and [Berlin monument record 09011190](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011190)
retain the distinction between the main house of the former
Kaiser-Wilhelm-Akademie, the older Invalidenhaus wings and their canal-side
replacement building. No new Wikimedia photograph or copyrighted facade plan
was used.

## Presentation and geometry limits

The source roof supports the new solar strip directly. Its 447 visible tiles
are procedural divisions of the DOP-confirmed strip, not an asserted count of
installed modules. The 2.8 m strip width and framing gaps are display estimates.
All four bottom corners of every tile sit above the actual pitched source
plane and stay within the modern wing. The strip is not laid over a courtyard
or across the podium.

The main house has 640 individual source-edge windows: its existing 60
street-front windows plus 580 additional side and court windows. The two
historic wings retain 240 framed windows. The modern canal frontage has 176
windows; its four displayed rows and the shorter court rows fit below the
recovered roof eaves. Storey spacing and local trim remain procedural, not
surveyed dimensions. The lower modern part gains its own canal and court
window bands. The historical and modern parts therefore remain distinguishable
from above and at street level.

Day, Night, Snowstorm and Schwellenraum use the same source geometry and
existing lighting integration. Minecraft replaces the coarse source columns
with thin source-aligned wall blocks and bounded stepped roof tiles. All
sixteen source courtyards remain open. The original block-native facade layer
is retained for the principal elevations; the new source layer adds the
remaining main-house court windows and low-wing details without smooth doubles.

The Minecraft layer uses one instanced draw call: 26,586 blocks / 2,021,184
bytes on desktop and 18,480 blocks / 1,405,128 bytes on mobile. Adaptive edge subdivision rejects roof tiles
whose corners would enter a courtyard or leave the source footprint. Partially
intersected eave cells are subdivided even when their initial centres lie
outside. Roof-block thickness follows local source slope and actual adjoining
step heights, with a 0.16 m vertical overlap; a spatial edge hash matches
regular and adaptive neighbours. This closes diagonal-view gaps without
changing roof tops or filling the building interiors. Solar
rows and source plans are the same in both profiles. The drawn complete model
uses five renderables, 115,162 stored vertices and 2,178,408 bytes of geometry
and instance attributes. Neither profile fills hidden interior volume.

Global and per-part plan bounds reject remote voxel columns before polygon
intersection. An eight-metre roof-triangle lookup grid bounds roof sampling,
including collision queries and block construction. At retained decimetre-plan
edges, a maximum 0.1 m projected source-triangle edge lookup resolves rounding
differences; points outside the source plan still return no roof. Native solar
tiles are seated above the actual stepped support blocks, so roof steps cannot
bury a module even when the corresponding smooth roof is lower.

## Reproduction and checks

`scripts/build_economic_ministry_source.py` rebuilds the compact supplement
from the retained prism JSON and the named official ZIP. Raw data remains under
the ignored `geo_data/regierungsviertel/raw/lod2/` directory. The script retains
all five source parts and derives only the documented main-house roof bands;
it does not modify the canonical prism records.

The regression suite checks exact original prism equality, all retained courts,
all solar-tile corners against the source roof, downward ray visibility through
the sixteen courtyard interiors, source-cell replacement and every native roof
tile corner in both profiles. Isolated pairs of actual native roof instances
also receive short oblique rays into their connecting steps. The corrected
regular and adaptive steps block these rays; resetting their thickness to the
previous 0.64 m reproduces the open gaps without a wall or podium masking them. Main-house facade tests check source preservation,
window counts and bounded geometry. These are geometry checks, not a claim of a
physical iPhone or browser GPU test.
