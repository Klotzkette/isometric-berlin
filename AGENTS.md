# AGENTS.md — Instructions for Codex, Claude Code, Cursor, Gemini CLI, and Perplexity

> **Read this file completely before doing anything in this repo.**
> If you only read one file, read this one. It is the single source
> of truth for *what* this project is, *why* it exists, *what scope
> you must stay inside*, and *what is forbidden*. The corresponding
> `CLAUDE.md` redirects here on purpose.

---

## 1. Project mission (in one paragraph)

Build a giant, zoomable, freely orbitable **isometric model of central
Berlin**, centred on the Regierungsviertel and derived from open and permitted
city data. It is the Berlin equivalent of
[isometric.nyc](https://isometric.nyc) by Andy Coenen, extended with a true
Three.js scene, a high-resolution DZI map and downloadable offline packages.
Per owner policy this project uses **additive data fusion**: every permitted
source contributes; the best evidence from each source is kept per tile.

The owner is **Klotzkette**. He intends to publish the finished
viewer through **Perplexity** (likely via the Perplexity website
hosting / `pplx.app` deployment flow), so the pipeline and artefacts
must be friendly to static hosting and to deployment from a Perplexity
agent. See §9.

## 2. Inspiration and lineage

- Upstream: <https://github.com/cannoneyed/isometric-nyc> by Andy
  Coenen, MIT-licensed, © 2025 Andy Coenen.
- This repo follows the upstream **structure** (directory layout,
  agent guidance, docs sections, `pyproject.toml` shape, generation DB
  schema, isometric quadrant model) so that anyone familiar with the
  NYC repo can navigate this one immediately.
- All Berlin-specific code, data, fine-tunes, and rendered tiles are
  produced fresh here. Do not vendor or copy NYC tile data into this
  repo.

## 3. Hard scope rules (v0.72.32)

The release **only** covers the versioned central-Berlin polygon
in [`geo_data/regierungsviertel/bounds.geojson`](geo_data/regierungsviertel/bounds.geojson).
Its presentation radius is 6,450 m. Never generate or bundle geometry outside
that polygon unless the owner explicitly approves another bounds revision.

Must be inside the polygon and visible in the final map:

- Brandenburger Tor and Pariser Platz
- Reichstagsgebäude (incl. the glass dome — this is a hero tile)
- Bundeskanzleramt
- Paul-Löbe-Haus
- Marie-Elisabeth-Lüders-Haus
- Berlin Hauptbahnhof (incl. the glass roof and the complete five-level
  interior hall — hero tile), Hamburger Bahnhof, Rieckhallen, Sozialgericht
  Berlin, Europacity, KPMG and DKB. Keep the upper rail deck, upper gallery,
  main concourse, lower gallery and deep platforms visibly distinct around the
  daylight slot. Preserve all four cylindrical panoramic lift shafts through
  every level, including their ring frames, landing doors and visible cabins;
  repeated interior detail stays instanced and supplied photographs remain
  non-bundled visual references.
- The Sozialgericht's 58.038 m street-side site boundary from OSM way
  `423490503`, kept distinct from the actual 48.905 m facade and 15.392 m
  risalit of Berlin LoD2 body `DEBE01YYK0002Qys`; retain its 4 + 3 + 4 facade
  hierarchy, Portal 52 and broad three-group roof silhouette. Supplied
  photographs remain reference-only and must never become bundled or runtime
  textures; the touch and Minecraft readings keep explicit bounded budgets.
- The temporary 2026 FUNBOX at the Wunderland-Festplatz, kept wholly outside
  the delivered Heidestraße, Minna-Cauer-Straße and Döberitzer Straße surface
  polygons in both drawn and Minecraft representations
- The Geschichtspark Ehemaliges Zellengefängnis Moabit at exact OSM park way
  `498278335`, retaining its mapped red-brick wall traces, exact Panoptikum way
  `195086492` and Berlin LoD2 cell `DEBE01AL2yz00000`. Present-day interpretive
  details must remain procedural and must not trace or bundle the protected
  landscape plan.
- Haus der Kulturen der Welt ("Schwangere Auster") with its bow-roof
- The complete Großer Tiergarten to Charlottenburger Tor, with Siegessäule,
  Luiseninsel, Rosengarten, Café am Neuen See and the mapped path/tree network
- The Lenné-Eiche (`Quercus petraea Liebl.`) near Carillon at the exact
  Geoportal Berlin tree fingerprint `[-274.82, 3.787, 154.97]`, retaining its
  published 23 m height, 9.5 m crown radius and 0.5 m trunk radius. Its
  dedicated drawn model keeps the photographed root flare, deeply fissured
  trunk, high twin leaders, long horizontal limb, airy asymmetric crown,
  exposed dead tips and small botanical plaque. Owner photographs remain
  reference-only and must never become bundled or runtime textures. Minecraft
  replaces the matching official voxel tree with one draw-call, block-native
  full/mobile variants that preserve the same high fork, reach and open crown.
- The complete 20-work "Skulpturen gegen Krieg und Gewalt" ensemble on the
  former Krolloper grounds between TIPI and the Bundeskanzleramt. Every work
  keeps its current OSM node anchor and an individual procedural silhouette;
  the key Contact, Himmelsschlüssel, Große Knospe III/63 and Todes Mauer Bruch
  models retain their photographed openings, cuts, proportions and ground
  plates. The generic OSM monument pass must not duplicate these 20 works.
  Owner photographs remain reference-only and must never become bundled or
  runtime textures. Full and mobile profiles both retain the entire ensemble;
  mobile may reduce only bounded edge and inscription microdetail.
- The ten-metre Beethoven-Haydn-Mozart monument at its committed Tiergarten
  anchor, retaining the rounded granite understructure, chamfered three-sided
  tinted-marble pavilion, three round-arched white-marble half figures,
  restored gilt appliques, swans, scaled cupola, pinecones and putti/laurel
  crown. Published monument facts and procedural local subdivisions must stay
  source-separated.
- The Holocaust Memorial remains completely free of trees, Creepers, Zombies
  and Skeletons in Minecraft. Voxel-tree filtering and all hostile-mob spawn,
  walkability and movement must use the same rotated protected field plus
  conservative edge clearance. The sparse allowed complement is four
  Creepers, six Zombies and three Skeletons on desktop, or three Creepers,
  five Zombies and two Skeletons in the mobile profile; each profile remains
  one instanced draw call. Loot boxes use the same protected walkability and
  may never appear inside the memorial field.
- The Goethe-Denkmal at exact OSM node `278738513` and the Lessing-Denkmal at
  exact OSM node `884700390`, each as a source-bound close-detail model in the
  four drawn modes plus a separate block-native Minecraft reading; reversible
  Snowstorm accumulation, memorial protection and solid-only pedestrian
  collision must preserve their surrounding mapped paths and approaches. The
  Lessing fence must use the same 28-field, eight-segment chamfered-octagon
  outline for drawn geometry, Minecraft blocks and physical collision.
- The Richard-Wagner-Denkmal at exact OSM node `243487615`, bound to
  Landesdenkmalamt Berlin part object `09046318,T,041`, as the 90th navigable
  sight. The false closed LoD2 shelter envelope `SR00009n` must not survive as
  an occupied building or Minecraft column mass: the source-bound detail model
  keeps the protective canopy open, the front/rear approaches walkable and
  only its authored marble and steel solids collidable.
- The Weidendammer Brücke as the 91st navigable sight, centred on exact OSM
  bridge way `6228081` and bound to Landesdenkmalamt object `09030074`. Its
  current 69.48 x 25.17 m inventory envelope, exactly two forged midspan
  eagles, eight lamp standards and one neo-Baroque railing system must remain
  source-separated from procedural, non-surveyed love-lock placement.
  Minecraft uses one block-native reading without a smooth ornament double.
- Fritz Cremer's Brecht memorial as the 92nd navigable sight at exact OSM node
  `988668382`, retaining the
  published 6 m circular sett platform, the slightly over-life-size seated
  figure on its asymmetric open metal bench and three cylindrical, horizontally
  jointed black-stone steles. Credit Peter Flierl for the installation design,
  Fritz Cremer for the sculpture and Carlo Wloch for stonework/steles; do not
  reproduce the copyrighted poem or quotations.
- The Scharnhorst grave monument as the 93rd navigable sight at exact OSM node
  `273120316`, retaining the
  Berlin-Lexikon's published 5.60 m overall silhouette, two architectural
  piers, Carrara-marble sarcophagus, Friedrich Tieck relief frieze, reclining
  bronze lion and Schinkel iron enclosure. Credit Karl Friedrich Schinkel for
  the architecture, Christian Daniel Rauch for the lion model and Theodor Kalide for its
  execution; use the Schinkel portal for form/material and identify the current
  sarcophagus and frieze as conservation copies.
- The newly established CSD memorial place near Bellevueallee/Ahornsteig at
  exact OSM node `14076715427`, kept separate from the existing owner-supplied
  Queer Rainbow Memorial model and from the 93-place tour catalogue
- Luiseninsel playground opposite the Philharmonie, including mapped paths,
  trees and playground equipment
- Kulturforum, Potsdamer/Leipziger Platz, Anhalter Bahnhof, Kochstraße and the
  WELT balloon
- Both Tiergartentunnel portals and the explicitly labelled approximate
  underground route
- Hauptbahnhof tram/S15 public realm, Futurium and the federal research campus
- Berliner Ensemble and Berlin Friedrichstraße in the bounded north-east lobe
- Friedrichstadt-Palast at its OSM/LoD2 anchor with the documented 110 x 80 m
  main volume, higher stage tower, foyer risalit, stairs, fins and two-storey
  coloured concrete-glass fields; and the Tränenpalast as its separate low
  steel-and-glass pavilion, never swallowed by the Friedrichstraße station
  shell. Full/mobile profiles remain bounded and image-free.
- The bounded City West recognition ensemble: Europa-Center, Allianz-Haus,
  historic Café Kranzler and New Kranzler Eck, Bahnhof Zoologischer Garten,
  Kaiser-Wilhelm-Gedächtniskirche with Breitscheidplatz, and Urania. Each keeps
  OSM/LoD2 as the metric anchor and adds only source-labelled, batched,
  mobile-aware procedural recognition detail.
- The current Helene Weigel installation in the Helene-Weigel-Hof at exact OSM
  node `13841652635`, kept separate from Brecht and from the 93-place tour
  catalogue. Its recognition model must read as a transparent glass cube on a
  white plinth, with the central red folding director's chair and its visible
  crossed scissor frames, the folded red chair/object landscape, light/audio
  elements, cable runs and a large black raster portrait on the glazing. The
  portrait remains procedural geometry; no photograph or portrait texture is
  bundled or loaded.
- Detlev-Rohwedder-Haus, Gropius Bau, Abgeordnetenhaus and Topography of Terror

The committed 93-place landmark catalogue is the release inventory. Keep all
data clipped to the polygon, avoid unbounded whole-city output, and record any
future owner-approved bounds expansion in the changelog and data manifests.

A precise landmark list with coordinates lives in
[`geo_data/regierungsviertel/landmarks.geojson`](geo_data/regierungsviertel/landmarks.geojson)
and [`docs/bounds.md`](docs/bounds.md).

## 4. Hard data / licensing rules — additive source fusion

**Owner policy: additive data fusion.** Use all available permitted
sources together; keep the best evidence from each source per tile. Do
**not** treat any single source as a replacement for another. Do not
silently discard a source because another exists. If sources disagree,
record the conflict and choose evidence according to
[`docs/data.md`](docs/data.md).

### Permitted sources

1. **Berlin LoD2 buildings** — *authoritative building geometry anchor.*
   Source: [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin),
   licensed under [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
   (effectively public domain).
2. **OpenStreetMap** — streets, water, parks, rail, POIs, semantic
   context. Pulled via Overpass / OSMnx / Geofabrik, clipped to the
   Regierungsviertel polygon. Licensed under
   [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
3. **ALKIS / DOP / DGM (Berlin official data)** — official alignment,
   parcel context, orthophoto QA, terrain where useful. Geoportal
   Berlin, dl-de/zero-2-0.
   The official Berlin tree catalogues, public-lighting WFS and 1989
   Vorderlandmauer WFS additionally anchor individual trees, lamp positions
   and the double-row Wall trace; unknown object dimensions remain labelled
   display approximations.
4. **Berlin 3D Mesh Model 2025** — optional archival alignment/QA evidence
   from the June 2025 survey, downloaded only after explicit terms acceptance.
   It is not a production viewer asset: do not commit derived photo GLBs,
   texture crops or hidden fallback shells. LoD2 remains the metric building
   anchor. Any separate public output that actually displays the mesh must
   credit Berlin Partner für Wirtschaft und Technologie GmbH.
5. **Google Maps Platform / Photorealistic 3D Tiles** — *opt-in*
   additive source for photorealistic geometry, texture, alignment,
   and visual reference where permitted by Google's terms. **Not** a
   replacement for Berlin LoD2 or OSM.
6. **Wikimedia Commons / Wikipedia media** — additive visual-reference
   source for freely licensed landmark facade, roof, glass, stone,
   vegetation, and colour cues. Use only files with clear free-license
   metadata (CC0, public domain, CC BY, CC BY-SA). Keep per-file
   attribution in the manifest. **Not** a geometry or semantic source.

### Google opt-in rules (strict)

Google Maps Platform is allowed **only** when all of the following are
set in the run environment:

- `GOOGLE_MAPS_API_KEY` is set.
- `GOOGLE_MAPS_3D_TILES_ENABLED=true`.
- `GOOGLE_MAPS_TERMS_ACCEPTED=true`.

Additional Google constraints (non-negotiable):

- **Never** commit Google API keys. Use `.env` (gitignored).
- **Do not** commit Google raw responses, tile caches, screenshots,
  meshes, or other Google-derived intermediate artefacts by default.
- Raw Google downloads live under
  `geo_data/regierungsviertel/raw/google_3d_tiles/` (gitignored).
- Manifest files written under `geo_data/regierungsviertel/raw/...`
  **must omit API keys** — strip query parameters and store URL
  templates with placeholders.
- Any public-facing output that uses or derives from Google Maps
  Platform content **must** include the required Google attribution /
  product notices per Google's terms, **in addition to** the
  OSM/Geoportal Berlin attribution string.

### Mandatory attribution

Every public-facing artefact (the viewer, exported PNGs in a published
gallery, video clips, social previews) **must** display, at minimum:

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)

When Google Maps Platform content was used in producing the artefact,
append the appropriate Google attribution per their terms. See
[`NOTICE.md`](NOTICE.md).

When Wikimedia Commons / Wikipedia media was directly used for visual
references, texture cues, published reference plates, or derived
material colours, include the visible Wikimedia visual-reference notice
and keep the per-file credits packaged with the artefact.

When the official Berlin 3D Mesh is displayed, append:

> 3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH

### Repository hygiene for geodata

- Do **not** commit raw multi-GB geodata dumps. Only commit small,
  derived, clipped artefacts (GeoJSON, small GeoPackage) for the
  Regierungsviertel polygon.
- Raw downloads (LoD2 CityGML, ALKIS, DOP, DGM, OSM Overpass cache,
  Google 3D Tiles) belong in `geo_data/regierungsviertel/raw/<source>/`
  which is gitignored.
- Wikimedia visual references are the exception for small, explicitly
  licensed thumbnails and QA atlases under `references/wikimedia/`.
  Do not commit arbitrary internet-photo dumps or files with unclear
  rights.

## 5. Pipeline (canonical 10 steps)

If you implement, modify, or debug any step, keep this numbering in
commit messages and PR titles (e.g. `step-4: …`).

1. **Bounds.** Polygon in `geo_data/regierungsviertel/bounds.geojson`.
   Editor TODO: `isometric_berlin.generation.create_bounds`.
2. **LoD2 geometry.** `isometric_berlin.data.fetch_lod2` downloads the
   relevant Berlin LoD2 CityGML tile(s), clips to bounds, writes
   `geo_data/regierungsviertel/buildings.gpkg`.
3. **OSM context.** `isometric_berlin.data.fetch_osm` pulls streets,
   water (Spree), parks (Tiergarten), railway (Hauptbahnhof tracks),
   POIs from Overpass, clipped to bounds. Writes `osm.gpkg`.
4. **ALKIS / DOP / DGM support (optional).**
   `isometric_berlin.data.fetch_official_support` pulls Berlin parcel
   / orthophoto / terrain data for alignment, QA, and terrain.
4a. **Berlin 3D Mesh 2025 (optional archival QA only).**
   `isometric_berlin.data.fetch_berlin_mesh` selects only the source
   tiles intersecting the bounds. Raw OBJ/texture ZIPs remain
   gitignored. Do not publish its derived GLBs or textures in the static
   Three.js viewer; the production scene is procedural LoD2/OSM geometry.
4b. **Official public-space details (official, additive).**
   `isometric_berlin.data.fetch_official_details` clips Berlin's tree,
   public-lighting and Vorderlandmauer WFS layers into
   `geo_data/regierungsviertel/official_details.gpkg`. Raw WFS responses stay
   gitignored.
5. **Google Photorealistic 3D Tiles (opt-in, additive).**
   `isometric_berlin.data.fetch_google_tiles` writes a key-free
   manifest to
   `geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json`.
   Only fetches actual tile content with `--download-content` when
   explicitly approved for the current run.
5a. **Wikimedia visual references (additive, free-license filtered).**
   `isometric_berlin.data.fetch_wikimedia` writes
   `geo_data/regierungsviertel/wikimedia_references.json` plus small
   thumbnails / atlas files in `references/wikimedia/`. These support
   material and facade QA; they do not replace steps 2–4 or the
   Google opt-in source.
6. **Source-fusion manifest.** `isometric_berlin.data.fuse_sources`
   combines all permitted sources into a single fused source-stack
   manifest with provenance per feature/tile (see
   [`docs/data.md`](docs/data.md) and
   [`tasks/done/05-source-fusion-manifest.md`](tasks/done/05-source-fusion-manifest.md)).
   Conflicts are recorded, not silently dropped.
7. **Quadrant grid.** `isometric_berlin.generation.create_grid` builds
   an isometric 512×512 px quadrant grid covering the bounds and
   stores it as placeholder rows in
   `generations/regierungsviertel/quadrants.db`.
8. **Renders.** `isometric_berlin.generation.render_quadrants` builds
   a `pyvista` scene per quadrant from the fused source stack,
   isometric camera, orthographic projection, renders a 1024×1024 PNG
   into the `render` BLOB.
9. **AI tile generation.** `isometric_berlin.generate_tile` POSTs each
   render to a fine-tuned `Qwen/Image-Edit` LoRA on Modal, stores the
   returned pixel-art PNG in the `generation` BLOB. Apply the
   2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the NYC project to
   avoid seams.
10. **DZI export + viewer.**
    `isometric_berlin.generation.export_dzi` runs pyvips to build a
    Deep Zoom pyramid into `src/app/public/dzi/regierungsviertel/`,
    then React + TypeScript + Vite + OpenSeadragon under `src/app/`
    serve it as a static build, deployable via Perplexity hosting
    (see §9).

## 6. Tech stack and conventions

- **Python ≥ 3.12**, `uv` for everything. No `pip`, no `poetry`, no
  `conda`. Run code via `uv run …`, never activate the venv manually.
- **`ruff`** for format + lint. Line length 88, 2-space indent (matches
  upstream NYC style).
- **`pytest`** for tests. Place tests under `tests/`.
- **Type hints required** on all public function signatures.
- **Absolute imports** inside the `isometric_berlin` package.
- **Frontend:** `bun` for install/dev/build under `src/app/`. React +
  TypeScript + Vite + OpenSeadragon.
- **Geometry stack:** `shapely`, `pyproj`, `geopandas`, `osmnx`,
  `rasterio`, `pyvista`, `pyvips`.

Useful commands:

| Task | Command |
| --- | --- |
| Install Python deps | `uv sync` |
| Run tests | `uv run pytest` |
| Format | `uv run ruff format .` |
| Lint | `uv run ruff check .` |
| Dev viewer | `cd src/app && bun install && bun run dev` |
| Build viewer | `cd src/app && bun run build` |

## 7. Repository layout

```
isometric-berlin/
├── AGENTS.md                 # THIS FILE — read first
├── CLAUDE.md                 # → AGENTS.md
├── README.md                 # Human-facing, bilingual DE/EN
├── NOTICE.md                 # Attribution requirements
├── LICENSE                   # MIT
├── CONTRIBUTING.md
├── pyproject.toml
├── .python-version
├── .env.example
├── docs/
│   ├── setup.md
│   ├── bounds.md
│   ├── data.md               # incl. additive fusion + conflict rules
│   ├── generation.md
│   ├── app.md
│   ├── deployment.md
│   ├── perplexity-hosting.md
│   ├── glossary.md
│   └── agents.md
├── geo_data/
│   └── regierungsviertel/
│       ├── README.md
│       ├── bounds.geojson    # MVP polygon
│       ├── landmarks.geojson # Must-be-visible landmarks
│       ├── fused_sources.json # OUTPUT of step 6 (see docs/data.md)
│       └── raw/              # gitignored, raw downloads, incl.
│                             # google_3d_tiles/, alkis/, dop/, dgm/
├── generations/
│   ├── README.md
│   └── regierungsviertel/    # quadrants.db, renders, tiles
├── references/               # Style refs (self-rendered only)
├── inference/                # Modal serving for Qwen-Image-Edit LoRA
├── src/
│   ├── isometric_berlin/     # Python pipeline package
│   │   ├── data/             # fetch_*, fuse_sources
│   │   └── generation/
│   └── app/                  # React + OpenSeadragon viewer
└── tests/
```

## 8. What success looks like (Definition of Done v0.72.32)

- `geo_data/regierungsviertel/bounds.geojson` finalised and reviewed.
- LoD2 buildings clipped, OSM context clipped, both stored as small
  GeoPackages in the repo.
- A fused source-stack manifest at
  `geo_data/regierungsviertel/fused_sources.json` referencing all
  permitted sources that were available at fusion time, with
  per-feature provenance and a recorded conflict log.
- A `quadrants.db` covering the bounds with rendered source PNGs and
  AI-generated pixel-art PNGs for every quadrant. This SQLite DB is a
  regenerated intermediate (`generations/**/*.db` is gitignored): it is
  rebuilt on demand by `create_grid` → `render_quadrants` →
  `generate_tile`, not committed. The committed deliverable is the DZI
  pyramid below.
- A DZI pyramid built into `src/app/public/dzi/regierungsviertel/`.
- A working static viewer (`bun run build`) under `src/app/dist/`
  that pans/zooms cleanly, shows the required attribution overlay
  (including Google attribution if Google content was used), and
  renders all 93 catalogued sights in the same coordinate frame.
- All four shipped landmark payloads remain synchronised at 93 records; the
  alignment audit passes 41 relative-placement contracts and preserves the
  three established manual-review anchors.
- A true Three.js mode using procedural Berlin LoD2/OSM geometry, with
  progressive loading, complete instanced building coverage, mouse/touch
  orbit, a real below-ground camera and a schematic Tiergartentunnel cutaway.
  Retired GLBs and heavy road plates stay absent; the DZI remains the fast
  detail-map fallback.
- All landmarks and required context details from §3 are navigable. Hero
  recognition geometry may supplement, but never displace, the measured
  LoD2/OSM anchors.
- Goethe and Lessing remain independently selectable at their exact OSM
  anchors. Day, Night, Snowstorm and Schwellenraum share the source-bound drawn
  monuments; Minecraft uses block-native counterparts without smooth doubles.
  Snow is reversible, memorial protection stays non-enterable, pedestrian
  collision follows represented core/fence-side solids instead of closing the
  surrounding park paths, and no visual-reference photograph is loaded by the
  viewer.
- The frozen Goethe/Lessing detail profile keeps snow-free heights of 6.08 m
  and 7.00 m. Goethe retains 42 fence fields and three paired allegory
  groups/six figures; Lessing retains five steps, two basins with dolphin
  spouts, three portrait fields, two principal bronze allegories and a
  28-field/eight-segment chamfered-octagon fence shared by drawn, Minecraft and
  collision forms. Their combined Smooth Snowstorm budget is exactly 8
  renderables / 24,870 rendered vertices; Minecraft is one InstancedMesh / 557
  blocks / 13,368 rendered vertices, for 9 stored renderables across both
  representations. Protection
  radii are 4.3 m and 2.95 m; physical collision remains core-plus-fence-side
  only, and all eight sampled approach directions remain free.
- Wagner remains independently selectable at OSM node `243487615` and official
  monument part `09046318,T,041`. Day, Night, Snowstorm and Schwellenraum share
  its source-bound drawn root; Minecraft substitutes a block-native reading.
  The former closed LoD2 shelter `SR00009n` stays removed. Smooth presentation
  is frozen at 6 renderables / 12,167 rendered vertices; Minecraft is one batch
  / 514 blocks. Front, rear, side and high shelter approaches remain open,
  collision follows only authored granular solids, and no reference photograph
  or photographic texture is loaded by the viewer.
- FUNBOX remains on its bounded Wunderland-Festplatz display envelope with a
  measured minimum **2.553 m** clearance from the delivered OSM-derived road
  surfaces. Drawn presentation stays frozen at 5 renderables / 7,921 rendered
  vertices and Minecraft at 62 blocks; both full and mobile-like Minecraft
  profiles use the same structural footprint and remain clear of the northern
  Tiergartentunnel portal and source voxel buildings.
- The Moabit prison memorial park uses all 19 exact mapped wall segments: the
  four segments of OSM way `105495351` retain their explicit 4 m height and the
  other 15 use Berlin's published general 5 m wall height only as a display
  value, not as per-segment survey evidence. Full Smooth presentation is frozen
  at 5 renderables / 7,818 rendered vertices and mobile Smooth at 5 / 5,448;
  Minecraft is one batch with 3,882 / 2,093 blocks and 93,168 / 50,232 rendered
  instance vertices for full / mobile. The exact Panoptikum and retained LoD2
  cell do not replace or duplicate source park, lawn, path, tree or cell
  geometry. Ordinary collision keeps the three mapped entrance gaps and cell
  approach open while Schwellenraum retains whole-park protection. No
  photograph, protected plan or photographic texture is bundled or loaded.
- Weidendammer Brücke remains independently selectable as catalogue sight 91,
  after Richard Wagner as sight 90; Brecht and Scharnhorst follow as sights 92
  and 93. The separate CSD memorial place is not added to the tour catalogue.
  Weidendammer's official 69.48 x 25.17 m envelope carries
  exactly two forged eagle reliefs, eight lamp standards and one railing system.
  Full Smooth is frozen at 5 renderables / 46,568 stored vertices / 90,116
  rendered vertices / 192 procedural love locks; mobile Smooth at 5 / 32,744 /
  54,404 / 96. Minecraft is one batch with 344 / 224 blocks and 8,256 / 5,376
  rendered instance vertices for full / mobile. The roadway and pavements stay
  walkable while represented rail, lamp and eagle solids remain collidable. The
  Biermann association is factual cultural context only: no song lyric,
  photograph, plan or texture is reproduced or loaded.
- The Brecht installation keeps its traversable 6 m sett platform around the
  granular seated figure/open bench and three cylindrical steles. Day, Night,
  Snowstorm and Schwellenraum share one drawn public-art root; Minecraft uses a
  deterministic block-native replacement with no smooth duplicate. Full and
  mobile Smooth are identical at 3 renderables / 38,400 stored and rendered
  vertices; Minecraft is 4 batches / 197 blocks / 4,728 rendered instance
  vertices over one 24-vertex cube. The close camera uses 14 m and the fine
  layer 34/105 m hysteresis.
  Fine incision cues carry no poem or quotation text.
- The current Helene Weigel work remains independently anchored at exact OSM
  node `13841652635` in the Helene-Weigel-Hof. Its white plinth supports a
  transparent glass cube containing a central red folding director's chair
  with two visible crossed scissor frames, a folded red chair/object landscape,
  light/audio elements and visible cable runs. A large black procedural raster
  portrait reads on the glass without loading a photograph, portrait crop or
  portrait texture. The installation remains visible in Day, Night, Snowstorm,
  Minecraft and Schwellenraum without becoming a 94th tour stop.
- Scharnhorst reads as a 5.60 m architectural tomb rather than a generic lion
  blob: two piers and the Carrara sarcophagus carry the Tieck frieze and a real
  reclining bronze-lion silhouette within the Schinkel railing. The structural
  lion remains visible when close-only mane/face/claw detail fades. All drawn
  modes remain static and protected; Minecraft uses its separate block-native
  signature. Full and mobile Smooth are identical at 8 renderables / 554 stored
  / 15,539 rendered vertices; its Minecraft contribution is 4 batches / 566
  blocks / 13,584 rendered instance vertices over one 24-vertex cube. The 18 m
  focus uses the exact OSM anchor, and collision keeps the centre between the
  two piers open.
  Unpublished part proportions remain procedural display geometry.

## 9. Hosting target: Perplexity

The owner intends to publish the viewer through Perplexity. Optimise
for this:

- Keep the viewer **fully static** after `bun run build` —
  `index.html` + `assets/*` + `dzi/regierungsviertel/*`. No backend
  required at serve time.
- All paths inside the built viewer must be **relative**
  (`./dzi/regierungsviertel/…`), so the site works under any subdomain
  or sub-path. Configure Vite's `base: './'`.
- DZI tile pyramid should be small enough to ship inside the static
  bundle (low hundreds of source tiles → a few thousand pyramid
  tiles, each a small WebP). Target total bundle size **< 200 MB**,
  ideally **< 50 MB**. If it grows beyond that, switch to hosting the
  DZI pyramid on Cloudflare R2 and keep only the HTML/JS/CSS in the
  Perplexity-hosted bundle.
- When a Perplexity agent deploys this, it will run
  `cd src/app && bun install && bun run build`, then deploy
  `src/app/dist/`. Make sure that command sequence always works from
  a clean clone.
- Attribution overlay (§4) must be hard-coded in the viewer chrome,
  not in a separate footer file that could be stripped during
  deployment.

## 10. How to behave as an agent in this repo

When you (Codex, Claude Code, Cursor, Gemini CLI, Perplexity) pick up
a task:

1. **Re-read this file** and the relevant `docs/*.md`. Skim
   `README.md` for the bilingual context. Read `NOTICE.md`.
2. **State the plan before editing.** Identify which of the 10
   pipeline steps you are working on. Reference the step number.
3. **Stay in scope.** Regierungsviertel only. Permitted sources only.
   Google only when the three opt-in env vars are set. No raw
   multi-GB commits. No API keys in commits.
4. **Prefer small, reversible changes.** One pipeline step per PR /
   per session.
5. **Use `uv` and `bun` only.** Never invent a new package manager.
6. **Write/extend tests** in `tests/` when you touch Python code.
7. **Run `uv run ruff format .` and `uv run ruff check .`** and
   `uv run pytest` before handing back to the owner.
8. **Never silently broaden scope, never silently switch data
   sources, never silently drop a permitted source, never silently
   change the license.**
9. **Commit messages:** `step-<n>: <short imperative>` (e.g.
   `step-5: fetch Google 3D Tiles manifest for Regierungsviertel`).
10. **Open questions go in `docs/` or in PR descriptions**, not in
    silent code comments that nobody will see.

## 11. Things that will get a PR rejected immediately

- **Silently dropping a permitted source.** Additive fusion is owner
  policy (see §4). If you must skip a source for a given tile,
  record it as a conflict per `docs/data.md`, do not delete it.
- **Treating Google as a replacement** for Berlin LoD2 or OSM, or
  using Google without the three opt-in env vars set
  (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_3D_TILES_ENABLED=true`,
  `GOOGLE_MAPS_TERMS_ACCEPTED=true`).
- **Committing Google API keys**, Google raw responses, Google tile
  caches, Google-derived meshes/screenshots, or any other
  Google-derived intermediate artefact.
- **Manifest files that contain API keys** — keys must be stripped
  before writing.
- Committing raw `.gml`, `.citygml`, `.osm`, `.osm.pbf`, `.tif`,
  `.tiff`, `.glb`, `.b3dm`, `.json` Google tile responses, or an
  unbounded binary > 5 MiB outside of `references/`. The bounded canonical
  `buildings.gpkg`, `osm.gpkg` and `osm_context_buildings.gpkg` may grow to
  10 MiB, 16 MiB and 8 MiB respectively when an owner-approved bounds revision
  requires the complete clipped source; release tests enforce those ceilings.
  Bounded, derived `src/app/public/mesh/regierungsviertel/*.glb` files remain
  below 5 MiB; lossless prism/Minecraft JSON has a separate measured 7 MiB
  ceiling. All public assets must pass release QA.
- **Removing or altering the required attribution string** — including
  failing to add Google attribution when Google content was used.
- Changing the LICENSE without owner sign-off.
- Replacing `uv` with `pip`/`poetry`, or `bun` with `npm`/`pnpm`.
- Building anything outside the currently committed bounds without explicit
  owner approval and a documented bounds revision.
- Hardcoding absolute URLs for the DZI tiles that break under
  Perplexity hosting.

## 12. Owner profile (helps with judgement calls)

- Owner: Klotzkette, based in Berlin.
- Communicates primarily in German; code, comments, commit messages,
  and docs in English. The user-facing README is bilingual DE/EN.
- Prefers concise, professional answers without filler.
- Will run most agent sessions through **Codex** for cost reasons,
  occasionally through Claude Code or Perplexity. Treat all three as
  equally privileged readers of this file.

---

If anything in this file is ambiguous for your current task, **stop
and ask the owner before guessing.** Scope discipline beats velocity
on this project.
