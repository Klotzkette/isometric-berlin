# Sparse outer outlines, v1.0.79

Pipeline step 3 supplies only the owner-requested routes and recognition
outlines. This source artifact does not authorize general city geometry, alter
existing detailed layers or provide a new terrain survey. Runtime preparation,
the finite presentation bounds and rendering belong to the parent integration.

## Exact geographic evidence

`geo_data/regierungsviertel/outer-thin-outlines-v179.json` uses longitude/latitude
(EPSG:4326). It is derived from the already cached
[Geofabrik Berlin extract, 29 September 2026](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
containing OSM data through `2026-09-29T20:22:51Z`. The artifact records the source
SHA-256. Raw extraction candidates and the derivation helper stay gitignored in
`raw/v179/`; no new citywide download was made.

Geometry is © OpenStreetMap contributors, ODbL 1.0. Preserve the existing visible
OSM/Geoportal attribution. The footprint/way identities are retained per feature.
No imagery, protected architectural plans, texture, facade survey or LoD2
replacement is supplied.

- **Stadtautobahn A100:** all 262 mapped A100 motorway, motorway-link and
  construction ways in this finite source corridor. Twenty ways are explicitly
  tagged `status: construction`; they represent the mapped corridor and must
  not imply an operational road. Thirty proposed A100 ways are excluded. The
  present southern/eastern course includes the 16th section, opened on
  [27 August 2025 by Autobahn GmbH](https://www.autobahn.de/aktuelles/aktuell/freigabe-des-16-bauabschnitts-der-a100-wirkungsvolle-verkehrsentlastung-fuer-stadt-land-und-pendler).
  Temporary closure/construction tags are snapshot evidence, not live traffic.
- **AVUS A115:** 66 exact ways from Dreieck Funkturm to Spanische Allee. The
  endpoint is split at each carriageway's actual intersection with the mapped
  Spanische Allee line, near `[13.192515,52.433734]` and
  `[13.192737,52.433755]`. Relation `5485765` verifies the north-end route-member
  pieces. Ten additional exact motorway-link ways provide the connecting ramps
  to A100; their mapped destination tags identify A100/A115. No straight joins
  have been invented between separated ways. No A115 south of this endpoint is
  included.
- **Schloßstraße, Steglitz:** 103 exact source ways bearing the specific
  `wikidata=Q1238259` identity; similarly named streets in other districts are
  excluded. Both mapped carriageways are retained where separately mapped.
- **Ringbahn:** OSM S41 relation `14981`, assembled losslessly from all 179
  relation geometry pieces. Its result is one closed line measuring
  **36,962.298 m** in EPSG:25833. The circuit has no artificial closing chord.
- **Tempelhofer Feld:** exact park relation `7317281`, plus the four mapped
  segments of its two former runways (`280461165`, `280461166`, `569785910`,
  `593852001`). The latter are now mapped as footways. Runway centre-lines are
  evidence; a rendered width or edge offset remains a presentation choice.
- **Tempelhof airport terminal:** building relation `10466358`, retaining its
  exact exterior and all six interior courtyard rings. The airfield park and
  building remain separate footprints. A 25 m wire-envelope height is an
  explicitly labelled display estimate, not a measured building height.
- **Funkturm:** exact footprint way `30926247`; **ICC:** way `4706588`;
  **Steglitzer Kreisel tower:** closed building-part way `34782008`. The OSM
  GDAL driver returns the latter as a closed line because it is tagged as a
  building part; conversion to a ring preserves every vertex.
- **Stations:** Gesundbrunnen retains its station building, two main roof
  envelopes and five short platform roof strips; Südkreuz retains three main
  station building envelopes; Westkreuz retains its six mapped platform-roof
  envelopes. In addition, all five mapped platforms at Gesundbrunnen, five
  platforms at Südkreuz and three platforms at Westkreuz retain their exact plan
  outlines. These use `kind=station-platform` and zero height; they are not
  claimed to be roof footprints. Feature IDs are in the artifact. No surrounding offices, shopping
  centres, houses or proposed parking structures are included. The exact
  station nodes anchor Gesundbrunnen (`459277140`) and Südkreuz (`267379240`);
  other anchors are explicitly labelled footprint centroids. The ambiguous
  Südkreuz relation `1625451` is tagged building=train_station but named
  “Parkdeck Nord (geplant)”; it remains excluded. The three exact mainline
  platform relations `13391544`, `13391549` and `13391551` establish the true
  north–south station extent without that uncertain structure.

## Published dimensions and display estimates

The current [Messe Berlin operator page](https://www.messe-berlin.de/de/veranstalter/locations/funkturm)
gives the Funkturm's total height as **147 m**, matching OSM. Its
[facts page](https://www.messe-berlin.de/de/veranstalter/locations/funkturm/fakten)
places the restaurant at **55 m** and viewing platform at **126 m**.
Berlin.de's tourism page still describes 150 m including antennas; this conflict
is recorded rather than silently mixing heights. Use the current operator's
147 m envelope. Intermediate lattice bays, member thickness and platform widths
are procedural display estimates unless independently measured.

The [Berlin Senate's ICC account](https://www.berlin.de/sen/web/presse/pressemitteilungen/2024/pressemitteilung.1506447.php)
gives **313 × 89 × almost 40 m**, rather than the sometimes repeated
320 × 80 m. The exact mapped footprint controls plan shape. The 40 m display
roof envelope is rounded; roof sections and frame subdivisions are not a survey.

The [developer's Steglitzer Kreisel magazine](https://cggroup.de/wp-content/uploads/2024/12/CG_Magazin_12_single_opt.pdf)
and OSM both give **118.5 m**. The requested skeletal presentation is an
independently authored wire interpretation on the exact footprint, not a claim
to reproduce the current construction condition or structural engineering.

Only station heights explicitly present in OSM are treated as sourced:
Gesundbrunnen's main roof way `202968809` is 8 m; Südkreuz's main envelope
`381240728` is 21.6 m. Other station heights (5, 8 or 12 m) are labelled sparse
outline estimates. Flat park/runway height is presentation geometry.

## Bounded verification

The committed artifact contains 436 independent line records, 35 footprints
and eight landmark/station anchors, approximately 189 kB uncompressed. All
footprint exterior rings are closed and valid; terminal courtyards are preserved.
All retained coordinates are exact mapped source vertices rounded to seven
decimal places, except the two calculated AVUS crossing points. S41 source
pieces share their original endpoints and merge to a closed circuit. AVUS
junction additions are existing OSM ways, not interpolated paths. Source-only
work changed neither production code nor existing geography assets.

All three station anchors fall within the union of their mapped building/roof/
platform footprints (verified distance 0 m in EPSG:25833), without an artificial
anchor buffer.
