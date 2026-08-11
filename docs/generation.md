# Generation

The committed viewer is generated entirely from the permitted open-data
stack. Berlin LoD2 anchors building footprints/heights, OSM supplies roads,
water, parks, rail and POIs, ALKIS supplies parcel context, and freely licensed
Wikimedia records provide colour/material cues. Google is not used unless the
three opt-in variables in `AGENTS.md` are explicitly set.

## Step 7: quadrant coverage

The reproducible task-10 grid is 650 quadrants (26 rows × 25 columns), using
180 m map tiles with a 90 m margin. It starts at approximately EPSG:25833
`386536.58, 5818021.23` and is rebuilt with:

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
the 650 working quadrants into visible duplicate geometry. The renderer uses
a 32768-pixel internal detail budget on a 16384×11616 rectangular canvas;
geometry, facade lines, landmark signatures and vertical extrusion are drawn
at that resolution. Existing overview pixels are never upscaled.

Only one primary LoD2 body receives each landmark-specific signature. If more
than one body contains the verified landmark point, the largest containing
body wins. This prevents duplicate Reichstag domes and repeated station or
chancellery roof treatments on small adjacent structures.

Complex CityGML ensembles are rendered part by part at their official measured
heights. The current clipped source contains 17,091 volumes: 6,465 buildings
and 10,626 `BuildingPart` records in 2,012 parent ensembles. Every committed
volume has a measured LoD2 height. Named OSM building polygons associate all parts in a
landmark family with the same material cue; only the one part at the verified
landmark anchor receives the singular dome, shell or facade signature.

```bash
uv run python -m isometric_berlin.generation.render_overview \
  --render-px 32768 --canvas-width 16384 --canvas-height 11616 \
  --preview-max-width 6144 --margin-m 440
```

The 440 m argument is applied once to the overview quad and once by the shared
quadrant renderer, yielding the documented 880 m paper ring on every side.

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
bounds and selects 26 source tiles. Raw OBJ/MTL/JPEG ZIPs remain gitignored.

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
invented metric geometry. The 26 interaction tiles contain 2,599,985 faces and
1,377,751 vertices in 29.9 MiB; the 26 settled tiles contain 6,623,585 faces and
3,464,527 vertices in 79.1 MiB. Meshopt uses 16-bit positions and 8-bit normals;
the viewer carries the interaction tier while moving and swaps to the settled
tier only after desktop loading and camera damping complete. Touch devices do
not request the settled tier. At rest, the frontend adds two 80-triangle crown
microclusters for each of the 25,305 official tree-catalogue points. Together
with the 6,623,585-face surface this yields 10,672,385 official-source rendered
face equivalents without tessellating unchanged triangles or describing the
procedural crowns as surveyed shapes. Reichstag, Bundeskanzleramt, Hauptbahnhof and
Brandenburger Tor receive
separate LoD2-footprint-masked texture crops. This preserves the Reichstag's
real dome geometry while excluding surrounding tree noise. Hero material
segments try 1600, 1536, 1280 and 1024 px textures before lower bounded
fallbacks. Every GLB includes offline-generated vertex normals, so the browser
does not recompute the 26 base tiles at startup.
Every output GLB stays below 5 MiB; the complete 74-file scene is 174.3 MiB.
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
The drawn ground layer separately uses exact OSM polygon rings for Spree,
canals, ponds and built basins. Natural Tiergarten ponds retain island holes,
use soft sloped banks and a robust local low-bank level; mapped streams and
ditches are included only inside the Großer Tiergarten polygon. Their visible
bed depth is explicitly a display approximation because the open source bundle
does not contain pond bathymetry.

Tiergarten paths, tree points/tree rows and playground equipment are rebuilt
after an OSM refresh with:

```bash
uv run python -m isometric_berlin.generation.build_park_details
```

