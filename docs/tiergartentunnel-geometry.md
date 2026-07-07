# Tiergartentunnel Geometry

This note documents the v0.1.48 tunnel representation used by the
Regierungsviertel viewer.

## Status

The committed tunnel artefacts are an open-data engineering
approximation, not official surveyed as-built tunnel geometry.

The route is strong enough for the current isometric cutaway cue because
v0.1.49 includes derived OpenStreetMap `highway=trunk`,
`tunnel=yes`, `layer=-2` carriageway geometries for the named Tunnel
Tiergarten Spreebogen B96 ways, plus public portal coordinates, public
route descriptions and published cross-section facts. It must not be
described as amtlich vermessen until an official licensed CAD/GIS source
for the tunnel body is found and committed as a derived clipped artefact.

## Evidence Used

| Attribute | Current evidence | Viewer use |
|---|---|---|
| OSM tunnel carriageways | OpenStreetMap / Overpass ways tagged `highway=trunk`, `tunnel=yes`, `layer=-2`, `name=Tunnel Tiergarten Spreebogen` | Primary tunnel route evidence |
| Portals / route anchors | Public portal coordinates and route description for Tunnel Tiergarten Spreebogen | Centreline simplification and portal sanity check |
| Length | Published length around 2.4 km / 2392 m | Metadata and QA sanity check |
| Cross section | Published two-tube rectangular road tunnel facts: 10.5 m clear width per direction, 5.0 m clear height, 23.4 m total width | Schematic two-tube cutaway volume |
| Surface context | OSM roads, tunnels, footways, station passages and portals clipped to the Regierungsviertel | Alignment sanity check only |
| Depth | Not found as licensed official geometry in this repo | Schematic -10 m visual depth |

## Committed Artefacts

- `geo_data/regierungsviertel/tiergartentunnel.geojson` stores the
  WGS84 engineered centreline, technical metadata and the derived OSM
  carriageway evidence as a `MultiLineString`.
- `src/app/public/dzi/regierungsviertel/tiergartentunnel.json` stores
  the projected viewer overlay: centreline points, volume dimensions,
  lighting, ventilation / shaft markers and cross-section cues.
- `scripts/package_static_site.py` renders the zero-server
  `START-HERE.html` overlay from that payload.
- `src/isometric_berlin/generation/render_quadrants.py` renders the
  same kind of volume in deterministic source tiles when quadrants are
  regenerated.

## Rendering Rule

Draw the tunnel below the surface as a readable engineering cutaway:

- dark rectangular tunnel body;
- two separated tubes with a visible centre wall;
- side walls / floor guide lines;
- warm light points along the route;
- ventilation / shaft markers at portals and key service points;
- small cross-section marks at portals and intermediate service points.

If a future agent finds official tunnel-survey geometry, keep the same
public viewer semantics but replace only the approximate centreline /
volume evidence and update the `geometry_status` fields.
