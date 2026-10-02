# v1.0.70 — Flooded Berlin

Step 10 adds **Versunken / Flooded Berlin** as a sixth selectable mode, also
available through `?theme=flood`. This is an original fictional presentation of
the complete Day city. It introduces no new real-world source claim, geographic
expansion, copied artwork, photograph, texture or licence change.

## Rendering and preservation

The mean horizontal water level is world y=7.2 m, about three metres above the
usual central street datum. Higher ground may remain dry; actual local depth
varies. This is not a flood forecast. The exact existing core and outer scope
polygons clip the water to 81.457 km², with the core filling the outer polygon's
corresponding hole once.

One lazy water mesh adds broad ±0.24 m swells, directional currents and broken
foam crests. The texture-free shader uses derivative filtering for distant
ripples. Its opaque depth test lets existing walls and trees emerge through the
surface without transparent sorting or a reflection render target. No city
geometry or source data is changed, rebuilt or discarded. Day materials, ink,
landmark visibility, mobile detail and existing loading policies remain intact.

The mesh stores 39,117 vertices and 76,041 triangles in 925,650 buffer bytes,
using one draw call and no textures. Mobile and desktop share it. Re-entry
reuses the same mesh and buffers. Idle animation requests at most 24 frames/s;
active navigation retains its existing cadence. Hidden pages pause simulation,
resumption is bounded, and reduced-motion preference freezes the water.
Normal viewer disposal releases its geometry and material.

Mode changes preserve exact camera/walking position and direction. The water
is excluded from click-to-walk picking and does not replace the movement floor.
Underwater presentation uses the raised level, with existing tunnel and explicit
cutaway exceptions. Mobile controls have six modes in two readable rows, or one
row in the existing shallow-landscape layout.

## Validation

- Production TypeScript/Vite build passes.
- Six water tests cover complete area, every triangle centroid, extrema, swell
  bounds, finite geometry, byte limit, source/buffer preservation over 1,000
  updates, picking exclusion and disposal.
- 82 mode/UI/model tests and 26 navigation/tunnel tests pass, including Day
  appearance round trips and flood-specific underwater boundaries.
- Desktop Chrome: 18 successful cold-load, animated-view and actual-menu
  flight/walking checks; exact pose continuity, one reused water mesh, no
  runtime errors or context losses. Close and city-wide screenshots inspected.
- Mobile WebKit/iPhone 13 browser profile: the same 18 checks pass, with no
  errors, crashes or context loss. Measured route GPU buffer peaks were
  443,377,057 bytes in desktop Chrome and 249,826,528 in mobile WebKit. These
  are buffer measurements, not total RAM or a physical-device guarantee.
- Python: 711 checks passed in the main run; three checks overlapped the
  version/package write and passed when rerun against the completed release.
  The 16 new smoke-guard tests also pass: all 730 distinct tests verified.
- Ruff format/check, release readiness and local archive smoke pass. No source
  geometry/data file changed. The former release remains available.
- Chrome Pixel 5 profile: cold Day allocates no flood mesh. Day → Flood →
  Minecraft → Flood retains the exact pose across the expected mobile runtime
  remounts, with zero flood meshes in Minecraft and one on return. A fresh
  reduced-motion Flood page keeps its visible water clock at zero. No errors
  or context losses occurred.
