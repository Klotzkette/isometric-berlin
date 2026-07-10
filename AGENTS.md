# AGENTS.md — Instructions for Codex, Claude Code, Cursor, Gemini CLI, and Perplexity

> **Read this file completely before doing anything in this repo.**
> If you only read one file, read this one. It is the single source
> of truth for *what* this project is, *why* it exists, *what scope
> you must stay inside*, and *what is forbidden*. The corresponding
> `CLAUDE.md` redirects here on purpose.

---

## 1. Project mission (in one paragraph)

Build a giant, zoomable, **SimCity-style isometric pixel-art map of the
Berlin Regierungsviertel** (Government Quarter), generated tile-by-tile
with AI from open and permitted city data. It is the Berlin equivalent
of [isometric.nyc](https://isometric.nyc) by Andy Coenen, scoped down
to a single neighbourhood for v0.1. Per owner policy this project uses
**additive data fusion**: every permitted source contributes; the best
evidence from each source is kept per tile.

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

## 3. Hard scope rules (v0.1)

The MVP **only** covers the Berlin Regierungsviertel polygon
in [`geo_data/regierungsviertel/bounds.geojson`](geo_data/regierungsviertel/bounds.geojson).

Must be inside the polygon and visible in the final map:

- Brandenburger Tor (south-east corner, Pariser Platz)
- Reichstagsgebäude (incl. the glass dome — this is a hero tile)
- Bundeskanzleramt
- Paul-Löbe-Haus
- Marie-Elisabeth-Lüders-Haus
- Berlin Hauptbahnhof (north-west corner, incl. the glass roof — hero tile)
- Haus der Kulturen der Welt ("Schwangere Auster") with its bow-roof
- Eastern strip of the Tiergarten with the Spree
- Tiergartentunnel south entrance at Sony Center / Potsdamer Platz
  (south edge — the tunnel mouth must be visible, the rest of
  Potsdamer Platz does not need to be)

**Do not** expand bounds, add boroughs, pull whole-city LoD2 dumps,
download full OSM Berlin pbf, or work on additional landmarks before
v0.1 ships. If a task seems to require it, **stop and ask the owner**.

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
4. **Berlin 3D Mesh Model 2025** — official photogrammetric surface
   geometry and aerial texture from the June 2025 survey, downloaded
   tile-by-tile from the Berlin 3D Downloadportal after explicit terms
   acceptance. LoD2 remains the metric building anchor. Public output
   must credit Berlin Partner für Wirtschaft und Technologie GmbH.
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
4a. **Berlin 3D Mesh 2025 (official, additive).**
   `isometric_berlin.data.fetch_berlin_mesh` selects only the source
   tiles intersecting the bounds. Raw OBJ/texture ZIPs remain
   gitignored. `isometric_berlin.generation.prepare_webgl_mesh` writes
   bounded, derived GLBs below 5 MiB each for the static Three.js viewer.
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

## 8. What success looks like (Definition of Done v0.1)

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
  renders the eight required landmarks recognisably.
- A true Three.js mode using the official Berlin 3D Mesh, with progressive
  loading, mouse/touch orbit, a real below-ground camera and a schematic
  Tiergartentunnel cutaway. The DZI remains the fast detail-map fallback.
- All eight landmarks from §3 are visually identifiable (hero tiles
  for Reichstag dome and Hauptbahnhof glass roof may be hand-touched).

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
  `.tiff`, `.glb`, `.b3dm`, `.json` Google tile responses, or any
  binary > 5 MB outside of `references/`. The only GLB exception is
  the bounded, derived `src/app/public/mesh/regierungsviertel/*.glb`
  web asset set; every file must remain below 5 MiB and pass release QA.
- **Removing or altering the required attribution string** — including
  failing to add Google attribution when Google content was used.
- Changing the LICENSE without owner sign-off.
- Replacing `uv` with `pip`/`poetry`, or `bun` with `npm`/`pnpm`.
- Building anything outside the Regierungsviertel bounds in v0.1.
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
