# Bounds — Regierungsviertel

The MVP polygon is stored at
[`geo_data/regierungsviertel/bounds.geojson`](../geo_data/regierungsviertel/bounds.geojson).

## Landmarks (must be inside the polygon)

The machine-readable catalogue in `landmarks.geojson` is canonical and
currently contains 73 checked places. It includes the government core and
Pariser Platz; Hauptbahnhof, Hamburger Bahnhof and Europacity; the full
Tiergarten to Charlottenburger Tor; Kulturforum and Potsdamer/Leipziger Platz;
and the southern extension to Anhalter Bahnhof, Kochstraße and the WELT
balloon. The catalogue also carries both Tiergartentunnel portals and the
approximate underground reference route.

The current WGS84 extent is approximately `13.3295,52.5022` to
`13.3925,52.5420` (EPSG:25833 `386626.58,5818111.23` to
`390908.90,5822592.07`). The corresponding versioned presentation radius is
5,130 m; it is a viewer/camera envelope, not a claim that every point in that
circle is surveyed.

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
been expanded through explicitly versioned tasks. The current task-10 lobe
keeps the requested central-Berlin places while avoiding a blanket Berlin-wide
rectangle. Every fetcher and generated payload clips back to this exact
geometry.
