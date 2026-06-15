# Task 03 — Fetch + clip OSM context

**Pipeline step:** 3 (see `AGENTS.md` §5)
**Status:** done
**Owner-set scope:** Implement `isometric_berlin.data.fetch_osm` so
it pulls streets, water, parks, railway tracks, and POIs for the
Regierungsviertel polygon via Overpass (or OSMnx), clips them to the
polygon, and writes `geo_data/regierungsviertel/osm.gpkg`.

## Acceptance criteria

- [x] Layers in the output GeoPackage:
      `roads`, `water`, `parks`, `rail`, `pois`.
- [x] `water` must include the relevant stretch of the Spree.
- [x] `parks` must include the eastern Tiergarten strip.
- [x] `rail` must include the Hauptbahnhof tracks.
- [x] CLI signature:
      `uv run python -m isometric_berlin.data.fetch_osm --bounds <geojson> --out <gpkg>`.
- [x] Documented Overpass query string in `docs/data.md`.
- [x] Output file < 5 MB. If larger, drop unnecessary tags.
- [x] `uv run pytest` passes a smoke test that the GeoPackage opens
      and contains all five layers.

## Notes for agents

- OSMnx queries Overpass with the Regierungsviertel polygon and a
  descriptive `User-Agent: isometric-berlin/0.1 (Klotzkette)`.
- Normalized raw features are cached under
  `geo_data/regierungsviertel/raw/osm_overpass.json` (gitignored).
- The committed `osm.gpkg` is 1.4 MB and contains:
  `roads=3981`, `water=24`, `parks=296`, `rail=433`, `pois=1654`.
