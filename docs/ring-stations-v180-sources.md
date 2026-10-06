# Complete Ringbahn station outlines, v1.0.80

Pipeline step 3 adds only the owner-requested station outlines along the existing
finite Ringbahn supplement. It does not replace detailed city geometry or expand
other districts. Runtime preparation and thin-wire rendering belong to step 10.

## Sources and exact route

`geo_data/regierungsviertel/ring-stations-v180.json` is an additive EPSG:4326
artifact derived from the retained
[Geofabrik Berlin extract of 29 September 2026](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
OSM data timestamp `2026-09-29T20:22:51Z`, SHA-256
`9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9`.
Geometry is © OpenStreetMap contributors, ODbL 1.0. No additional citywide
download, imagery, building texture, architectural plan or proprietary map is
used. Extraction candidates and the small derivation helper remain gitignored
under `geo_data/regierungsviertel/raw/v180-ring/`.

The operator's [S41 line inventory](https://sbahn.berlin/fahren/s41/) and
[S42 line inventory](https://sbahn.berlin/fahren/s42/), checked on 6 October 2026,
establish the permanent **27 station identities** and opposite directions around
the same approximately 37 km geographical ring. Temporary service changes do not
change this source model's circuit. The inventory below follows S41 clockwise
from Gesundbrunnen.

The new artifact deliberately has `lines=[]`. Its `routeReference` points to the
existing `Ringbahn S41`, OSM relation `14981`, in
`outer-thin-outlines-v179.json`. The existing route is one closed, exact
**1,182-vertex / 36,962.298 m** line in EPSG:25833. It equals the lossless merge of
all **179 source relation geometry pieces**, including the northern, eastern,
southern and western arcs. No closing chord, alternate route or duplicate
S41/S42 line is added.

## Station footprints and identity

The supplement adds **117 source footprints for 24 stations**: 33 platform
polygons, 45 roof polygons and 39 station-building polygons. Gesundbrunnen,
Südkreuz and Westkreuz reuse their 30 v1.0.79 footprints, giving **147 station
footprints, including 46 platform polygons, for all 27 stops** in the combined
source. Reused footprints are explicitly referenced by ID, without duplicated
feature geometry. All new anchor names exactly match their footprint names.

Each anchor is an exact OSM S-Bahn `railway=station` or `railway=halt` node.
Separate U-Bahn nodes with similar names were excluded. The Ringbahn-specific
Südkreuz and Ostkreuz nodes are used; their broader interchange nodes are not
substituted. These source anchors are identity/evidence, not circular visual
markers. The artifact records the anchor OSM ID, every associated footprint ID,
the original relevant source tags and the shared official line URLs.

Station building, platform and roof selection uses reviewed mapped identities.
The cross-station platforms at Ostkreuz, Schöneberg and Jungfernheide remain part
of their actual interchange outlines. Nearby residential/commercial buildings,
tram and U-Bahn platforms and their roofs are excluded. In particular, the
Schönhauser Allee Arcaden retail envelope is not invented as a station roof: the
actual S-Bahn platform and mapped entrance roofs provide the station outline.
At Heidelberger Platz, the exact platform and small mapped roof/entrance buildings
are retained without inventing a full canopy. The v1.0.79 exclusion of the
ambiguous Südkreuz “Parkdeck Nord (geplant)” relation `1625451` remains in force.

| Station | Exact S-Bahn anchor | Platform relations | Roof/building footprints | Source |
| --- | --- | --- | ---: | --- |
| Gesundbrunnen | [node/1127966981](https://www.openstreetmap.org/node/1127966981) | 3721105, 3721106, 3721107, 3721108, 3721109 | 8 | v1.0.79 reuse |
| Schönhauser Allee | [node/316785013](https://www.openstreetmap.org/node/316785013) | 11764602 | 3 | v1.0.80 |
| Prenzlauer Allee | [node/3154211735](https://www.openstreetmap.org/node/3154211735) | 11764632 | 2 | v1.0.80 |
| Greifswalder Straße | [node/3659830181](https://www.openstreetmap.org/node/3659830181) | 4143255 | 3 | v1.0.80 |
| Landsberger Allee | [node/3872632789](https://www.openstreetmap.org/node/3872632789) | 6876977 | 4 | v1.0.80 |
| Storkower Straße | [node/21385751](https://www.openstreetmap.org/node/21385751) | 11764675 | 2 | v1.0.80 |
| Frankfurter Allee | [node/257981401](https://www.openstreetmap.org/node/257981401) | 11764689 | 4 | v1.0.80 |
| Ostkreuz | [node/5284961126](https://www.openstreetmap.org/node/5284961126) | 5660337, 5736596, 11765322, 11765323, 13391425, 13391428, 13391434 | 4 | v1.0.80 |
| Treptower Park | [node/261941954](https://www.openstreetmap.org/node/261941954) | 5705373, 5705374 | 7 | v1.0.80 |
| Sonnenallee | [node/3515302617](https://www.openstreetmap.org/node/3515302617) | 5567105 | 2 | v1.0.80 |
| Neukölln | [node/3515302614](https://www.openstreetmap.org/node/3515302614) | 6852415 | 2 | v1.0.80 |
| Hermannstraße | [node/3778075167](https://www.openstreetmap.org/node/3778075167) | 7028066 | 5 | v1.0.80 |
| Tempelhof | [node/1871042745](https://www.openstreetmap.org/node/1871042745) | 11764745 | 3 | v1.0.80 |
| Südkreuz | [node/1095078202](https://www.openstreetmap.org/node/1095078202) | 6844110, 13391543, 13391544, 13391549, 13391551 | 3 | v1.0.79 reuse |
| Schöneberg | [node/2808272930](https://www.openstreetmap.org/node/2808272930) | 3673123, 6863392 | 5 | v1.0.80 |
| Innsbrucker Platz | [node/670704963](https://www.openstreetmap.org/node/670704963) | 11764770 | 2 | v1.0.80 |
| Bundesplatz | [node/3779421874](https://www.openstreetmap.org/node/3779421874) | 5578529 | 3 | v1.0.80 |
| Heidelberger Platz | [node/348077013](https://www.openstreetmap.org/node/348077013) | 11764789 | 3 | v1.0.80 |
| Hohenzollerndamm | [node/26969275](https://www.openstreetmap.org/node/26969275) | 11764807 | 4 | v1.0.80 |
| Halensee | [node/670704950](https://www.openstreetmap.org/node/670704950) | 11764836 | 3 | v1.0.80 |
| Westkreuz | [node/34666754](https://www.openstreetmap.org/node/34666754) | 5550689, 6563940, 6563941 | 6 | v1.0.79 reuse |
| Messe Nord / ZOB | [node/2432622497](https://www.openstreetmap.org/node/2432622497) | 11764873 | 5 | v1.0.80 |
| Westend | [node/26124376](https://www.openstreetmap.org/node/26124376) | 11764889 | 7 | v1.0.80 |
| Jungfernheide | [node/4644994620](https://www.openstreetmap.org/node/4644994620) | 5377150, 5561156 | 5 | v1.0.80 |
| Beusselstraße | [node/29070457](https://www.openstreetmap.org/node/29070457) | 11764211 | 2 | v1.0.80 |
| Westhafen | [node/3876909305](https://www.openstreetmap.org/node/3876909305) | 11764220 | 3 | v1.0.80 |
| Wedding | [node/614445865](https://www.openstreetmap.org/node/614445865) | 5559039 | 1 | v1.0.80 |

## Source heights and rendering limits

Plan rings retain all source vertices rounded to seven decimal places, including
courtyards/interior rings; no bounding boxes or generic station symbols are
substituted. `height=0` for a platform means a flat plan outline, not a roof or a
surveyed absolute altitude. All untagged roofs use an explicitly labelled **5 m
illustrative height**, and untagged station buildings use an explicitly labelled
**8 m illustrative height**. OSM level and layer tags remain source metadata and
are not converted into surveyed elevations. Only explicit OSM heights are
labelled sourced: station building way `340688845` at Tempelhof is 6 m and roof
way `268567129` at Schöneberg is 10.8 m. The previously supplied hub heights retain
their existing provenance.

The new source must render as lightweight wires. Existing detailed LoD2/OSM
geometry remains eligible for display and refinement, including wherever it
coincides with these stations. The artifact identifies 14 station anchors within
the existing detailed bounds so runtime visibility can be checked against the
retained terrain: Gesundbrunnen, Schönhauser Allee, Prenzlauer Allee,
Greifswalder Straße, Landsberger Allee, Storkower Straße, Hohenzollerndamm,
Halensee, Westkreuz, Messe Nord / ZOB, Westend, Beusselstraße, Westhafen and
Wedding. This source-only extraction does not claim that a fixed display plane
is above every existing terrain or building surface, and does not relocate any
track or station to achieve visibility.

## Bounded source verification

The JSON records per-station coverage and source distances. All 27 stops have an
exact source platform outline and mapped roof/building outlines. Every footprint
is valid with closed exterior/interior rings. The 117 new feature IDs are unique
and none duplicates a v1.0.79 feature ID. Exact station nodes lie on or within
3.391 m of their represented station footprint union. The largest station-node
to S41-track distance is 31.222 m at Südkreuz, where the unchanged mapped Ringbahn
station node differs from the route track; the node has not been moved onto the
track. Other station-node to track distances are below 19 m.

The existing **262 A100 motorway/motorway-link/construction ways** were audited
as an exact source-node graph without edits. They form exactly two internally
connected components, with 141 and 121 ways, respectively. Both span the northern
and eastern endpoints, consistent with separated carriageways. No disconnected
intermediate fragment, missing internal source join or artificial straight
connector was found in this graph. Their IDs and component bounds are recorded
in the new artifact's `qa.a100`. The 20 mapped construction ways remain source
snapshot evidence, not a claim that these sections are presently open. The
30 proposed A100 ways remain excluded as documented in the
[v1.0.79 source record](outer-thin-outlines-v179-sources.md).

Bounded validation compared the ring against both the retained v1.0.79 line and
the original relation geometry, checked station coverage, polygon validity,
coordinate fidelity and ID uniqueness, and inspected the A100 graph. No whole
city pipeline, full test suite or production build was run for this source-only
subtask.

The five new platform polygons with negative `layer` tags were separately checked
against the S41 track, rather than classified by depth or shared station name.
Schönhauser Allee relation `11764602` explicitly carries
`light_rail=yes` and `description=S Schönhauser Allee S41 S42 S8 S85 Bahnsteig`;
its platform edge is 1.406 m from the Ringbahn track. The excluded elevated U2
platform is relation `5587153`, tagged `subway=yes`, `layer=1` and
`description=U Schönhauser Allee U2 Bahnsteig`. Likewise, the selected negative-layer
S-Bahn platforms at Landsberger Allee, Heidelberger Platz, Westend and Westhafen
are respectively 1.103, 1.173, 1.204 and 1.519 m from the exact S41 track.
These tags and distances are retained in `sourceTags` and
`qa.negativeLayerPlatforms`; a negative layer is not treated as evidence of a
U-Bahn-only footprint.
