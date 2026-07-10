# Deployment and release package

The complete viewer is static after `bun run build`: React/Three.js assets, 45
bounded official-mesh GLBs and the OpenSeadragon DZI pyramid live below
`src/app/dist/`. Runtime needs no AI service, API key or backend. Vite uses
relative paths, so the directory can be served from a subpath or static host.

GitHub Pages is intentionally offline at the owner's request. The supported
public deliverable is the GitHub release ZIP linked at the top of `README.md`.
Build it from a clean tree with:

```bash
cd src/app
bun install
bun run build
cd ../..
uv run python scripts/package_static_site.py
uv run python scripts/check_release_readiness.py
uv run python scripts/smoke_local_package.py
```

The package contains two entries:

- `START-HERE.html` is the double-click, zero-server 2D compatibility view.
- `index.html` is the complete 3D viewer and must be served over local HTTP.
  Windows users double-click `start-windows.bat`; macOS/Linux users run
  `python3 serve-local.py` from the extracted folder.

The generated server verifies the declared size and SHA-256 of every GLB before
opening the browser. Release readiness performs the same check against the
source tree, extracted package and final ZIP, verifies every DZI tile, and
rejects hidden, duplicate or stale 3D assets.

If a future deployment separates heavy assets, the DZI pyramid and mesh can be
placed on an object store such as Cloudflare R2. Attribution and relative-path
requirements from `AGENTS.md` and `NOTICE.md` remain mandatory.
