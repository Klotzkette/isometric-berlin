# v1.0.21 mobile menu and complete moving city detail

Pipeline step 10. On phones the mode selector could disappear or close while
scrolling. Away from the initial Reichstag area, the mobile renderer permanently
left 26,218 of 29,818 source parts as pale boxes: its exact-detail selection
stopped at the original fixed 3,600-part radius. Travel could never refine those
buildings, even though their source data had already downloaded.

## Repair

- Keep the labelled Modus control at bottom left in compact portrait and
  landscape layouts. Pin all five modes above independently scrolling actions;
  restrict swipe dismissal to the sheet header.
- Make first-visit attribution initialization side-effect free, consistently in
  development and production. Compact navigation collapses credits and leaves
  its info button accessible; expanded credits close the compact navigation.
- Preserve actual source footprints, courtyard holes, heights and roof-code
  shapes from the first city frame, with distinct facade/roof colours and
  directional shading. No footprint simplification or source-data reduction.
  Roof-code geometry remains a procedural interpretation, not a roof survey.
- Partition the entire mobile source inventory into spatial districts of at
  most 240 parts. Refine up to 15 districts / 3,600 additional parts around the
  current focus and up to 480 m ahead of travel; retain the initial 160 parts.
- Keep source records in a persistent Worker with only one transfer awaiting
  attachment. Changed travel replaces queued work, stale arrivals are released,
  and revisiting a district does not refetch the source.
- Restore a district's source envelope before disposing its distant exact
  geometry; hide coverage only after the replacement receives the active mode
  and attaches. Preserve complete inventory and existing recognition models.

The source-area boundary and its deliberately empty outer paper margin remain
unchanged. Geometry is not invented outside the approved city data. Minecraft
continues to use its existing complete voxel world; mobile moving refinement
applies to Day, Night, Snowstorm and Schwellenraum.

## Evidence

- Full frontend suite: 1,884 tests across 234 files, zero failures,
  7,032,831 assertions (341.91 s). Additional final focused checks cover the
  subsequent menu overlay repair and completed-view scheduling optimization.
- Real committed source coverage accounts for all 29,818 input parts. Its
  visible compact envelopes retain 644 courtyard openings and 5,388 pitched
  roof-code forms, using 25.906 MiB in geometry attributes and indices, below
  the 32 MiB regression ceiling.
- Production Chrome and WebKit touch checks navigated Siegessäule, Potsdamer
  Platz and Friedrichstraße, then travelled forward, sideways and back inside
  the source area. Roofs, source-shaped building bodies and facade lines stayed
  represented. Respectively 67 and 65 distinct detail districts were built.
  New focus selections settled in approximately 0.55–0.66 seconds on this host.
- Neither browser reported runtime, network, Worker or WebGL context-loss
  errors during those routes. WebKit emitted only the known viewport advisory.
- Worker and production-host regressions cover 6 km travel/return, latest-route
  priority behind a held acknowledgement, no duplicate transfer, bounded
  residency, stale messages, mode-aware attachment and suspension/resume.

Browser timings are local observations, not performance guarantees. Desktop
touch emulation and WebKit automation do not establish physical iPhone
compatibility. Continuous fine-detail refinement is bounded in memory; the
complete source envelopes remain visible while it catches up.

## Final package checks

- Final production Chrome and WebKit each passed the mobile menu gate at five
  portrait/landscape/tablet sizes. All five modes were hit-testable, at least
  44 px, correctly selected and reached a ready 3D canvas. First-visit expanded
  attribution no longer obstructed Siegessäule; reopening credits and reloading
  passed. Native Chrome touch scrolling kept the menu open.
- Final strict-autoplay cold startup passed on Chrome touch (7.87 s), packaged
  desktop Chrome (8.49 s) and packaged WebKit touch (7.22 s), without runtime,
  audio-policy or critical network errors. WebKit's viewport advisory remained.
- All 375 Python tests pass (39.62 s). Ruff format/check, TypeScript, production
  build, release readiness, and local HTTP/start-page package checks pass.
- Final focused streaming/coverage checks: 76 tests / 2,637 assertions. Final
  responsive/audio checks: 56 tests / 163 assertions. Independent lifecycle,
  geometry, mode and disposal reviews found no blockers.
- All 19 production entry/browser asset files match the packaged build byte
  for byte.

## Artifacts

- ZIP: 36,308,195 bytes, SHA-256
  `6a72d76a3fec84e25e10fa10c1abe53d9ae297645754fdee2f6ddb57e9b85c61`.
- Static viewer archive: 35,728,570 bytes, SHA-256
  `6642768e5d8d8ee3f9bea0bd7fe2207256b02ccf4e6815ece799eabf0c0ae08d`.
