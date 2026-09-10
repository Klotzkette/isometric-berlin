# Setup

## 1. Environment

```bash
cp .env.example .env
```

The core pipeline (LoD2 + OSM + ALKIS/DOP/DGM) needs no API keys. Google
Photorealistic 3D Tiles are an **optional, additive** source: leave the
`GOOGLE_MAPS_*` flags unset to skip them, or set all three
(`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_3D_TILES_ENABLED=true`,
`GOOGLE_MAPS_TERMS_ACCEPTED=true`) to opt in. See `docs/data.md`.

## 2. Python

```bash
uv sync
```

## 3. Run the existing viewer

The repository already contains the clipped runtime data. No geodata download,
AI generation or DZI export is needed to work on or build the viewer.

```bash
cd src/app
bun install
bun run dev
```

Open the HTTP URL printed by Vite. The viewer always starts in isometric 3D;
all five visual modes use that renderer. For a production build, run
`bun run build` in the same directory and serve `dist/` over HTTP.

The following pipeline commands are for regenerating source-derived artefacts,
not prerequisites for opening an existing release.

## 4. Geodata download (Regierungsviertel only)

```bash
# Clip Berlin LoD2 CityGML to the Regierungsviertel polygon
uv run python -m isometric_berlin.data.fetch_lod2 \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/buildings.gpkg

# Fetch OSM context (streets, water, parks, rail) for the same bounds
uv run python -m isometric_berlin.data.fetch_osm \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/osm.gpkg
```

Both commands are implemented and intentionally clipped to the
Regierungsviertel bounds. Raw upstream downloads and caches remain
under `geo_data/regierungsviertel/raw/` and are gitignored.

## 5. Quadrant grid + render

```bash
uv run python -m isometric_berlin.generation.create_grid \
  --bounds geo_data/regierungsviertel/bounds.geojson

uv run python -m isometric_berlin.generation.render_quadrants
```

## 6. Generate archival pixel-art tiles

```bash
uv run python -m isometric_berlin.generate_tile --all
```

## 7. Archival DZI export

```bash
uv run python -m isometric_berlin.generation.export_dzi
```

This pipeline command remains available for archival outputs. The current
isometric viewer does not load a DZI pyramid and the live build excludes those
tiles. Its startup backdrop and walking minimap are retained support images.

## 8. Downloaded release

Extract the full release package, then double-click `OPEN-3D-WINDOWS.bat` on
Windows or `OPEN-3D-MAC.command` on macOS. Alternatively, run
`python3 serve-local.py` from the extracted directory on macOS or Linux.
The launcher serves and opens the same full 3D viewer over local HTTP.

`START-HERE.html` explains these steps when opened as a local file. Over HTTP
it redirects to the isometric app. A browser cannot reliably load JavaScript
modules and scene JSON by double-clicking `index.html`; there is no alternate
flat-map renderer.

## 9. Release sanity check

```bash
uv run python scripts/check_release_readiness.py
```

This checks version sync, the README status line, the retained 3D viewer assets,
preview size limits, 3D launch instructions and stale duplicate/hidden files
before packaging or tagging a release.
