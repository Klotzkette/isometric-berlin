# Hosting via Perplexity

The public release currently runs on GitHub Pages. The same static build can
also be deployed through a Perplexity static-site flow, such as `pplx.app`.
This document records the portable build and path requirements; a different
hosting destination does not require another rendering mode.

## Build target

- `cd src/app && bun install && bun run build` must work from a clean clone
  with the committed clipped runtime data.
- The output lives in `src/app/dist/` and is fully static: `index.html`,
  `assets/*`, procedural scene data under `mesh/regierungsviertel/` and a
  small set of support images/metadata under `dzi/regierungsviertel/`.
- Since v1.0.28, only the isometric Three.js viewer is built. The historical
  DZI directory name remains for support assets; no tile pyramid or separate
  flat-map engine is loaded or published.
- Vite uses `base: './'`. Every runtime asset must resolve under the deployed
  subdomain and sub-path.
- Test from an HTTP origin. Browser module and JSON loading is not supported
  by directly opening `index.html` through `file://`.
- The 93-place landmark navigation payload is bundled into the app.

## Asset delivery

Deploy the complete `src/app/dist/` directory. Procedural scene JSON, the
walking minimap, the small startup backdrop and source metadata remain local
to the static site. No remote DZI host, R2 bucket or `VITE_DZI_BASE_URL` setting
is needed by the viewer. The archival Python export pipeline remains available
separately and its tile pyramid is excluded from the current build.

Preserve existing hashed JavaScript assets during an update so an already-open
page can finish its lazy imports. The app also performs one version-scoped
reload after a stale-module failure and offers explicit recovery if a problem
persists.

## Path discipline

- Do not hard-code `localhost`, `github.io` or a deployment hostname into
  runtime asset URLs.
- Resolve relative assets from `import.meta.env.BASE_URL` or the loaded scene
  manifest, without assuming the site is hosted at `/`.
- If service workers are added, scope them to the relative base.
- Serve the output with the correct JavaScript, JSON and image content types.

## Local release launch

The downloadable package uses its bundled HTTP server to open this same 3D
app. `START-HERE.html` is a file-safe launch guide: it shows platform-specific
instructions when double-clicked and redirects to `index.html` over HTTP,
retaining query and hash. It contains no second renderer.

## Attribution overlay

The OSM + Geoportal Berlin attribution string from
[`../NOTICE.md`](../NOTICE.md), together with the required visual-reference
credits, stays hard-coded in the viewer chrome. Do not strip it during hosting
or packaging. Source geometry and licensing requirements are unchanged.

## Deploy checklist for a Perplexity agent

1. Clone the repository and run `uv sync`; run `bun install` under `src/app/`.
2. Run `cd src/app && bun run build` against the committed runtime assets.
3. Serve `src/app/dist/` over HTTP and verify that the full isometric scene
   loads, controls respond, all five visual modes work and attribution is visible.
4. Confirm that asset URLs remain relative and no flat-map tile requests occur.
5. Deploy the complete `src/app/dist/` to the requested static-site target.
6. Repeat the load, movement, mode-switch and attribution checks on the public
   URL, including a phone-sized viewport and a legacy `?view=map` URL.
