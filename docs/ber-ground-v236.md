# BER: source-bound ground and streamed airport packets (v236)

Step 10 / 1.0.136 supplements the previous BER line drawing with complete mapped
runway pavement, aprons, taxiways, stand leads, public access, forecourt/parking
surfaces and the separately documented airport buildings. The airport is rendered
in 86 standard 512 m chunks, with independently built drawn and orthogonal native
geometry. No texture or permanent large scene root is added. Runtime geometry,
decoded-packet and resident-memory limits remain unchanged.

## Sources and extent

`geo_data/regierungsviertel/ber-ground-v236-source.json.gz` contains 2,305 complete
source objects in viewer metres. All 906 previous BER source geometries are
retained. The immutable inputs are the existing regional v200 archive and its
three retained OSM map responses; SHA-256 hashes and original URLs are recorded.
The scope is the mapped airport plus exact mapped terminal/parking building rings
and access roads. A selection envelope chooses source objects, but is never drawn
as an invented rectangle or filled urban area.

The source includes all 292 taxiway ways, 12 apron areas, 109 taxilanes and 188
stand-position objects, plus 1,174 road/path ways, 26 parking surfaces, 10 paving
areas and mapped water/vegetation. Underground rail/road objects remain in the
source and are not falsely painted at ground level. The four mapped terminal
station entrance footprints are excluded from new pavement. Canopies, bridges
and elevated connectors are not treated as ground-blocking buildings.

The north runway joins its full main and displaced-threshold source sections;
its pavement is about 3,600 × 45 m. The south runway is about 4,000 × 60 m.
Existing v205 labels **06L/24R** and **06R/24L**, threshold markings and centre
markings are retained above the new pavement. Ground datum remains 3 m, pavement
3.03 m and mapped yellow leads 3.05 m. The source `ele` value is not silently
mixed with the existing viewer datum.

Primary cross-checks: [FBB runway renaming](https://corporate.berlin-airport.de/en/company-media/media-portal/pressemitteilungen/2024-10-01-slb-umbenennung.html)
and [FBB airport facts](https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf).

## Explicit abstraction and limits

Runway widths are mapped. The available taxiway ways have no widths: their 23 m
pavement width is a declared display estimate, not a survey measurement. Untagged
road widths use the existing project lane/class rule. Taxilanes are drawn as
0.3 m leads on mapped airport pavement; no gate approaches, zebra crossings or
signals are invented. Stand nodes use small location markers.

E0 stays at ground level. E1 has a declared estimated 5 m storey separation;
connected upper ways inherit that height even where their ordering `layer` tags
differ. Source nodes shared with ground roads become ramp anchors, including
interior nodes. Drawn ramps interpolate along the mapped axis. Native ramps use
orthogonal 0.25 m height increments. This is a consistent cartographic level
model, not measured vertical engineering geometry. Navigation retains ground
movement at ramp footprints rather than adding an invented tall collision wall.

Native ground surfaces use fully contained 1 m cells and native leads use fully
contained 0.125 m cells, merged by rows. No diagonal drawn surface is reused for
the native style. Geometry is encoded at the normal centimetre packet precision.
The manifest footprint alone is normalized/simplified at **1 cm** to keep metadata
within its existing 2 MiB cap; neither render meshes nor per-packet navigation are
simplified by this metadata operation.

## Replay and checks

Run `uv run python scripts/build_ber_airport_v236.py`; `--refresh-source` rebuilds
the small replay archive from the retained raw files. The aggregate builder calls
`build_ber_airport_buildings_v236.build()` and emits new `ber236-*` packets plus
`ber-v236-manifest-addition.json`. The integration script owned by the main task
appends these descriptors and does not rewrite preceding city packets.

`tests/test_ber_airport_ground_v236.py` checks all previous source geometries,
station exclusions, full runway dimensions and preserved marking heights,
nonvanishing native leads, E0/E1 and every shared road-node height, packet hashes,
axis-aligned native faces, bounds, decoder byte accounting and unchanged limits.
The evidence records encoded bytes separately from actual decoded/GPU bytes.
