# Northern cemetery, community house and street refinements (v1.0.90)

Pipeline step 10. This bounded supplement preserves existing terrain, source
geometry, v185 brewery details, park trees/paths and the 93-stop tour. It introduces
no lower mobile quality level, textures, animation loop or extra residency budget.

## Named sites and measured sources

- Jewish cemetery Berlin-Weißensee: OSM way 6197783, full mapped perimeter,
  96 path/barrier records and four mapped tomb/memorial anchors. The entrance
  complex at way 156581840 retains seven official LoD2 parents and all roofs,
  including the lower wings and raised central volumes. Yellow brick and rounded
  opening cues come from the credited reference; the OSM `building=synagogue`
  label is retained as evidence, not treated as a current operating description.
- Jewish cemetery Schönhauser Allee: way 20461299, 19 mapped path records,
  twelve mapped grave/tomb anchors and the six measured parents of the modern
  Lapidarium (way 185763575). This is the cemetery near Senefelderplatz, distinct
  from Weißensee. Its documented high enclosure follows the exact plot boundary,
  interrupted by mapped paths and the Lapidarium. The 2.4 m wall height is an
  explicit display estimate. No invented grave names or inscriptions.
- Teutoburger Platz: way 23710933, 17 mapped paths and fifteen mapped benches.
  The small community building is the **Platzhaus**, way 121840587, operated by
  Leute am Teute e.V.; not a newly invented “Family House” service. Its complete
  measured hip-roof model, restrained brick/eaves and round-headed barred opening
  cues retain the actual footprint. Roof and openings are texture-free geometry.
- Kulturbrauerei: exactly the twenty source owners already identified in v185
  now show all measured walls and pitched roofs instead of coarse max-height
  prisms, plus thin source-edge roof members. All existing v185 brick pilasters,
  arches and courses remain. Courtyards remain unfilled.
- Kastanienallee: twenty exact road segments receive thin kerbs using the same
  source width policy as the surrounding city. Thirteen selected source owners
  receive restrained street-facing window/sill/eaves accents fitted below their
  true LoD2 roof edges. No invented shop names or new building envelopes.

Source evidence is `north-sites-v190-source.json`: retained Geofabrik Berlin
2026-09-29 OSM (ODbL-1.0), LoD2 tiles 392_5821, 392_5822 and 395_5822
(dl-de/zero-2-0), with archive hashes and original unsimplified surface rings.
The 34 substituted parents contain **72 source parts / 910 complete surfaces**.
The 66 facade rectangles are constrained to true wall planes, not roof envelopes.

The existing flat outer-city datum remains y=3; this update does not claim a new
cemetery terrain survey. Window/ironwork subdivisions, material shades, benches
and unnamed grave-field markers are procedural recognition estimates. The
1,653 Weißensee and 606 Schönhauser Allee grave-field markers are deliberately
**schematic representative markers, not surveyed individual graves**. They fit
inside the exact cemetery perimeter and stay clear of paths, buildings and the
sixteen separately mapped tomb/memorial anchors. The latter keep OSM identities
but still use restrained generic stone forms, not detailed individual sculptures.
No historical names or inscriptions were invented. This is not a catalogue of
all interments. Existing vegetation remains; no additional speculative trees.

## Source-owner substitution

`integrate_north_sites_v190.py` stages only the 27 existing coarse owners in three
current cells. Exact colour/position triangle and ink multisets must match before
anything is written. All navigation (including other buildings), roads, ground,
water, and every unrelated triangle remain byte-equivalent in content; the source
profiles remain committed. Results live in `raw/north-sites-v190/packets/`, with
`north-sites-v190-manifest-patch.json` and `north-sites-v190-ownership-audit.json`.
Seven new Weißensee owners are excluded by the northern coverage integration.

This does not regenerate whole city packets. The viewer consumes separate drawn
and native files. Native models use orthogonal surface skins and stepped openings,
not a rotated smooth duplicate. The pre-existing coarse navigation footprint is
retained conservatively; this pass does not claim newly enterable buildings.

## Primary factual and visual references

- [Kulturbrauerei history](https://www.kulturbrauerei.de/gelaende/geschichte/)
  and [named site buildings](https://www.kulturbrauerei.de/gelaende/lageplan/).
  Protected site plans were not traced.
- [Berlin Weißensee cemetery](https://www.berlin.de/sehenswuerdigkeiten/3560738-3558930-juedischer-friedhof-weissensee.html)
  and [heritage object 09046042](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046042).
- [Documented high cemetery enclosure](https://commons.wikimedia.org/wiki/File:Berlin-Prenzlauer_Berg_-_J%C3%BCdischer_Friedhof_Sch%C3%B6nhauser_Allee.jpg)
  (file-description factual context only; no image reproduced).
- [Schönhauser Allee Lapidarium](https://www.berlin.de/aktuell/ausgaben/2006/dezember/ereignisse/artikel.223566.php).
- [District Teutoburger Platz account](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513028.php)
  and [Platzhaus operator](https://www.leute-am-teute.de/platzhausvermietung/).
- Two freely licensed Commons photographs were inspected externally for the
  Platzhaus and Weißensee entrance. Exact authors, licenses and reference-only
  usage are in `north-sites-v190-credits.json`. No photographic pixels, graffiti
  artwork, inscriptions or protected site-plan graphics ship.

## QA and budget

Six Python source/containment/substitution tests and two Bun geometry/buffer tests
pass. Drawn: **30 calls, 7,230 instances, 13,251 stored vertices, 1,021,116 bytes**
of geometry/instance buffers. Native: **25 calls, 33,422 instances, 600 shared-box
vertices, 2,556,272 bytes**. All are divided into 25 spatial cells; the same detail
is available on touch and pointer devices. Both modes have exact-count instance
buffers, fixed transforms, valid bounds, and zero photographic textures.

Useful viewer-space camera targets (x,y,z), with 50–100 m close offset and
250–450 m overview offset:

| Site | Target |
|---|---|
| Weißensee entrance | 5945, 8, -2775 |
| Weißensee grounds | 6220, 5, -2440 |
| Schönhauser Allee / Lapidarium | 2860, 6, -1675 |
| Teutoburger Platzhaus | 2587, 5, -1430 |
| Kulturbrauerei | 2910, 12, -2210 |
| Kastanienallee | 2700, 12, -1770 |
