# Bounds — Regierungsviertel

The MVP polygon is stored at
[`geo_data/regierungsviertel/bounds.geojson`](../geo_data/regierungsviertel/bounds.geojson).

## Landmarks (must be inside the polygon)

| Landmark | Approx. lat, lng |
|---|---|
| Brandenburger Tor | 52.5163, 13.3777 |
| Reichstagsgebäude | 52.5186, 13.3761 |
| Bundeskanzleramt | 52.5200, 13.3692 |
| Paul-Löbe-Haus | 52.5195, 13.3736 |
| Marie-Elisabeth-Lüders-Haus | 52.5197, 13.3760 |
| Berlin Hauptbahnhof | 52.5251, 13.3694 |
| Haus der Kulturen der Welt ("Schwangere Auster") | 52.5189, 13.3640 |
| Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz) | 52.5096, 13.3743 |

## Editing

A small Leaflet-based bounds editor (analogous to NYC's
`create_bounds.py`) is available:

```bash
uv run python -m isometric_berlin.generation.create_bounds
```

It starts a local Flask server on `127.0.0.1:8765`, shows OSM raster
tiles with the current polygon and the eight landmark markers, lets you
drag the polygon vertices, and saves back to
`geo_data/regierungsviertel/bounds.geojson`. The polygon is always kept
as a single, closed, simple polygon (no holes, no multipolygons).

The committed polygon was seeded from the convex hull of the eight
landmarks plus a ~180 m margin, then can be refined further in the
editor.
