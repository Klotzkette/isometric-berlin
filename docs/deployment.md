# Deployment and release package

The complete viewer is static after `bun run build`: React/Three.js assets,
eight compact source-derived world JSON files, walking minimap and startup
backdrop live below `src/app/dist/`. The viewer always uses the isometric 3D
scene; retired flat-map tiles and the separate 2D renderer are excluded. No GLB
or source photograph ships in the current release. v1.0.41 adds a hashed,
streamed NDJSON asset containing exact asphalt, paving and kerb batches,
prepared offline from the retained source polygons. It also prepares precise
land/water boundaries in the viewer bundle. The retired whole-city `.plate.gz`
format remains excluded; the new worker decodes one bounded road batch at a
time and waits for attachment before continuing.
Runtime needs no AI service, API key or backend. Vite uses relative paths, so the directory can be served from a
subpath or static host.

The same build is public at
[klotzkette.github.io/isometric-berlin](https://klotzkette.github.io/isometric-berlin/).
The GitHub release ZIP linked at the top of `README.md` is the supported
offline deliverable for macOS, Windows and Linux. Build both outputs from a
clean tree with:

```bash
cd src/app
bun install
bun run build
cd ../..
uv run python scripts/package_static_site.py
uv run python scripts/check_release_readiness.py
uv run python scripts/smoke_local_package.py
```

## Browser startup gate

Asset hashes and HTTP checks do not execute the scene. Before publishing, serve
the freshly unpacked release and run the browser gate from a fresh context:

```bash
uv run --with playwright python scripts/smoke_browser_startup.py http://127.0.0.1:8766/ --channel chrome
uv run --with playwright python scripts/smoke_browser_startup.py http://127.0.0.1:8766/ --channel chrome --touch
```

For a WebKit check, install its test browser with
`uv run --with playwright playwright install webkit`, then use `--engine webkit`
instead of `--channel chrome`. Repeat against the public URL after deployment.
The script checks the active canvas's presentation-ready state and absence of
the startup curtain, then observes three further seconds. Caught runtime errors
logged through `console.error` are failures, as are Chrome's blocked
AudioContext warning, page errors, critical network failures and the visible
recovery panel. A page timer observes the scene without granting automation
user activation; Chromium runs with strict autoplay enforcement. Touch
emulation does not establish physical iPhone GPU compatibility.

The mobile interaction gate must also run against a production package, with
fresh storage: development StrictMode can conceal first-visit state bugs.

```bash
uv run --with playwright python scripts/smoke_mobile_menu.py http://127.0.0.1:8766/
uv run --with playwright python scripts/smoke_mobile_menu.py http://127.0.0.1:8766/ --engine webkit
```

It exercises the bottom-left mode opener and all five modes across narrow,
portrait, landscape and tablet viewports. The streaming regressions additionally
exercise changing routes, bounded district residency, transfer acknowledgements,
pause/resume and restoring source envelopes before eviction. Browser travel
checks must stay within the delivered source area: the outer paper margin
intentionally contains no invented city geometry.

v1.0.19 fixes a deterministic crash in the entrance signs `GEMÄLDEGALERIE` and
`KUNSTBIBLIOTHEK · KUPFERSTICHKABINETT`. The former canvas-only validation skipped
unsupported letters during headless tests. Letter layout now validates before
checking for a DOM, and the full/mobile catalogue tests construct these real
signs. The browser gate also reproduces the failure on the earlier public build.

`package_static_site.py` writes both
`isometric-berlin-regierungsviertel-local.zip` and the independently deployable
`isometric-berlin-viewer-v<version>.tar.gz`. Do not recreate the tarball with
the macOS system `tar`: it can inject AppleDouble `._…` metadata files. The
Python packager normalizes timestamps and ownership, excludes source maps and
produces byte-identical output for identical builds.

The package has one viewer and a launch guide:

- `index.html` is the complete isometric viewer and requires local HTTP. Windows
  users run `OPEN-3D-WINDOWS.bat` or `start-windows.bat`; macOS users can run
  `OPEN-3D-MAC.command`; Linux users run `sh start-linux.sh`. Every platform can
  also run `python3 serve-local.py` in the extracted folder. Python 3 is required.
- `START-HERE.html` shows bilingual launch instructions when double-clicked from
  disk. Over HTTP it redirects to `index.html`, retaining the query and hash.
  It contains no separate renderer and never sends a file URL to the 3D app.

The generated server verifies the declared inventory, size and SHA-256 of every
world JSON file before opening the browser and rejects retired GLB/plate assets.
Release readiness performs the same check against the source tree, extracted
package and final ZIP, preserves the walking minimap and startup backdrop,
and rejects retired flat-map output, hidden, duplicate or stale 3D assets. The
same gate parses the static tarball, rejects links, special files and path
traversal, and verifies all scene payloads and retained support assets before
tagging.

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
offers Reload rather than leaving the 3D surface blank. Asset
retention remains required because it also preserves uninterrupted sessions
that have not yet loaded the new recovery runtime.

v0.72.9 separately bounds failures after the 3D runtime is already active.
Recovery is not gated by touch capability: every profile releases the failed
canvas and active world and performs exactly one clean remount for that world
family. A second failure presents an explicit Reload action; it does not start
another renderer or retain a second world. Separately, a mobile-like touch
session—primary or any coarse pointer, or `navigator.maxTouchPoints > 0`—keeps only one heavy world family
resident across family changes. Non-touch desktop's complete warm-scene
behavior remains available while switching among live 3D modes. Disposing the
viewer releases WebGL. These are source, production-profile and automated-browser release contracts, not a claim of
physical iOS-device validation.

If a future deployment separates heavy assets, the world JSON
can be placed on an object store such as Cloudflare R2. Attribution and
relative-path requirements from `AGENTS.md` and `NOTICE.md` remain mandatory.
