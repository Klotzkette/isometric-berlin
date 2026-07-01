# Hosting via Perplexity

The intended publication channel for the finished viewer is
**Perplexity** — likely through the `pplx.app` static-site deployment
flow that Perplexity agents can drive. This document captures the
constraints that flow puts on the build, so any agent (Codex, Claude
Code, Cursor, Gemini CLI, or Perplexity itself) can ship without
re-deriving them.

## Build target

- `cd src/app && bun install && bun run build` must work from a clean
  clone with **only** `uv` and `bun` installed.
- The output lives in `src/app/dist/` and is fully static:
  `index.html` + `assets/*` + a copy of `dzi/regierungsviertel/`
  next to it (or a remote DZI URL — see below).
- Vite must be configured with `base: './'` so all asset URLs are
  relative. The site must work under any subdomain, any sub-path, and
  when opened via `file://` for local sanity checks.
- Landmark navigation is bundled into the app so downloaded local
  packages do not need `fetch()` for `landmarks.json`.

## DZI hosting strategy

Two acceptable options, chosen at build time:

1. **Inline DZI (preferred while small).** Copy the DZI pyramid into
   `src/app/public/dzi/regierungsviertel/` before `bun run build`.
   The whole site (HTML + JS + CSS + DZI) ships in one bundle.
   Target total size: **< 50 MB**, hard ceiling **< 200 MB**.
2. **Remote DZI on R2.** Upload the DZI pyramid to a Cloudflare R2
   bucket (CORS-enabled, public read) and set
   `VITE_DZI_BASE_URL="https://…/dzi/regierungsviertel"` before
   building. The bundle then carries HTML/JS/CSS plus the small bundled
   landmark-navigation payload.

The MVP is small enough that option 1 should work cleanly. Re-evaluate
if pyramid size approaches 100 MB.

## Path discipline

- No absolute paths to `localhost`, `github.io`, or any specific
  hostname in committed code.
- No hard-coded `window.location.origin` assumptions; if a path needs
  to be resolved at runtime, derive it from `import.meta.env.BASE_URL`.
- Service workers, if added, must scope to the relative `base`.

## Attribution overlay

The OSM + Geoportal Berlin attribution string from
[`../NOTICE.md`](../NOTICE.md) must be hard-coded into the viewer
component, not injected by a separate footer file that could be
stripped during deployment.

## Deploy checklist for a Perplexity agent

1. Clone repo, run `uv sync` and `bun install` under `src/app/`.
2. Ensure `src/app/public/dzi/regierungsviertel/` is populated (or
   set `VITE_DZI_BASE_URL`).
3. `cd src/app && bun run build`.
4. Verify `src/app/dist/index.html` references all assets via `./…`.
5. Deploy `src/app/dist/` to the Perplexity static-site target.
6. Sanity check: open the deployed URL, confirm pan/zoom works and
   the attribution overlay is visible in the viewer chrome.
