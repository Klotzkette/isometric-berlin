# Generation

The committed v0.1 viewer is generated entirely from the permitted open-data
stack. Berlin LoD2 anchors building footprints/heights, OSM supplies roads,
water, parks, rail and POIs, ALKIS supplies parcel context, and freely licensed
Wikimedia records provide colour/material cues. Google is not used unless the
three opt-in variables in `AGENTS.md` are explicitly set.

## Step 7: quadrant coverage

The reproducible grid is 135 quadrants (15 rows × 9 columns), using 180 m map
tiles with a 90 m margin. It covers EPSG:25833 bounds
`388694.9307, 5818459.0360, 390314.9307, 5821159.0360` and is rebuilt with:

```bash
uv run python -m isometric_berlin.generation.create_grid \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --map-id regierungsviertel --tile-size-m 180 --margin-m 90 --tile-px 512
```

`generations/regierungsviertel/quadrants.db` is a gitignored intermediate. It
is inspected for coverage and remains available for per-quadrant/AI work.

## Step 8: high-resolution source render

The public DZI uses the same `render_quadrant` LoD2/OSM scene code in one
coherent global projection. This avoids stitching the contextual margins of
the 135 working quadrants into visible duplicate geometry. The renderer uses
a 32768-pixel internal detail budget on a 16384×11616 rectangular canvas;
geometry, facade lines, landmark signatures and vertical extrusion are drawn
at that resolution. Existing overview pixels are never upscaled.

Only one primary LoD2 body receives each landmark-specific signature. If more
than one body contains the verified landmark point, the largest containing
body wins. This prevents duplicate Reichstag domes and repeated station or
chancellery roof treatments on small adjacent structures.

Complex CityGML ensembles are rendered part by part at their official measured
heights. The current clipped source contains 3,315 volumes, including 848
`BuildingPart` records in 142 parent ensembles, and every committed volume has
a measured LoD2 height. Named OSM building polygons associate all parts in a
landmark family with the same material cue; only the one part at the verified
landmark anchor receives the singular dome, shell or facade signature.

```bash
uv run python -m isometric_berlin.generation.render_overview \
  --render-px 32768 --canvas-width 16384 --canvas-height 11616 \
  --preview-max-width 6144
```

The derived `overview_source.png` and `overview.png` are capped at 6144 pixels
wide and use a bounded PNG palette for offline fallback/package size. The DZI
itself retains all 16384×11616 source pixels and its full colour source.

The global render also loads `tiergartentunnel.geojson`. Only its engineered
`underground_reference_route` centreline is rendered; the 13 OSM carriageway
ways remain provenance evidence and are not duplicated as visible tunnel
bodies. The cutaway is clipped to the current scene and remains explicitly
schematic in depth.

## Step 8a: official photogrammetric WebGL mesh

The true 3D viewer uses the free Berlin 3D Mesh Model 2025 from the June 2025
aerial survey. The fetcher intersects the official index with the committed
bounds and selects 23 source tiles. Raw OBJ/MTL/JPEG ZIPs remain gitignored.

```bash
uv run python -m isometric_berlin.data.fetch_berlin_mesh \
  --accept-terms --download-content
uv run python -m isometric_berlin.generation.prepare_webgl_mesh
```

The converter includes every OBJ material segment. For the full scene it
samples source textures into enhanced-but-bounded vertex colours, merges
duplicate OBJ vertices and simplifies each tile to a 70,000-face mobile base
mesh. Reichstag, Bundeskanzleramt, Hauptbahnhof and Brandenburger Tor receive
separate LoD2-footprint-masked texture crops. This preserves the Reichstag's
real dome geometry while excluding surrounding tree noise. Hero material
segments try 1536, 1280 and 1024 px textures before lower bounded fallbacks.
Every output GLB stays below 5 MiB; the scene manifest records face counts,
source bounds, byte sizes and SHA-256 hashes.

The manifest also anchors a procedural Reichstag glass/steel signature to the
photogrammetric apex. Its 40 m diameter, 23.5 m height, 24 primary ribs and 17
horizontal rings are sourced from the Bundestag architecture page. This
dimensioned overlay makes the dome legible without replacing the underlying
official measured mesh.

## Step 10: DZI export and dual viewer

`export_dzi` writes 256-pixel JPEG tiles with quality 85 and a real one-pixel
overlap on every internal tile edge. The current descriptor has levels 0–14
and 3,945 tiles. A clean `bun run build` now contains both the DZI and
progressive WebGL assets and remains below the hard 200 MB static-hosting
ceiling. The browser loads hero crops only when their landmark is selected.

Do not commit PNG quadrant intermediates. Commit only the DZI pyramid and the
derived overview files under `src/app/public/dzi/regierungsviertel/`.

## Future AI generation

The NYC project's "omni infill" fine-tune is American architecture and will
not produce convincing Berlin government architecture out of the box. A
future Berlin-specific `Qwen/Image-Edit` fine-tune should use 40–80 curated
render/reference pairs and the 2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the
NYC project. Generated tiles must remain an additive visual layer; they do not
replace the LoD2 geometry or OSM semantics.