Before that step, `fetch_official_details` clips the two official tree
catalogues, public-lighting WFS and wall-trace WFS into the bounded
GeoPackage. The task-10 builder additively fuses that evidence with OSM and
emits 29,861 visible trees, 5,829 street lights, 12 wall traces, 1,651 joined
park-path sections and 101 playground footprints. The separate all-area
surface builder records 8,151 bounded above-ground walking/cycling line parts:
7,420 have an explicit OSM `surface`, 988 have `width` or `est_width`, and
every remaining width/material is marked as a class/context fallback. Heights
are sampled locally from the packaged official mesh; a scene-ground fallback
is used only outside mesh coverage. The resulting `park-details.json` is 5.2
MB; raw WFS, OSM and mesh intermediates remain excluded.

Regenerate the complete street and path surface payload with:

```bash
uv run python -m isometric_berlin.generation.build_surface_polygons
```

Schema 7 resolves path surfaces into asphalt, paving, compacted/gravel, earth,
timber and metal. Explicit OSM tags win over park context, so a mapped asphalt
cycleway remains asphalt through a park and a mapped earth desire path remains
earth at its edge. The committed payload includes a `path_inventory` audit
block with highway, source-surface, resolved-material and mapped-width counts.
The compact `park-details.json` schema 4 stores the same material as a one-byte
code and each resolved width in decimetres. Unnamed paths omit the optional
name field; this keeps all six materials and 1,651 close-view ribbons below the
5 MiB release ceiling without increasing the number of path draw calls.

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
- **Ground height.** Inverse-distance interpolation (k=8) over the 34,534
  committed tree and street-light y samples in `park-details.json`; a coarse
  16 m height grid ships in the payload so the viewer can stack from real
  terrain. Minecraft deliberately keeps nearest-cell steps. The drawn city
  reads the same samples bilinearly and tessellates long ground-bound surface
  triangles to a 64 m maximum edge, so roads, paths and lawns retain broad
  local rises without claiming a denser elevation survey. River coping samples
  the landward side of that same grid and follows its longitudinal grade.
- **Ground cover.** One class per cell inside the bounds polygon, run-length
  encoded per row as `[x_start_col, run_length, class]`. Priority:
  `bridge` over `water` (Spree/canal/harbour at the display table
  y = -1.15 m), with `pond` and `basin` classes retaining local terrain,
  over `plazaBrick` (OSM paved pedestrian/footway polygons such
  as Pariser Platz) over `asphalt` (6 m buffer around vehicular OSM road
  lines — footways are excluded so the Tiergarten stays green) over the
  `grass` default. `bridge` marks water cells within the same 6 m buffer of
  an OSM road **or rail** line whose `bridge` tag is truthy (any value
  except `no`), so the Spree/Humboldthafen crossings — Moltkebrücke,
  Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke, Kronprinzenbrücke and the
  Hauptbahnhof S-Bahn viaduct — keep their decks instead of vanishing into
  unbroken water. Bridge cells render at the IDW terrain height (roughly
  bank height, e.g. 2.8 m at the Moltkebrücke, above the 1.31 m water top).
- **Trees.** One voxel tree per occupied cell (tallest wins) from the fused
  `park-details.json` points: `[x_idx, z_idx, ground_y_dm, height_dm]` with
  the height snapped up to a 4 m multiple (minimum 8 m); the viewer builds
  trunk and crown procedurally.

The committed `minecraft-voxels.json` is 3.6 MB (hard test budget 5 MiB)
and currently carries 133,060 building columns, 28,096 tree blocks and 641,397
classified ground cells on a 1,072 × 1,122 grid. The payload embeds the mandatory OSM + Geoportal
Berlin attribution and per-source licences; `tests/test_build_minecraft_voxels.py`
guards size, grid consistency and a 24 m+ Reichstag block cross-check.

## Step 8c: drawn-isometric LoD2 prism payload

The drawn-isometric mode ("gezeichnete Isometrie") extrudes every building
as a hard-edged prism from its TRUE LoD2 footprint — the crisp LoD2 shapes
replace the lumpy photogrammetry surface. Regenerated from committed sources
only:

```bash
uv run python -m isometric_berlin.generation.build_isometric_prisms \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out src/app/public/mesh/regierungsviertel/lod2-prisms.json
```

How it is built (deterministic, shares the Step 8b machinery):

