# Neukölln and Estrel facade relief, v345

This is a bounded material-detail pass on four existing sites, the SO36 portal,
and the built Estrel Tower with its mapped podium. It does not rebuild South
Berlin or claim a complete present-day exterior survey.

The Arcaden gain dark horizontal transoms, fine aluminium mullions and closely
spaced ribs in the upper facade. These follow the existing clipped glass panes
of the complete v305 model. The engineering contractor's exterior photograph
shows the distinction between the screened upper facade and the clear entrance
glazing. The photograph was published in 2019; its old tenant advertisements
are deliberately not used as evidence of current tenants. The centre's current
operator page confirms the Karl-Marx-Straße 66 site and the two public street
entrances. [TGA-Effizienz reference](https://www.tga-effizienz.de/details-dienstleistungen/berlin-neuk%C3%B6lln-arcaden-mit-cineplex-kino.html),
[current Arcaden operator](https://www.neukoelln-arcaden.de/).

The current postwar Hermannplatz department store gains narrow metal divisions
and pale stone reveals inside its existing windows. The surviving source body,
setbacks, shop glazing and old stone courses stay intact. The operator's current
page serves an exterior photograph bearing older Karstadt branding; it supports
the architecture, not a newly surveyed sign. No historic twin towers or proposed
reconstruction are introduced. [GALERIA Hermannplatz](https://www.galeria.de/filialen/l/berlin/hermannplatz-5-10/001101).

The Rixdorfer Schmiede's existing green shutters gain inset louvres and dark
straps. Their positions and total extents derive exclusively from the already
source-bound v210 shutter members. The four complete workshop/house/shed owners,
church, belfry, clocks, public furniture and the v304 Richardplatz/Schudomastraße
replacement remain intact. This does not imply that every shutter joint was
individually surveyed. Earlier sources and credits remain in
`docs/neukoelln-places-v210.md` and `docs/rixdorf-v304.md`.

The original Estrel Hotel's 1,494 existing window members gain pale stone
reveals, sills and opening-light divisions. The exterior photograph published
by Deutschlandfunk Kultur in 2022 is credited to **imago images / Schöning**.
It was inspected directly: the hotel has pale stone surrounds contrasting with
blue glass. It is evidence for architectural material, not a 2026 facade survey.
All original roof lines, source window panes and earlier hotel geometry remain
unchanged. [Exterior photograph and credit](https://www.deutschlandfunkkultur.de/hotel-estrel-berlin-energiesparen-100.html).

## Construction and limits

`NeukoellnFacadeDetailV345.ts` generates only small static box fittings. Every
result records its exact predecessor member index for verification. The new
Arcaden members remain within their host pane in the two facade dimensions.
Native fittings use the actual existing cardinal pane/shutter boxes, rather
than rotating the Drawn relief into a second new facade. Previous geometry is
not removed, translated or recoloured. Small section widths and material tones
are explicit photographic estimates. No photograph, texture, remote map request,
new animation, tour stop or residency budget is added by these facade fittings.
The separate built tower has its own source-bound collision described below.

Activation is explicit: `facadeDetailV345: true` in the v305 and v210 options,
and the seventh boolean in `createCityRecognitionV182`. Historical default
factory output stays unchanged. The V305 completeness receipt includes the new
members in its existing private buffer/material validation. Drawn and touch
receive identical construction. Counts: Arcaden 3,897 Drawn / 3,628 Native;
Hermannplatz and Schmiede 1,856 / 5,312; Estrel 5,976 / 5,976. No new runtime
JSON packet is shipped for those four facade helpers.

## Wider request audit and outstanding evidence

- Richardplatz and Schudomastraße already use 70 addressed families and 217
  complete official parts in v304. Their roofs, courtyard openings and the
  separate church/smithy bodies are retained. This pass adds only shutter relief.
- Karl-Marx-Allee already retains 41 fixed LoD2 parents / 185 parts in v161,
  including the distinct Strausberger Platz and Frankfurter Tor portals.
  Computerspielemuseum, James June and the documented fountain interpretation
  are handled by v316. No geometry change is made there in this subtask. This is
  distinct from **Karl-Marx-Straße** in Neukölln.
- Hasenheide already has mapped Rosengarten edging, Naturtheater seating/stage,
  cinema screen and Hasenschänke furniture in v294. No new terrain correction or
  all-park photographic survey is claimed here.
- Huxleys has its complete official v238 exterior, clipped upper windows and
  v294 stucco surrounds. A directly inspected entrance photograph shows red
  doors, a black nameboard and a light glazed canopy. Its precise entrance host
  is not recorded in the retained v238 source (`entrances` is empty), so this
  subtask does not pretend to have placed that additional entrance correctly.
  The independent follow-up audit is in `docs/huxleys-entrance-v345-audit.md`;
  the current mapped entrance belongs to the neighbouring property, not this
  source body.
  [Operator address and current venue](https://huxleysneuewelt.de/media),
  [inspected entrance photograph](https://www.morgenpost.de/berlin/article404286900/huxleys-neue-welt-parken-anfahrt-garderobe-programm.html).

## SO36: the actual Oranienstraße 190 portal

The current OSM map API resolves SO36 node `4034138645` and address building
`37739079`. The real retained LoD2 host is `DEBE02YY40000ARY` in the V167
Oranien corridor part of packet `6_4`. The source front bay runs from
`[3394.09,2132.45]` to `[3398.38,2134.46]`, ground Y=3 and wall top Y=21.85.
The corresponding Native front uses the actual cardinal face Z=2132,
X=3394..3398. A photograph on visitBerlin, credited to **Prokura Nepp**, was
inspected directly. The addition depicts the dark rectangular portal, pale
surrounds, flanking poster cases and a pale SO36 lightbox. Letter shapes and
posters are procedural; no poster artwork or image pixels are reproduced.
Portal and sign dimensions and their fit to the POI's front bay are estimates.
The neighbouring arched doorway, shops and all upper floors are unchanged;
there is no claim of a newly modelled traversable club interior.

`So36FrontV345.ts` uses the existing lazy SourceQuarter catalogue. Its receipt
pins all actual original and prepared geometry, colours, indices, linework and
navigation. It adds only one small mesh: 780 Drawn triangles or 2,484 independent
cardinal Native triangles. It retires no earlier triangle, building, roof or
navigation entry and has no separate scene lifetime.
[Operator access information](https://www.so36.com/uploads/so36/skin/asset/file/64846/SO36_Getting_There.pdf),
[photographic reference / visitBerlin](https://www.visitberlin.de/de/so36).

## The built Estrel Tower

The original old inventory did not contain a tower footprint; way `32664053`
was a construction-site envelope and was not used as a tower. A fresh bounded
OSM map extract on 14 November 2026 supplies actual `building:part` ways:
`1017413851` (tower, 176 m, 45 storeys), `1017413850`, `1535787743`,
`1535834587` and `1535834588` (podium/atrium), raised glass roofs
`1390408048` and `1535834586`, and the low concave plinth `1390408051`.
The complete eight-part inventory is checked against every relevant
`building:part` in the archived source XML; their union covers the parent
envelope. All eight source rings and their
heights, mono-pitched roof heights and directions are retained in
`estrelTowerV345.json`. They are mapped dimensions, not an asserted official
survey. The tower's roof height difference is 26 m; its shape is not a flat
176-m box. The display ground datum Y=3 is an explicit estimate, independently
checked against the existing packet's ground surface.

The architect's actual August 2026 aerial exterior, credited to
**Barkow Leibinger / Nils Könning**, supports the dark glass, fine vertical
mullions, floor transoms and paired aluminium ribbons with alternating lean.
Their pitches, thin sections and material tones are visual estimates. A second
whole-building photograph on Nils Könning’s own 2026 project page shows the
distinct pale metal-clad halls and glazed atrium. The model therefore uses
pale ribbed metal for the three hall parts, a dark plinth and a triangular
colour subdivision on the existing atrium roof plane. The two parts tagged `construction=roof`, `roof:material=glass`, `layer=1`
are represented as raised glass roofs with an explicitly estimated 0.18 m
vertical thickness. They are not extruded from the ground: the sloping roof
has a varying underside; the flat roof and independent Native cells keep
their corresponding clearances. The 3 m part is a low solid plinth. Its
concave source ring uses real polygon triangulation, avoiding false triangles
across its recess. This does not turn all podium walls into glass or claim
to survey every roof fold. Roof and wall
vertices follow the mapped rings and roof planes. Native uses its
own two-metre cardinal footprint cells and stepped facade fittings; it does
not rotate Drawn columns into a voxel model.

`EstrelTowerV345Navigation.ts` uses the same roof planes and the same Native
cells and, for the two glass roofs, the same raised underside as the visible
model. The factory is used to bake one finite complete
SourceQuarter replacement in `ring182-11_10`; it is not a second always-resident
Outline landmark. Geometry, old-proxy retirement and new navigation share the
same verified packet transaction and existing streaming lifetime. Changed or
partial predecessor geometry keeps its original owners instead. Existing
hotel geometry remains intact. The exact two construction proxies and the
preserved outside source owners are documented in
`geo_data/regierungsviertel/estrel-tower-v345-ownership.json`. The two exact
old 9 m Drawn / 8 m Native construction proxies (way `1535834585` and
relation `21070307`) are fully superseded by all eight mapped parts. Their
arbitrary uniform parent extrusion is replaced by the actual tower, halls,
atrium, raised roofs and low plinth, including the previously overlooked
1,026 m² of the parent footprint. This
retires 53 Drawn / 1,016 Native triangles and 19 Drawn roof-line segments;
other source buildings, ground, roads, paths and navigation remain intact.
The dedicated packet tests exercise the actual production decoder, visible
roof versus collision heights, unchanged outside navigation and lossless
reconstruction after weak-cache expiry.

The operator states a soft opening on **1 December 2026**, after the audit.
The exterior represents the built tower without claiming it is open.
[Architect project](https://barkowleibinger.com/en/architecture/estrel-tower),
[actual aerial photograph, Nils Könning](https://barkowleibinger.nbg1.your-objectstorage.com/7335/conversions/260804-estrel-b-l-aerial-dji-0172-nils-koenning-large.jpg),
[Whole-building photo, Nils Könning](https://nilskoenning.com/architecture/estrel-tower-barkow-leibinger/),
[Schüco built exterior](https://www.schueco.com/de-en/architects/references/estrel-tower-4307),
[operator FAQ](https://www.estreltower.com/faq),
[bounded current OSM map](https://api.openstreetmap.org/api/0.6/map?bbox=13.4575,52.4699,13.4605,52.4726).

## Checks

The focused v345 tests check immutable input data, exact previous instance-buffer
prefixes, untouched measured source geometry, facade bounds, independently
cardinal Native matrices, complete V305 private admission and identical touch
construction. The three additional tower/SO36 tests check mapped tower height
and roof extrema, matched cardinal navigation cells, bounded construction storage,
private completeness, exact retained SO36 source geometry/nav/lines and closed
admission on changed or wrong packets. All seven focused facade/model tests passed. They also verify both raised-roof
undersides by raycasting and compare the triangulated plinth area to its
concave source ring. Existing v182 and v210 geometry
tests passed. The complete v305 suite passed its geometry, private admission, lifetime,
six-mode and actual cold-boot hook tests after integration.

Photographs were downloaded to a temporary reference directory for inspection
only. The evidence ledger contains URLs, credits and SHA-256 values; no image
pixels are committed or included in the public viewer.
