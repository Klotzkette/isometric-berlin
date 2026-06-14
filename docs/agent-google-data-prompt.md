# Prompt — tell coding agents Google data is now allowed

Copy this prompt into Claude Code, Cursor, Gemini CLI, Perplexity, or
another coding agent before assigning Google-related work in this repo.

```text
You are working in Klotzkette/isometric-berlin.

Important owner decision: Google Maps Platform data is now allowed as an
explicit opt-in source for the Berlin Regierungsviertel project. The
goal is additive data fusion: combine Berlin open data (Geoportal
Berlin LoD2, ALKIS/DOP/DGM where useful), OSM, and Google
Photorealistic 3D Tiles / Map Tiles API to make the best possible
source stack for each tile.

Read AGENTS.md completely before editing. The current policy is:

- Stay inside the Regierungsviertel bounds.
- Do not treat Google as replacing Berlin open data or OSM.
- Fuse sources deliberately:
  LoD2 = authoritative building geometry anchor.
  OSM = streets, water, parks, rail, POIs, semantic context.
  ALKIS/DOP/DGM = official alignment, parcel/terrain/orthophoto QA.
  Google 3D Tiles = opt-in photorealistic geometry/texture/alignment
  reference where permitted.
- Google support must be opt-in only:
  GOOGLE_MAPS_API_KEY must be set.
  GOOGLE_MAPS_3D_TILES_ENABLED=true must be set.
  GOOGLE_MAPS_TERMS_ACCEPTED=true must be set.
- Never commit Google API keys.
- Do not commit Google raw responses, tile caches, screenshots, meshes,
  or other Google-derived intermediate artefacts by default.
- Put raw Google-derived files under
  geo_data/regierungsviertel/raw/google_3d_tiles/; this path is
  gitignored.
- Manifest files must omit API keys.
- Public output that includes or derives from Google Maps Platform
  content must include the required Google attribution/product notices.

The Google fetcher is:

uv run python -m isometric_berlin.data.fetch_google_tiles \
  --bounds geo_data/regierungsviertel/bounds.geojson \
  --out geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json

Use --download-content only when the owner has explicitly confirmed
that storing Google-derived intermediate artefacts locally is permitted
for the current workflow.

After source fetching, keep the fusion contract rather than choosing a
single winner. The current fused manifest is
geo_data/regierungsviertel/fused_sources.json and the completed task
notes are in tasks/done/05-source-fusion-manifest.md. If Google is
enabled, update the Google manifest and then re-run fuse_sources so the
source-stack manifest records google3d as additive evidence without
dropping LoD2, OSM, ALKIS, DOP, or DGM.

Before handing back: run
uv run ruff format .
uv run ruff check .
uv run pytest
```