- **Coordinates.** Same scene frame as the voxel payload, verified against
  `scene.json`: `world_x = easting − 389500`, `world_z = 5820000 − northing`.
  Ring vertices ship as decimetre-integer `[x_dm, z_dm]` pairs with the
  closing vertex omitted; heights are decimetre integers.
- **Footprints.** One prism per LoD2 footprint polygon part (MultiPolygons
  split). Exterior and interior rings are simplified with shapely
  `simplify(0.15 m)` to remove collinear CityGML noise while preserving real
  corners; winding is normalised (exterior CCW, holes CW in the x/z frame).
  Courtyards survive as `holes` — the Reichstag keeps its interior rings.
- **Heights.** `h_dm` is the TRUE measured LoD2 height in decimetres — never
  snapped, unlike the 4 m voxel columns. `y0_dm` is the IDW ground sample
  (same k=8 sampler over the committed `park-details.json` points) at the
  part centroid.
- **Palette.** Same display classes as Step 8b: ALKIS office (`31001_2020`)
  and station-hall (`31001_3091`) functions map to `glass`, everything else
  to `concrete`. The ALKIS roof-form code ships as an integer `roof` field
  for later viewer use.
- **Degeneracy.** Parts below 1 m² or 3 distinct vertices after
  simplification/quantisation are dropped, as are rows whose height rounds
  to 0 dm. The deliberately small 1 m² floor retains legitimate wall,
  bollard and service structures while removing only unusable slivers.
- **Real colour tones.** Each prism carries an optional `tone` `[r, g, b]`:
  the per-channel median of the committed drawn overview raster
  (`overview_source.png`) under its footprint, so the Kanzleramt reads light
  and the Reichstag stone-grey instead of one shared cream palette. The
  builder reproduces the exact projection of the committed overview
  (`project_point`, 16384×11616 canvas, 32768 px budget, 880 m effective margin —
  pinned by re-projecting committed `landmarks.json` records in the tests)
  and samples a deterministic interior grid (~3 m spacing, refined to ≥5
  points for small parts, capped at 200) at ground elevation, where the
  overview draws each building's own facade band (roof for flat parts). The
  median is robust against outline/window/shadow pixels — the same rationale
  as the viewer's `drawnBuildings.medianColorFromPixels`. Parts without a
  valid raster sample omit `tone` and fall back to the class shades.

The committed `lod2-prisms.json` is 2.5 MB (hard test budget 5 MiB) and
carries 15,076 prisms; 90 retain a total of 142 courtyard holes and 12,950
carry a sampled `tone`. Parts without a reliable raster sample use the
documented class palette. The payload embeds
the mandatory OSM + Geoportal Berlin attribution and per-source licences;
`tests/test_build_isometric_prisms.py` guards size, ring validity against
the voxel grid bounds, the palette split, true (unsnapped) heights, the
28 m Reichstag prism including its courtyards, the overview projection
against committed landmarks, tone coverage and the grey/light Reichstag and
Kanzleramt tones.

## Step 10: DZI export and dual viewer

`export_dzi` writes 256-pixel JPEG tiles with quality 85 and a real one-pixel
overlap on every internal tile edge. The current descriptor has levels 0–14
and 3,945 tiles. A clean `bun run build` contains both the full DZI and
progressive WebGL assets. The release packager keeps every WebGL asset but
reuses levels 0–13 as an 8192×5808 offline DZI, removing only the redundant
highest fallback level so both extracted archives remain below their hard
211 MiB ceiling; the compressed download remains below 200 MB. The browser
loads hero crops only when their landmark is
selected.

Do not commit PNG quadrant intermediates. Commit only the DZI pyramid and the
derived overview files under `src/app/public/dzi/regierungsviertel/`.

## Future AI generation

The NYC project's "omni infill" fine-tune is American architecture and will
not produce convincing Berlin government architecture out of the box. A
future Berlin-specific `Qwen/Image-Edit` fine-tune should use 40–80 curated
render/reference pairs and the 2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the
NYC project. Generated tiles must remain an additive visual layer; they do not
replace the LoD2 geometry or OSM semantics.
