# Task 02 — Fetch + clip Berlin LoD2 buildings

**Pipeline step:** 2 (see `AGENTS.md` §5)
**Status:** done
**Owner-set scope:** Implement `isometric_berlin.data.fetch_lod2` so
it downloads the smallest possible Berlin LoD2 CityGML subset that
fully covers the Regierungsviertel polygon, parses it, clips
building geometries to the polygon, and writes a small GeoPackage to
`geo_data/regierungsviertel/buildings.gpkg`.

## Acceptance criteria

- [x] Source: Geoportal Berlin LoD2 dataset
      (https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin).
- [x] Raw downloads land in `geo_data/regierungsviertel/raw/`
      (gitignored).
- [x] Output GeoPackage has at least one polygon per building plus
      height / roof-shape attributes preserved from LoD2.
- [x] No file larger than 5 MB committed to git.
- [x] No use of Google APIs.
- [x] CLI signature:
      `uv run python -m isometric_berlin.data.fetch_lod2 --bounds <geojson> --out <gpkg>`.
- [x] `uv run pytest` passes a smoke test that loads the resulting
      GeoPackage and asserts > 100 building polygons.

## Notes for agents

- Implemented against the official Berlin LoD2 ATOM service. The
  Regierungsviertel hull intersects eight 1 km EPSG:25833 tiles.
- Raw ZIP downloads remain under `geo_data/regierungsviertel/raw/lod2/`.
- The committed `buildings.gpkg` is clipped to the bounds and contains
  2614 LoD2 footprint records.
