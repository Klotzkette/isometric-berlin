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
with AI from open city data. It is the Berlin equivalent of
[isometric.nyc](https://isometric.nyc) by Andy Coenen, but scoped down
to a single neighbourhood for v0.1, and built **only on open data** —
no Google Maps 3D Tiles, no proprietary imagery. The final deliverable
is a static, OpenSeadragon-based pan/zoom viewer plus the DZI tile
pyramid that backs it.

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

## 4. Hard data / licensing rules

- **No Google Maps 3D Tiles API.** No Google imagery. No
  `GOOGLE_TILES_API_KEY`, no `GOOGLE_MAPS_API_KEY` in any code path.
  The NYC project used it; we deliberately do not.
- Allowed geometry source: **Berlin LoD2 buildings** from
  [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin),
  licensed under [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
  (effectively public domain).
- Allowed context source: **OpenStreetMap** via Overpass / OSMnx /
  Geofabrik extracts of the Berlin bounding box (then clipped to the
  Regierungsviertel polygon), licensed under
  [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Every public-facing artefact (the viewer, exported PNGs, video
  clips, social previews) **must** display:

  > © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)

  See [`NOTICE.md`](NOTICE.md).

- Do **not** commit raw multi-GB geodata dumps. Only commit small,
  derived, clipped artefacts (GeoJSON, small GeoPackage) for the
  Regierungsviertel polygon. Raw downloads belong in
  `geo_data/regierungsviertel/raw/` which is gitignored.

## 5. Pipeline (canonical 8 steps)

If you implement, modify, or debug any step, keep this numbering in
commit messages and PR titles (e.g. `step-4: …`).

1. **Bounds.** Polygon in `geo_data/regierungsviertel/bounds.geojson`.
   Editor TODO: `isometric_berlin.generation.create_bounds` (analogous
   to NYC's Leaflet bounds editor).
2. **LoD2 geometry.** `isometric_berlin.data.fetch_lod2` downloads the
   relevant Berlin LoD2 CityGML tile(s), clips to bounds, writes
   `geo_data/regierungsviertel/buildings.gpkg`.
3. **OSM context.** `isometric_berlin.data.fetch_osm` pulls streets,
   water (Spree), parks (Tiergarten), railway (Hauptbahnhof tracks),
   POIs from Overpass, clipped to bounds. Writes `osm.gpkg`.
4. **Quadrant grid.** `isometric_berlin.generation.create_grid` builds
   an isometric 512×512 px quadrant grid covering the bounds and
   stores it as placeholder rows in
   `generations/regierungsviertel/quadrants.db`.
5. **Renders.** `isometric_berlin.generation.render_quadrants` builds
   a `pyvista` scene per quadrant, isometric camera, orthographic
   projection, renders a 1024×1024 PNG into the `render` BLOB.
6. **AI tile generation.** `isometric_berlin.generate_tile` POSTs each
   render to a fine-tuned `Qwen/Image-Edit` LoRA on Modal, stores the
   returned pixel-art PNG in the `generation` BLOB. Apply the
   2×2 / 1×2 / 2×1 / 1×1 adjacency rules from the NYC project to
   avoid seams.
7. **DZI export.** `isometric_berlin.generation.export_dzi` runs
   pyvips to build a Deep Zoom pyramid into
   `src/app/public/dzi/regierungsviertel/`.
8. **Viewer.** React + TypeScript + Vite + OpenSeadragon under
   `src/app/`. Static build, deployable to GitHub Pages or Perplexity
   website hosting (see §9).

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
│   ├── data.md
│   ├── generation.md
│   ├── app.md
│   └── deployment.md
├── geo_data/
│   └── regierungsviertel/
│       ├── README.md
│       ├── bounds.geojson    # MVP polygon
│       ├── landmarks.geojson # Must-be-visible landmarks
│       └── raw/              # gitignored, raw downloads
├── generations/
│   ├── README.md
│   └── regierungsviertel/    # quadrants.db, renders, tiles
├── references/               # Style refs (self-rendered only)
├── inference/                # Modal serving for Qwen-Image-Edit LoRA
├── src/
│   ├── isometric_berlin/     # Python pipeline package
│   │   ├── data/
│   │   └── generation/
│   └── app/                  # React + OpenSeadragon viewer
└── tests/
```

## 8. What success looks like (Definition of Done v0.1)

- `geo_data/regierungsviertel/bounds.geojson` finalised and reviewed.
- LoD2 buildings clipped, OSM context clipped, both stored as small
  GeoPackages in the repo.
- A `quadrants.db` covering the bounds with rendered source PNGs and
  AI-generated pixel-art PNGs for every quadrant.
- A DZI pyramid built into `src/app/public/dzi/regierungsviertel/`.
- A working static viewer (`bun run build`) under `src/app/dist/`
  that pans/zooms cleanly, shows the required attribution overlay,
  and renders the eight required landmarks recognisably.
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
2. **State the plan before editing.** Identify which of the 8
   pipeline steps you are working on. Reference the step number.
3. **Stay in scope.** Regierungsviertel only. Open data only. No
   Google APIs. No raw multi-GB commits.
4. **Prefer small, reversible changes.** One pipeline step per PR /
   per session.
5. **Use `uv` and `bun` only.** Never invent a new package manager.
6. **Write/extend tests** in `tests/` when you touch Python code.
7. **Run `uv run ruff format .` and `uv run ruff check .`** before
   handing back to the owner.
8. **Never silently broaden scope, never silently switch data
   sources, never silently change the license.**
9. **Commit messages:** `step-<n>: <short imperative>` (e.g.
   `step-2: fetch and clip Berlin LoD2 to Regierungsviertel`).
10. **Open questions go in `docs/` or in PR descriptions**, not in
    silent code comments that nobody will see.

## 11. Things that will get a PR rejected immediately

- Any use of Google Maps / Google Tiles API.
- Committing raw `.gml`, `.citygml`, `.osm`, `.osm.pbf`, `.tif`,
  `.tiff` files, or any binary > 5 MB outside of `references/`.
- Removing or altering the required attribution string.
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
