# Deployment and release package

The complete viewer is static after `bun run build`: React/Three.js assets, 74
bounded official-mesh GLBs and the OpenSeadragon DZI pyramid live below
`src/app/dist/`. Runtime needs no AI service, API key or backend. Vite uses
relative paths, so the directory can be served from a subpath or static host.

The same build is public at
[klotzkette.github.io/isometric-berlin](https://klotzkette.github.io/isometric-berlin/).
The GitHub release ZIP linked at the top of `README.md` is the supported
offline deliverable for macOS and Windows. Build both outputs from a clean tree
with:

```bash
cd src/app
bun install
bun run build
cd ../..
uv run python scripts/package_static_site.py
uv run python scripts/check_release_readiness.py
uv run python scripts/smoke_local_package.py
```

`package_static_site.py` writes both
`isometric-berlin-regierungsviertel-local.zip` and the independently deployable
`isometric-berlin-viewer-v<version>.tar.gz`. Do not recreate the tarball with
the macOS system `tar`: it can inject AppleDouble `._…` metadata files. The
Python packager normalizes timestamps and ownership, excludes source maps and
produces byte-identical output for identical builds.

The package contains two entries:

- `START-HERE.html` is the double-click, zero-server 2D compatibility view.
- `index.html` is the complete 3D viewer and must be served over local HTTP.
  Windows users double-click `start-windows.bat`; macOS/Linux users run
  `python3 serve-local.py` from the extracted folder.

The generated server verifies the declared size and SHA-256 of every GLB before
opening the browser. Release readiness performs the same check against the
source tree, extracted package and final ZIP, verifies every DZI tile, and
rejects hidden, duplicate or stale 3D assets. The same gate parses the static
tarball, rejects links/special files/path traversal and verifies all scene and
DZI payloads before tagging.

## Hashed lazy assets and already-open tabs

The public host must retain hashed JavaScript, CSS and Worker assets from the
current release and **at least the previous two live releases**. An open tab can
hold an older HTML manifest for hours and request its lazy Three.js or Worker
chunk only when the visitor later selects a 3D mode. Deleting every old file in
`assets/` during deployment turns that valid interaction into a 404.

Publish new root files and mutable metadata normally, but merge the new
`dist/assets/` directory into the hosted `assets/` directory without a blanket
delete. Prune a hashed file only after it is outside the current-plus-two-live-
release retention window. This compatibility store is a GitHub Pages policy;
the downloadable ZIP and static tarball contain only the current build and must
continue to reject duplicate or stale assets.

The v0.72.3 runtime adds a second line of defence. Its early
`vite:preloadError` listener performs at most one version-scoped reload so the
tab can acquire the current HTML manifest, and the successful Three.js import
clears that guard. If loading or rendering still fails, a visible boundary
offers Reload and the 2D map rather than leaving the 3D surface blank. Asset
retention remains required because it also preserves uninterrupted sessions
that have not yet loaded the new recovery runtime.

v0.72.9 separately bounds failures after the 3D runtime is already active.
Recovery is not gated by touch capability: every profile releases the failed
canvas and active world and performs exactly one clean remount for that world
family. A second failure presents explicit Recovery and 2D-map actions; it does
not start another renderer, retain a second world or select the DZI map
automatically. Separately, a mobile-like touch session—primary or any coarse
pointer, or `navigator.maxTouchPoints > 0`—keeps only one heavy world family
resident across family changes. Non-touch desktop's complete warm-scene
behavior remains available only while switching among live 3D modes; moving
to the DZI map releases WebGL on every device. These are source,
production-profile and automated-browser release contracts, not a claim of
physical iOS-device validation.

If a future deployment separates heavy assets, the DZI pyramid and mesh can be
placed on an object store such as Cloudflare R2. Attribution and relative-path
requirements from `AGENTS.md` and `NOTICE.md` remain mandatory.
