# v1.0.18 review and verification

Pipeline step 10. Make the downloaded package lead users reliably to the full
3D viewer instead of silently presenting the server-free 2D fallback as the
main experience.

## Corrected local start

`START-HERE.html` now opens a full-screen start choice that identifies the
HTML-only map as a fallback and points to clearly named Windows, macOS and
Linux 3D launchers. When served over HTTP it redirects directly to
`index.html`, the WebGL viewer. `OPEN-3D-MAC.command` ships with executable
permissions and documents macOS's right-click Open path. The Windows launcher
tries the Python launcher and ordinary Python explicitly and reports the
missing prerequisite instead of failing silently.

## Validation

- All 361 Python tests passed on the final v1.0.18 package (32.06 seconds).
- The unchanged 3D application build passed TypeScript and production bundling.
- Package generation, release readiness, local HTTP server smoke test, launcher
  presence, executable archive mode and manifest checks passed.
- The downloadable ZIP is 36,304,380 bytes and the viewer archive is 35,724,276
  bytes.

SHA-256: `4bfa301e680edd3cdf1e708419953e277263d2e636aabe667733cf7f067b7fdc`
for the ZIP and `37ddfe5dc1f4b49fdb7dae32781383f56ed72b8138bc08e549340add9549c9a1`
for the viewer archive.
