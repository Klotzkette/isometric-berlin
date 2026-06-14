# Task 02 — Fetch + clip Berlin LoD2 buildings

**Pipeline step:** 2 (see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope:** Implement `isometric_berlin.data.fetch_lod2` so
it downloads the smallest possible Berlin LoD2 CityGML subset that
fully covers the Regierungsviertel polygon, parses it, clips
building geometries to the polygon, and writes a small GeoPackage to
`geo_data/regierungsviertel/buildings.gpkg`.

## Acceptance criteria

- [ ] Source: Geoportal Berlin LoD2 dataset
      (https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin).
- [ ] Raw downloads land in `geo_data/regierungsviertel/raw/`
      (gitignored).
- [ ] Output GeoPackage has at least one polygon per building plus
      height / roof-shape attributes preserved from LoD2.
- [ ] No file larger than 5 MB committed to git.
- [ ] No use of Google APIs.
- [ ] CLI signature:
      `uv run python -m isometric_berlin.data.fetch_lod2 --bounds <geojson> --out <gpkg>`.
- [ ] `uv run pytest` passes a smoke test that loads the resulting
      GeoPackage and asserts > 100 building polygons.

## Notes for agents

- If the Geoportal serves the data only as a citywide ZIP, document
  the manual download step in `docs/data.md` and have the script
  consume the local file.
- Keep the parser tolerant — Berlin LoD2 files have historically had
  minor schema inconsistencies.
