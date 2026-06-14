# Task 01 — Bounds editor for the Regierungsviertel polygon

**Pipeline step:** 1 (see `AGENTS.md` §5)
**Status:** done
**Owner-set scope:** Provide a small, local Leaflet-based polygon
editor (Python Flask + static HTML, analogous to the NYC project's
`create_bounds.py`) that loads
`geo_data/regierungsviertel/bounds.geojson`, lets the owner refine
the polygon visually, and saves it back to the same path. No
networked persistence, no external services.

## Acceptance criteria

- [x] `uv run python -m isometric_berlin.generation.create_bounds`
      starts a local server on `127.0.0.1:8765`.
- [x] The map shows OSM tiles (standard.openstreetmap.org) and
      overlays the current `bounds.geojson` polygon.
- [x] All eight landmarks from `landmarks.geojson` are shown as
      markers and must visibly stay inside the polygon after editing.
- [x] "Save" writes back to `geo_data/regierungsviertel/bounds.geojson`
      as a valid GeoJSON FeatureCollection with the same `name` and
      `description` properties.
- [x] Attribution overlay visible on the map:
      `© OpenStreetMap contributors`.
- [x] `uv run ruff format . && uv run ruff check . && uv run pytest`
      all pass.

## Notes for agents

- This is a developer tool; no need to make it pretty.
- Do not fetch any data beyond OSM raster tiles.
- The bounds polygon should always be a single, closed, simple
  polygon (no holes, no multipolygons).
