# v1.0.79: sparse outer Berlin outlines

The requested A100, AVUS, Schloßstraße in Steglitz, Ringbahn, Tempelhofer Feld,
Tempelhof airport terminal, Funkturm, ICC, Steglitzer Kreisel and Gesundbrunnen,
Südkreuz and Westkreuz stations are now thin cartographic outlines. The Kreisel
is an open skeleton and the Funkturm an open lattice. No new solid landmark
bodies, textures, district content or facade detail are introduced.

Exact OSM routes and footprints retain their identifiers and all source
vertices. The Ringbahn is a closed 36,962.3 m circuit. The AVUS ends at the
mapped Spanische Allee crossing. The finite supplement has its own approved
scope; the original 81.457 km² data footprint and all existing city detail
remain intact. [Source evidence and display estimates](outer-thin-outlines-v179-sources.md)
distinguish sourced dimensions from the illustrative vertical structure.
Route grades are a cartographic ground projection, not a surveyed road/rail
elevation model; construction-tagged A100 corridors do not assert current use.

One lazy-loaded line batch contains 14,772 vertices (177,264 position bytes).
One additional paper mesh extends the presentation floor outside the original
backing planes. Its mode-specific draw range prevents coplanar overlap while
covering the smaller Minecraft backdrop. A review identified this overlap before
publication; the final layout and regression assertion remove it.

Navigation and camera depth now cover the AVUS and all requested outlines.
The extension is cancelled when its viewer is retired and disposed with the
scene. Within a runtime it retains the same geometry through all six modes.
The existing touch-mode remount lifecycle remains unchanged.

## Validation

- Production TypeScript/Vite build and startup bundle budget.
- 46 focused Bun tests (59,513 assertions), including all vertices inside the navigation extent,
  unchanged geometry across modes and no overlapping backing triangles.
- Three reproducibility/source preservation/scope tests for the builder.
- Full Python suite: 849 passed; two existing CRS-fixture warnings.
- Repository-wide Ruff format/check, release readiness and local-package smoke.
- Chrome desktop: all six modes and return to Day, stable outline geometry,
  no JavaScript error or WebGL context loss; visual inspection of Funkturm,
  ICC, Kreisel, Tempelhof and Südkreuz.
- Six separate WebKit iPhone 13-profile starts: the correct outline counts and
  visible layer in every mode, no JavaScript error or WebGL context loss.
- WebKit sequence through all six modes and back to Day: stable geometry within
  each runtime, expected Minecraft touch remounts, no errors or context loss.
  An earlier sequence ended with a browser target closure; the fresh starts
  and complete repeated sequence passed without a production-code change.

Desktop Chrome and an emulated iPhone WebKit profile check rendering and mode
transitions; these checks do not certify physical iPhone memory limits.
