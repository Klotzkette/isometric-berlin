# Tiergartentunnel Geometry

This note documents the v0.3.0 tunnel representation used by the
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
| Depth | Not found as licensed official geometry in this repo | Schematic -12 m visual depth |

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
- `src/isometric_berlin/generation/render_overview.py` loads that route into
  the committed global DZI. It draws only the engineered centreline; the 13
  OSM carriageways remain evidence and are not rendered as overlapping
  duplicate tunnel bodies.

## Rendering Rule

Draw the tunnel below the surface as a readable engineering cutaway:

- interrupted twin-tube outlines in the global DZI, so the route cannot be
  mistaken for an elevated road and does not cover water, paths or vegetation;
- dark rectangular tunnel body in the dedicated local underside overlay;
- two separated tubes with a visible centre wall;
- side walls / floor guide lines;
- portal frames at the north and south visible endpoints;
- ceiling ribs and lane / tube guide marks for the underside view;
- small service-bay / emergency-cue boxes along the route;
- warm light points along the route;
- continuous safety-light strips and denser ceiling fixtures in true 3D;
- paired road decks, dashed lane guides and visible ventilation fan blades;
- instanced repeated fixtures, reducing lamps, lane marks, shafts, fan rings
  and four distinct blades per fan to five draw calls;
- ventilation / shaft markers at portals and key service points;
- small cross-section marks at portals and intermediate service points.

The local `START-HERE.html` package includes an underside mode. It is a
2D SVG / CSS cutaway transform, not a true 3D camera, but the tunnel
layer remains attached during pan, rotate and swivel interactions so the
route can be inspected from below.

In the true Three.js viewer the tunnel group remains loaded but is hidden in
the normal exterior view. Crossing 90 degrees of polar orbit by mouse, touch,
keyboard or the underside preset automatically fades the official surface and
reveals the tunnel casings, roads, lights, lane marks and ventilation cues. The
zero-server fallback follows the same visibility rule, and its Tunnel focus
control enters underside mode before centring the route. The mode therefore
follows the real camera angle instead of depending on one special button path.

If a future agent finds official tunnel-survey geometry, keep the same
public viewer semantics but replace only the approximate centreline /
volume evidence and update the `geometry_status` fields.
