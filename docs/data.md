# Data — Additive Source Fusion

This project uses **additive data fusion**, per owner policy. Every
permitted source contributes; the best evidence from each source is
kept per feature / per tile. No source is treated as a replacement
for another. If sources disagree, the conflict is recorded; it is
**not** silently resolved by dropping a source.

## Permitted sources

| ID | Source | Role | License |
|---|---|---|---|
| `lod2` | Berlin LoD2 buildings ([Geoportal Berlin](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin)) | **Authoritative building geometry anchor** | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) |
| `osm` | OpenStreetMap (Overpass / OSMnx) | Streets, water, parks, rail, POIs, semantic context | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| `alkis` | ALKIS parcels (Geoportal Berlin) | Official alignment, parcel context | dl-de/zero-2-0 |
| `dop` | DOP digital orthophotos (Geoportal Berlin) | Orthophoto QA, texture reference | dl-de/zero-2-0 |
| `dgm` | DGM digital terrain model (Geoportal Berlin) | Terrain where useful (Spree bank, station forecourt) | dl-de/zero-2-0 |
| `google3d` | Google Maps Platform Photorealistic 3D Tiles | **Opt-in.** Photorealistic geometry, texture, alignment, visual reference | Google Maps Platform Terms |

## Google opt-in flags

Google content is fetched **only** when all three env vars are set:

```
GOOGLE_MAPS_API_KEY=<your-key>
GOOGLE_MAPS_3D_TILES_ENABLED=true
GOOGLE_MAPS_TERMS_ACCEPTED=true
```

If any of these is missing, the Google fetcher exits cleanly with a
no-op and the fusion step records `google3d` as `unavailable` in the
manifest (it does not fail the pipeline).

Strict hygiene rules:

- API keys never enter committed files. Manifest URLs are written
  with `?key={GOOGLE_MAPS_API_KEY}` placeholder syntax, **not** real
  keys.
- Raw Google responses, tile caches, screenshots, and any derived
  meshes/textures live under
  `geo_data/regierungsviertel/raw/google_3d_tiles/` (gitignored) and
  are **not** committed.
- Any artefact that uses or derives from Google content must show the
  appropriate Google attribution per their terms, in addition to the
  OSM/Geoportal Berlin attribution.

## Fused source-stack manifest

The fusion step (pipeline step 6, see `tasks/05-source-fusion-manifest.md`)
writes `geo_data/regierungsviertel/fused_sources.json` with this shape:

```jsonc
{
  "bounds_ref": "geo_data/regierungsviertel/bounds.geojson",
  "generated_at": "2026-06-14T20:49:00Z",
  "sources": {
    "lod2":    { "available": true,  "path": "geo_data/regierungsviertel/buildings.gpkg", "license": "dl-de/zero-2-0" },
    "osm":     { "available": true,  "path": "geo_data/regierungsviertel/osm.gpkg",       "license": "ODbL-1.0" },
    "alkis":   { "available": false, "reason": "not_downloaded" },
    "dop":     { "available": false, "reason": "not_downloaded" },
    "dgm":     { "available": false, "reason": "not_downloaded" },
    "google3d":{ "available": false, "reason": "opt_in_env_missing" }
  },
  "features": [
    {
      "feature_id": "bld-12345",
      "kind": "building",
      "anchor_source": "lod2",
      "geometry_evidence": [
        { "source": "lod2",    "confidence": 1.0, "ref": "buildings.gpkg#fid=12345" },
        { "source": "google3d","confidence": 0.7, "ref": "raw/google_3d_tiles/tile_42_17.glb" }
      ],
      "semantic_evidence": [
        { "source": "osm", "tags": { "name": "Reichstagsgebäude", "amenity": "parliament" } }
      ],
      "conflicts": []
    }
  ],
  "conflict_log": []
}
```

## Per-feature evidence ranking

When multiple sources provide evidence for the same feature attribute,
use this default ranking unless the feature is explicitly marked as
hero/manual:

| Attribute | Primary | Secondary | Tertiary |
|---|---|---|---|
| Building footprint | `lod2` | `alkis` | `google3d` |
| Building height / roof | `lod2` | `google3d` | `osm` (`building:levels`) |
| Building name / function | `osm` | `alkis` | — |
| Streets, paths, rails | `osm` | `alkis` | — |
| Water (Spree) | `osm` | `alkis` | `dop` |
| Parks (Tiergarten) | `osm` | `dop` | — |
| Terrain | `dgm` | `lod2` (ground vertices) | — |
| Texture / colour reference | `dop` | `google3d` | — |

Rationale: official Berlin data is the anchor for geometry; OSM is the
anchor for semantics; Google is additive — it earns weight where it
provides higher fidelity (e.g. recent textures, complex glass roofs)
but never overrides Berlin LoD2 for footprint or official ALKIS
boundaries.

## Conflict handling

If two sources disagree on a value that matters (e.g. building height
differs by > 2 m between `lod2` and `google3d`), the fusion step:

1. Writes both values into `geometry_evidence` / `semantic_evidence`.
2. Adds an entry to `conflict_log` with `feature_id`, `attribute`,
   `values` per source, and the chosen winner.
3. **Does not delete** the losing value. It remains available for
   downstream QA or for the bounds editor / hero tile workflow.

## Raw download locations (all gitignored)

```
geo_data/regierungsviertel/raw/
├── lod2/              # Berlin LoD2 CityGML downloads
├── osm/               # Overpass query cache
├── alkis/             # ALKIS exports
├── dop/               # DOP orthophoto tiles
├── dgm/               # DGM terrain grids
└── google_3d_tiles/   # Google manifest + (opt-in) downloaded tile content
```

## CLI summary

```bash
# 2: LoD2
uv run python -m isometric_berlin.data.fetch_lod2 \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/buildings.gpkg

# 3: OSM
uv run python -m isometric_berlin.data.fetch_osm \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/osm.gpkg

# 4: ALKIS / DOP / DGM (optional)
uv run python -m isometric_berlin.data.fetch_official_support \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --layers alkis,dop,dgm \
  --out-dir geo_data/regierungsviertel/raw/

# 5: Google Photorealistic 3D Tiles (opt-in)
uv run python -m isometric_berlin.data.fetch_google_tiles \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json
# add --download-content only when explicitly approved for the run

# 6: Source-fusion manifest
uv run python -m isometric_berlin.data.fuse_sources \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/fused_sources.json
```
