# Task 05 — Source-fusion manifest

**Pipeline step:** 6 (see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope:** Implement `isometric_berlin.data.fuse_sources` so
that it produces a single fused source-stack manifest at
`geo_data/regierungsviertel/fused_sources.json`, combining all
permitted sources that are available at fusion time:

- `geo_data/regierungsviertel/buildings.gpkg` (LoD2, required)
- `geo_data/regierungsviertel/osm.gpkg` (OSM, required)
- `geo_data/regierungsviertel/raw/alkis/` (optional)
- `geo_data/regierungsviertel/raw/dop/` (optional)
- `geo_data/regierungsviertel/raw/dgm/` (optional)
- `geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json`
  (optional, opt-in)

## Hard rules

- **Additive fusion only.** A source that is missing or unavailable is
  recorded as `available: false` with a clear `reason`. **Do not
  silently drop** any permitted source.
- **Conflict log, not silent winners.** When two sources disagree on
  an attribute that matters, write both values into the per-feature
  evidence list AND log the conflict in `conflict_log`. The winning
  value is chosen via the ranking table in `docs/data.md`; the losing
  value stays available.
- **Google is additive.** Even when Google is available, Berlin LoD2
  remains the building-footprint anchor and OSM remains the semantic
  anchor. Google can win on textures, roof complexity, and visual
  reference; it cannot override LoD2 footprints or OSM names.
- **Bounds discipline.** Only features whose geometry intersects
  `bounds.geojson` are included.
- **No API keys in the output.** The Google sub-manifest must have
  been written by `fetch_google_tiles` with the key stripped.

## Acceptance criteria

- [ ] CLI signature:
      `uv run python -m isometric_berlin.data.fuse_sources
      --bounds geo_data/regierungsviertel/bounds.geojson
      --out geo_data/regierungsviertel/fused_sources.json`.
- [ ] Output JSON matches the schema documented in
      `docs/data.md` ("Fused source-stack manifest"): top-level
      `bounds_ref`, `generated_at`, `sources` (with per-source
      availability + license), `features` (with per-feature
      `anchor_source`, `geometry_evidence`, `semantic_evidence`,
      `conflicts`), and `conflict_log`.
- [ ] All six source slots (`lod2`, `osm`, `alkis`, `dop`, `dgm`,
      `google3d`) appear in `sources`, even when unavailable.
- [ ] Every feature has at least one `geometry_evidence` entry.
- [ ] Conflict resolution follows the ranking table in `docs/data.md`.
      Disagreements > 2 m in building height between `lod2` and
      `google3d` are always logged.
- [ ] Hero features (Reichstag dome, Hauptbahnhof glass roof) may
      carry `manual: true` and are exempt from automatic conflict
      resolution.
- [ ] Smoke test in `tests/test_fuse_sources.py` loads a tiny
      fixture with two LoD2 buildings + matching OSM tags and asserts
      the manifest contains both, with at least one
      `semantic_evidence` from OSM.
- [ ] `uv run ruff format . && uv run ruff check . && uv run pytest`
      all pass.

## Notes for agents

- Prefer GeoPandas + Shapely for the spatial joins.
- Reproject everything to EPSG:25833 (Berlin's official UTM zone) for
  metric comparisons; report final geometry in EPSG:4326 in the
  manifest so the viewer can consume it directly.
- Keep the manifest small enough to commit (< 5 MB). For the MVP this
  should be trivial — a few hundred buildings.
- If you need to add a new column to `geometry_evidence` or
  `semantic_evidence`, update `docs/data.md` in the same commit.
