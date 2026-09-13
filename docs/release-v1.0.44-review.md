# v1.0.44 — compact walking minimap

Step 10 reduces the mobile panel from 258 to 206 CSS pixels wide and its
map viewport from 146 to 112 pixels high. Desktop size and orientation buttons
remain unchanged. Source magnification decreases from 3.62 to 2.8, showing a
slightly wider context with smaller source pixels. Canvas sampling now uses
high-quality smoothing and a bounded device pixel ratio of 2 instead of 1.5.
This improves presentation of the existing raster; it does not invent new map
detail. The source image, world projection and scene geometry are unchanged.

The smaller mobile canvas measures 380 × 220 backing pixels in touch WebKit;
the unchanged desktop panel uses 480 × 288 in Chrome. Both walking views were
opened through P and visually inspected, with heading and direction buttons
present. The four minimap tests and all 459 Python tests pass, as do TypeScript,
Ruff, release readiness and the local package smoke. No larger decoded map
image is loaded. This is browser emulation, not physical iPhone testing.
