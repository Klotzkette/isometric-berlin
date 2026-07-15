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
| `berlinmesh` | [Berlin 3D Mesh Model 2025](https://www.businesslocationcenter.de/berlin3d-downloadportal/) | Official photogrammetric surface geometry and aerial textures for the true 3D viewer | Berlin 3D Downloadportal terms; Berlin Partner attribution required |
| `berlindetails` | [Berlin tree catalogues](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23), public lighting and [1989 Wall route](https://daten.berlin.de/datensaetze/verlauf-der-berliner-mauer-1989-wfs-3dcda64c) | Individual tree positions/dimensions, lamp positions/types and the Vorderlandmauer trace | dl-de/zero-2-0 |
| `google3d` | Google Maps Platform Photorealistic 3D Tiles | **Opt-in.** Photorealistic geometry, texture, alignment, visual reference | Google Maps Platform Terms |
| `wikimedia` | Wikimedia Commons / Wikipedia media | Freely licensed landmark facade, roof, glass, stone, vegetation and colour references for visual QA / material cues | Per file: CC0, public domain, CC BY, CC BY-SA, etc.; see manifest |

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

## Berlin 3D Mesh terms and derived assets

The official Berlin mesh requires explicit acceptance of the portal terms,
but no API key or payment. Run either with
`BERLIN_3D_MESH_TERMS_ACCEPTED=true` or the explicit `--accept-terms` CLI
flag. Raw OBJ/MTL/JPEG ZIP archives stay under
`geo_data/regierungsviertel/raw/berlin_3d_mesh_2025/` and are gitignored.

Only bounded, derived GLBs are committed under
`src/app/public/mesh/regierungsviertel/`. Each GLB is below 5 MiB. Full-area
tiles merge every source material segment, sample its aerial texture to
vertex colours and simplify geometry for progressive mobile loading. Hero
footprints retain higher-density textured geometry. LoD2 remains the metric
building anchor; the mesh is additive visual/surface evidence.

## Wikimedia visual-reference rules

Wikimedia Commons / Wikipedia media is additive only. It is used to
improve visual reference quality for landmark materials and facade QA;
it does not replace LoD2 geometry, OSM semantics, ALKIS/DOP/DGM
official support data, or the Google opt-in source.

Strict hygiene rules:

- Fetch only files with explicit free-license metadata (`CC0`, public
  domain, `CC BY`, `CC BY-SA`). Do not import unclear, all-rights-
  reserved, non-commercial (`NC`), or no-derivatives (`ND`) media.
- Keep per-file title, URL, author/artist, credit, license, and
  license URL in `geo_data/regierungsviertel/wikimedia_references.json`.
- Commit only small thumbnails / atlas files under
  `references/wikimedia/`; do not commit arbitrary web-photo dumps.
- Any public artefact that directly uses or derives textures from
  Wikimedia references must preserve the relevant per-file attribution
  and share-alike obligations where applicable.

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
    "berlinmesh": { "available": true, "path": "geo_data/regierungsviertel/berlin_3d_mesh_sources.json", "license": "Berlin 3D Downloadportal terms; provider attribution required" },
    "berlindetails": { "available": true, "path": "geo_data/regierungsviertel/official_details.gpkg", "license": "dl-de/zero-2-0" },
    "google3d":{ "available": false, "reason": "opt_in_env_missing" },
    "wikimedia": { "available": true, "path": "geo_data/regierungsviertel/wikimedia_references.json", "license": "Various Wikimedia Commons free licenses; see manifest per image" }
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
| Building height / roof | `lod2` | `berlinmesh` | `google3d`, `osm` (`building:levels`) |
| Building name / function | `osm` | `alkis` | — |
| Streets, paths, rails | `osm` | `alkis` | — |
| Water (Spree) | `osm` | `alkis` | `dop` |
| Parks (Tiergarten) | `osm` | `dop` | — |
| Individual trees | `berlindetails` | `osm` | `berlinmesh` (surface appearance) |
| Public lighting | `berlindetails` | `osm` | — |
| Berlin Wall ground trace | `berlindetails` | `osm` | `dop` |
| Terrain | `dgm` | `berlinmesh` | `lod2` (ground vertices) |
| Texture / colour reference | `berlinmesh` | `dop` | `wikimedia`, `google3d` |

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
├── berlin_3d_mesh_2025/ # Official OBJ/texture ZIPs after terms acceptance
├── official_details/  # Official bounded tree/light/Wall WFS responses
└── google_3d_tiles/   # Google manifest + (opt-in) downloaded tile content
```

Small Wikimedia thumbnails and the QA atlas are committed under:

```
references/wikimedia/
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

# 4a: official Berlin 3D Mesh 2025 (free; portal terms required)
uv run python -m isometric_berlin.data.fetch_berlin_mesh \
  --accept-terms --download-content
uv run python -m isometric_berlin.generation.prepare_webgl_mesh

# 4b: official trees, public lighting and 1989 Wall trace
uv run python -m isometric_berlin.data.fetch_official_details \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/official_details.gpkg

# Wikimedia visual references (additive, free-license filtered)
uv run python -m isometric_berlin.data.fetch_wikimedia \
  --out geo_data/regierungsviertel/wikimedia_references.json \
  --references-dir references/wikimedia

# 6: Source-fusion manifest
uv run python -m isometric_berlin.data.fuse_sources \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/fused_sources.json
```

## OSM / Overpass query

Pipeline step 3 uses OSMnx against Overpass with the Regierungsviertel
polygon from `geo_data/regierungsviertel/bounds.geojson`, clipped back
to the same polygon in EPSG:25833. The effective tag filter is:

```python
{
  "highway": True,
  "waterway": True,
  "water": True,
  "natural": ["water", "wood", "scrub", "grassland", "tree", "tree_row"],
  "leisure": ["park", "garden", "playground"],
  "playground": True,
  "landuse": ["grass", "forest", "meadow", "recreation_ground"],
  "railway": True,
  "amenity": True,
  "tourism": True,
  "historic": True,
  "office": ["diplomatic", "government"],
  "diplomatic": True,
  "government": True,
  "bridge": True,
  "tunnel": True,
  "covered": True,
  "layer": True,
  "service": True,
  "usage": True,
}
```

The normalized raw feature response is cached at
`geo_data/regierungsviertel/raw/osm_overpass.json` (gitignored), and
OSMnx's request cache lives under
`geo_data/regierungsviertel/raw/osmnx_cache/`.

The clipped GeoPackage now exposes `vegetation` and `playgrounds` alongside
roads, water, parks, rail and POIs. It retains equipment type, surface,
material, height, leaf and accessibility attributes. The public viewer does
not ship the raw response: `build_park_details` simplifies this evidence into
the compact `park-details.json` display payload.

## Berlin official support layers

Pipeline step 4 keeps official support data additive and scoped to the
Regierungsviertel bounds:

- `alkis`: public ALKIS Flurstücke WFS
  `https://gdi.berlin.de/services/wfs/alkis_flurstuecke`; the clipped
  derived artefact is `geo_data/regierungsviertel/alkis.gpkg`.
- `dop`: DOP 2025 ATOM/WMS
  `https://gdi.berlin.de/data/dop_2025_fruehjahr/atom/` and
  `https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`; the
  derived QA/reference artefact is `dop_preview.png`.
- `dgm`: DGM1 ATOM/WMS
  `https://gdi.berlin.de/data/dgm1/atom/` and
  `https://gdi.berlin.de/services/wms/dgm1`; the derived QA/reference
  artefact is `dgm_preview.png`.

The raw service capabilities and ATOM feeds are cached under
`geo_data/regierungsviertel/raw/{alkis,dop,dgm}/` and gitignored.
Large DOP/DGM ZIP archives are referenced in those manifests, but are
not downloaded or committed by default.

## LoD2 BuildingPart preservation

The step-2 parser keeps complex CityGML buildings segmented. When a
`bldg:Building` contains `bldg:BuildingPart` children, the committed
`buildings.gpkg` stores the deepest parts as separate records with their own
official footprint, roof type and `measuredHeight`; it does not also render a
second, overlapping parent union. `parent_building_id`, `lod2_role`,
`building_name` and `source_creation_date` retain the ensemble relationship
and provenance.

This matters for the Bundeskanzleramt, Paul-Löbe-Haus and
Marie-Elisabeth-Lüders-Haus: their lower wings, central volumes and roof
elements no longer receive one area-derived fallback height. OSM named
building polygons associate the segmented LoD2 families with semantics, but
Berlin LoD2 remains the geometry and height anchor.
