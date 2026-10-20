# One stationary BVG bus — v1.0.153

Step 10 adds one illustrative yellow 12 × 2.55 × 3.2 m city bus near the
Invalidenstraße entrance to Hauptbahnhof. Doors, mirrors, dark window band,
headlights, tail lights, roof equipment, four upright faceted tyres and small
procedural BVG lettering make it recognizable at street height. Dimensions and
small fittings are display estimates, not a surveyed manufacturer model or
timetable claim. The two earlier staffage buses are retained.

## Placement

- Retained OSM stop node **817754406**, S+U Hauptbahnhof (Invalidenstraße),
  `ref:BVG=103893`, `local_ref=6`, `public_transport=stop_position`, `bus=yes`.
- Platform way **382412794**; road ways **461526150 / 291695261**.
- World centre **(-149.24884382, -812.36876043)**, yaw **0.44599652523**;
  forward is northeast, with doors on the right toward the platform.
- Centre is 6.5 m behind the mapped stop and 3.25 m right of its centreline.
  The 12 × 2.55 m footprint is entirely within the delivered asphalt polygon,
  with no overlap with delivered paving/metal surfaces. Road datum uses the
  existing terrain sampler plus the retained 0.14 m road lift.
- Evidence: retained `berlin-260929.osm.pbf`, `osm.gpkg`, delivered
  `surface-polygons.json` and `ground-context.json`; OpenStreetMap contributors
  (ODbL-1.0) and Geoportal Berlin terrain retain their existing notices.

The bus joins the existing HbfNorthApproach instance batch. It adds no mesh,
material, texture, animation, streaming descriptor or live residency allowance.
Mobile receives the full drawn model; the native counterpart consists entirely
of orthogonal boxes along the same plan. No photos or logos are downloaded.

## Validation

Final build, browser and publication results are recorded below.

- Production TypeScript/Vite build passed.
- Existing Hbf geometry suites: **12 Bun tests / 7,128 assertions** passed.
- Hbf source, atrium and packaging suites: **33 Python tests** passed.
- Repository-wide Ruff formatting/lint and whitespace checks passed.
- Real built-scene checks: Chrome Day, Chrome Minecraft and iPhone 13 WebKit
  Day passed, with no page errors, WebGL errors or context loss. Visual inspection
  confirms the yellow body, side doors and wheels stand in the road lane.
- Exact additional instances: **138 drawn / 1,074 native**, contributing
  **10,488 / 81,624 bytes** of matrix/colour attributes to the existing batch.

Release verification passes for the full **931,243,308-byte** package
(888.103 MiB), within the unchanged 889 MiB archive bound. Three additional
release-readiness/budget checks pass. Pages retains both previous live asset
sets; the prospective site is **1,002,937,880 bytes**, below 1 GiB.

Published on 20 October 2026 as **v1.0.153**. Source commit `46829478`;
Pages commit `5e712a80ee2fcd0bfff887171bfb18dea1e5e4e8`. GitHub Pages build
succeeded. Public index, package manifest and the Hbf bus-containing bundle
match the verified package byte-for-byte. Chrome Day, Chrome Minecraft and
iPhone 13 WebKit Day checks pass on the actual public site without page or
WebGL errors/context loss. All three release assets have matching sizes and
server SHA-256 digests. No long-duration physical-phone soak test was performed.

[Live viewer](https://klotzkette.github.io/isometric-berlin/) ·
[Release/downloads](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.153)
