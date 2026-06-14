# Task 04 — Fetch Berlin official support layers (ALKIS / DOP / DGM)

**Pipeline step:** 4 (see `AGENTS.md` §5)
**Status:** done
**Owner-set scope:** Implement
`isometric_berlin.data.fetch_official_support` so it downloads the
selected subset of ALKIS parcels, DOP orthophotos, and DGM terrain
grids covering the Regierungsviertel polygon. All three are
dl-de/zero-2-0 / Geoportal Berlin. They are *additive* fusion inputs;
the pipeline must continue cleanly if any of them is skipped.

## Acceptance criteria

- [x] CLI signature:
      `uv run python -m isometric_berlin.data.fetch_official_support
      --bounds <geojson> --layers alkis,dop,dgm --out-dir <dir>`.
- [x] Raw downloads land under
      `geo_data/regierungsviertel/raw/{alkis,dop,dgm}/` (gitignored).
- [x] Small derived artefacts (e.g. clipped ALKIS GeoPackage, low-res
      DOP preview, DGM hillshade preview) may be written outside
      `raw/` but **must** stay < 5 MB each.
- [x] `--layers` accepts any comma-separated subset of
      `alkis,dop,dgm`. Missing layers exit cleanly and are recorded
      as `available: false` by the downstream fusion step.
- [x] No Google API calls in this script.
- [x] No use of credentials beyond Geoportal Berlin public endpoints.
- [x] `uv run ruff format . && uv run ruff check . && uv run pytest`
      all pass.

## Completion notes

- `alkis.gpkg`: 292 clipped ALKIS Flurstücke, EPSG:25833, 336 KB.
- `dop_preview.png`: DOP 2025 WMS reference preview, 3.8 MB.
- `dgm_preview.png`: DGM1 WMS reference preview, 219 KB.
- Raw capabilities/ATOM feeds were written under
  `geo_data/regierungsviertel/raw/{alkis,dop,dgm}/` and remain
  gitignored. Large DOP/DGM ZIP archives are listed in manifests, not
  committed.

## Notes for agents

- These layers are optional in v0.1. Prefer ALKIS first (best for
  alignment), DOP second (texture reference for the AI model), DGM
  last (only relevant at the Spree bank and Hauptbahnhof forecourt).
- Be polite to Geoportal Berlin: cache responses, set a clear
  `User-Agent: isometric-berlin/0.1 (Klotzkette)`.
- Document the exact WFS/WMS endpoints used in `docs/data.md`.
