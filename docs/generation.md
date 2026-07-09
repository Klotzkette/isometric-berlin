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

```bash
uv run python -m isometric_berlin.generation.render_overview \
  --render-px 32768 --canvas-width 16384 --canvas-height 11616 \
  --preview-max-width 3584
```

The derived `overview_source.png` and `overview.png` are capped at 3584 pixels
wide for offline fallback/package size. The DZI itself retains all
16384×11616 source pixels.

## Step 10: DZI export

`export_dzi` writes 256-pixel JPEG tiles with quality 85 and a real one-pixel
overlap on every internal tile edge. The current descriptor has levels 0–14
and 3,945 tiles. A clean `bun run build` is approximately 41 MB (decimal),
below the preferred 50 MB static-hosting target.

Do not commit PNG quadrant intermediates. Commit only the DZI pyramid and the
derived overview files under `src/app/public/dzi/regierungsviertel/`.

## Future AI generation

The NYC project's "omni infill" fine-tune is American architecture and will
not produce convincing Berlin government architecture out of the box. A
future Berlin-specific `Qwen/Image-Edit` fine-tune should use 40–80 curated
render/reference pairs and the 2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the
NYC project. Generated tiles must remain an additive visual layer; they do not
replace the LoD2 geometry or OSM semantics.
