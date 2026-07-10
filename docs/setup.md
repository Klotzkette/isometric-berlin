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

## 3. Geodata download (Regierungsviertel only)

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

## 4. Quadrant grid + render

```bash
uv run python -m isometric_berlin.generation.create_grid \
  --bounds geo_data/regierungsviertel/bounds.geojson

uv run python -m isometric_berlin.generation.render_quadrants
```

## 5. Generate pixel-art tiles

```bash
uv run python -m isometric_berlin.generate_tile --all
```

## 6. DZI export and viewer

```bash
uv run python -m isometric_berlin.generation.export_dzi
cd src/app && bun install && bun run dev
```

## 7. Release sanity check

```bash
uv run python scripts/check_release_readiness.py
```

This checks version sync, the README status line, required bundled DZI
viewer assets, the 5 MiB committed-preview limit, zero-server camera
normalization, and stale duplicate/hidden files before packaging or tagging a
release.
