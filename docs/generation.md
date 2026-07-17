# Generation

The committed viewer is generated entirely from the permitted open-data
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
duplicate OBJ vertices and emits two scale-identical tiers: a 100,000-face-per-
tile interaction/touch surface and a 289,797-face-per-tile settled desktop
surface, both with quadric aggression 5. A 58° smoothing crease splits normals
only at severe folds, sharpening roof and facade edges without introducing
invented metric geometry. The 23 interaction tiles contain 2,299,987 faces and
1,219,929 vertices in 26.5 MiB; the 23 settled tiles contain 6,000,002 faces and
3,134,292 vertices in 71.6 MiB. Meshopt uses 16-bit positions and 8-bit normals;
the viewer carries the interaction tier while moving and swaps to the settled
tier only after desktop loading and camera damping complete. Touch devices do
not request the settled tier. At rest, the frontend adds two 80-triangle crown
microclusters for each of the 6,893 official tree-catalogue points. Together
with the 6,000,002-face surface this yields 7,102,882 official-source rendered
face equivalents without tessellating unchanged triangles or describing the
procedural crowns as surveyed shapes. Reichstag, Bundeskanzleramt, Hauptbahnhof and
Brandenburger Tor receive
separate LoD2-footprint-masked texture crops. This preserves the Reichstag's
real dome geometry while excluding surrounding tree noise. Hero material
segments try 1600, 1536, 1280 and 1024 px textures before lower bounded
fallbacks. Every GLB includes offline-generated vertex normals, so the browser
does not recompute the 23 base tiles at startup.
Every output GLB stays below 5 MiB; the complete 68-file scene is 163.5 MiB.
The scene manifest records quality tier, face counts, quantization profile,
source bounds, byte sizes and SHA-256 hashes.

The manifest anchors a procedural Reichstag glass/steel signature at the
LoD2-aligned building centre and the Bundestag's published 24 m roof-terrace
datum, not at a noisy photogrammetric crop apex. Its 40 m diameter, 23.5 m
height, 24 primary ribs and 17 horizontal rings are sourced from the Bundestag
architecture page. The transparent display skin leaves the lower four
ventilation rows open, covers the remaining 13 rows in 24 faceted sectors and
adds alternating braces, an open crown ring, 360 mirror-cone panels and two
guarded visitor ramps. Two night-only interior lights, a warm emissive mirror
cone and a thin front-facing glow over only the 13 glazed rows improve the
after-dark reading. This dimensioned overlay makes the dome legible without
replacing the underlying official measured mesh.

Small cultural objects are procedural recognition layers rather than source
geometry replacements. The TIPI uses its published 32 x 26 m ellipse and owner
venue material for its tent and show-light cues. The Carillon keeps the
published 42 m height and 68-bell count. The Spree boat is explicitly a typical
excursion-boat display model and remains labelled as such in its metadata.
The translucent 3D water ribbon follows 45 m samples of the committed OSM
Spree centreline. Its 30 m display width and 0.32 m wave relief are procedural,
not assertions about the river's measured cross-section or instantaneous state.

Tiergarten paths, tree points/tree rows and playground equipment are rebuilt
after an OSM refresh with:

```bash
uv run python -m isometric_berlin.generation.build_park_details
```

Before that step, `fetch_official_details` clips the two official tree
catalogues, public-lighting WFS and Vorderlandmauer WFS into a 1.7 MiB
GeoPackage. The builder additively fuses 6,893 official tree points with OSM:
1,876 OSM samples match an official tree within 3 m and 1,136 unmatched OSM
samples remain, yielding 8,029 visible trees. It also emits 1,242 operational
lamp points, two Wall traces, 167 path sections and five playground footprints.
Heights are sampled locally from the packaged official mesh; a scene-ground
fallback is used only outside mesh coverage. The resulting `park-details.json`
is 2.6 MiB; raw WFS, OSM and mesh intermediates remain excluded.

## Step 8b: Minecraft-mode voxel payload

The viewer's Minecraft mode renders the quarter as axis-aligned 4 m blocks
("eckig, klotzig, blockig"). The payload is derived from committed sources
only — no network access — and regenerated with:

```bash
uv run python -m isometric_berlin.generation.build_minecraft_voxels \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out src/app/public/mesh/regierungsviertel/minecraft-voxels.json
```

How it is built (all snapping is deterministic, `CELL_M = 4.0`):

- **Coordinates.** Cells live in the scene frame verified against
  `scene.json` `origin_epsg25833`: `world_x = easting − 389500`,
  `world_z = 5820000 − northing`, `world_y` in metres. The builder fails
  fast if the packaged scene origin ever changes. Output heights are
  decimetre integers to keep the JSON compact.
- **Buildings.** Every LoD2 footprint in `buildings.gpkg` (buildings and
  building parts, additive) is rasterised by 4 m cell-centre containment.
  Each covered cell becomes one column `[x_idx, z_idx, y0_dm, y1_dm, class]`
  with the measured height snapped **up** to a 4 m multiple; the tallest
  covering building wins a contested cell. ALKIS office (`31001_2020`) and
  station-hall (`31001_3091`) functions map to `glass`, everything else to
  `concrete` (LoD2 has no facade material — this is a display palette).
  Gabled/hipped roof forms (ALKIS `3100/3200/3300/3400`) add a one-cell-inset
  second tier 4 m higher as a simple stepped roof; flat (`1000`) and unknown
  roofs stay flat.
- **Ground height.** Inverse-distance interpolation (k=8) over the 9,271
  committed tree and street-light y samples in `park-details.json`; a coarse
  16 m height grid ships in the payload so the viewer can stack from real
  terrain.
- **Ground cover.** One class per cell inside the bounds polygon, run-length
  encoded per row as `[x_start_col, run_length, class]`. Priority:
  `water` (OSM water polygons, display top fixed at y = 1.31 m) over
  `plazaBrick` (OSM paved pedestrian/footway polygons such as Pariser Platz)
  over `asphalt` (6 m buffer around vehicular OSM road lines — footways are
  excluded so the Tiergarten stays green) over the `grass` default.
- **Trees.** One voxel tree per occupied cell (tallest wins) from the fused
  `park-details.json` points: `[x_idx, z_idx, ground_y_dm, height_dm]` with
  the height snapped up to a 4 m multiple (minimum 8 m); the viewer builds
  trunk and crown procedurally.

The committed `minecraft-voxels.json` is ~0.6 MiB (hard test budget 5 MB)
and currently carries 17,113 building columns, 7,664 tree blocks and 120,302
classified ground cells. The payload embeds the mandatory OSM + Geoportal
Berlin attribution and per-source licences; `tests/test_build_minecraft_voxels.py`
guards size, grid consistency and a 24 m+ Reichstag block cross-check.

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
