# Task 03 — Fetch + clip OSM context

**Pipeline step:** 3 (see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope:** Implement `isometric_berlin.data.fetch_osm` so
it pulls streets, water, parks, railway tracks, and POIs for the
Regierungsviertel polygon via Overpass (or OSMnx), clips them to the
polygon, and writes `geo_data/regierungsviertel/osm.gpkg`.

## Acceptance criteria

- [ ] Layers in the output GeoPackage:
      `roads`, `water`, `parks`, `rail`, `pois`.
- [ ] `water` must include the relevant stretch of the Spree.
- [ ] `parks` must include the eastern Tiergarten strip.
- [ ] `rail` must include the Hauptbahnhof tracks.
- [ ] CLI signature:
      `uv run python -m isometric_berlin.data.fetch_osm --bounds <geojson> --out <gpkg>`.
- [ ] Documented Overpass query string in `docs/data.md`.
- [ ] Output file < 5 MB. If larger, drop unnecessary tags.
- [ ] `uv run pytest` passes a smoke test that the GeoPackage opens
      and contains all five layers.

## Notes for agents

- Respect Overpass etiquette: one request, reasonable timeout, set a
  descriptive User-Agent like `isometric-berlin/0.1 (Klotzkette)`.
- Cache the raw Overpass response under
  `geo_data/regierungsviertel/raw/osm_overpass.json` (gitignored).
