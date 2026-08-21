# Bounds — Regierungsviertel

The MVP polygon is stored at
[`geo_data/regierungsviertel/bounds.geojson`](../geo_data/regierungsviertel/bounds.geojson).

## Landmarks (must be inside the polygon)

The machine-readable catalogue in `landmarks.geojson` is canonical and
currently contains 93 checked places. It includes the government core and
Pariser Platz; Hauptbahnhof, Hamburger Bahnhof and Europacity; the full
Tiergarten to Charlottenburger Tor; Kulturforum and Potsdamer/Leipziger Platz;
and the southern extension to Anhalter Bahnhof, Kochstraße and the WELT
balloon. The north-east lobe additionally reaches Berliner Ensemble and
Berlin Friedrichstraße; transit/civic anchors cover the Hbf tram and S15,
Futurium, the federal ministries, Gropius Bau, Abgeordnetenhaus and Topography
of Terror. The catalogue also carries both Tiergartentunnel portals and the
approximate underground reference route.

The 89th record is the owner-supplied `Queer Rainbow Memorial Berlin` point at
Ahornsteig. It is retained as an explicit manual-review anchor because the
current bounded OSM extract does not yet contain a corresponding named feature.
Its position must not be confused with surveyed tree or memorial geometry.

The 90th record is the `Richard Wagner` memorial at exact OSM node
`243487615`. Its catalogue anchor is independently checked against the local
OSM extract and the official LoD2 footprint of its protective shelter.

The 91st record is the `Weidendammer Brücke` at the centre of exact OSM bridge
way `6228081`. Its catalogue anchor is independently checked against the local
OSM extract, while Landesdenkmalamt object `09030074` supplies the protected
bridge identity and ornamental-system evidence.

The 92nd record is `Bertolt Brecht` at exact OSM node `988668382`; the 93rd is
the `Scharnhorst-Grabmal` at exact OSM node `273120316`. Their catalogue
anchors remain separate from the surrounding Berliner-Ensemble and
Invalidenfriedhof ensemble focuses.

The separately modelled CSD memorial place at OSM node `14076715427` is not a
94th catalogue record. It remains an uncatalogued current detail distinct from
both the owner-supplied Queer Rainbow Memorial at record 89 and the 93-place
tour inventory.

All four shipped landmark payloads are synchronised at 93 records. The
alignment audit passes 41 relative-placement contracts and retains three
established manual-review anchors.

The current WGS84 extent is approximately `13.314761,52.493209` to
`13.407233,52.550987` (EPSG:25833 `385602.60,5817089.12` to
`391910.58,5823617.37`). Its 30.977 km² polygon is the exact additional 500 m
outward buffer of task-12 in EPSG:25833, with mitred joins and only 0.036 mm of
coordinate-rounding noise after conversion back to CRS84. The new ring adds
11.015 km² (+55.18%) around the prior 19.962 km² scene. The corresponding
versioned presentation radius is 6,450 m; it is a viewer/camera envelope, not a claim
that every point in that circle is surveyed.

## Editing

A small Leaflet-based bounds editor (analogous to NYC's
`create_bounds.py`) is available:

```bash
uv run python -m isometric_berlin.generation.create_bounds
```

It starts a local Flask server on `127.0.0.1:8765`, shows OSM raster
tiles with the current polygon and all required context markers, lets you
drag the polygon vertices, and saves back to
`geo_data/regierungsviertel/bounds.geojson`. The polygon is always kept
as a single, closed, simple polygon (no holes, no multipolygons).

The polygon began as a landmark-fitted Regierungsviertel hull and has since
been expanded through explicitly versioned tasks. Task-13 is the second
owner-requested 500 m context ring, now around every task-12 edge, rather than
a blanket Berlin-wide rectangle. `create_bounds --expand-by-m 500` reproduces
the metric operation, prints the old/new/ring measurements and exits. Every
fetcher and generated payload clips back to this exact geometry.
