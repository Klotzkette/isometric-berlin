# v1.0.54 — Gedächtniskirche architectural review

Pipeline step 10. This narrowly scoped release revisits the church following
an independent, multi-view comparison with licensed photographs. The previous
v153 model was too rectangular and treated the raised nave opening as an
oversized ground-level passage. The [visual audit](gedaechtniskirche-visual-audit-v154.md)
records the evidence, discrepancies and per-file credits.

## Result

- An eight-sided, open bell storey replaces the rectangular upper box. Paired
  round arches alternate with broad scalloped openings, under separate gables.
- The surviving southwest side spire and the shorter northwest turret differ
  in height and cap. Four smaller copper-capped stair turrets articulate the
  clock stage. Gold clock rings, minute marks and inner tracery remain legible.
- The west side has a raised circular breach and Romanesque window gable. The
  east side has an elevated nave arch and broken masonry shoulders, rather
  than a second identical rose facade. Smaller ground entrances keep the
  memorial hall accessible; collision follows the represented walls.
- A tall hollow copper sheath has steep faceted sides, irregular stepped
  margins, standing seams and actual small dormer openings. Its highest point
  remains the published 71 m above the retained local ground datum.
- Stone variation, archivolts, cornices and the facades on the exact retained
  low apse boundary add close detail. The modern concrete-glass lattice has
  more subdued daytime colours and retains its blue night emission.
- Minecraft has a separate block-native reconstruction with the same principal
  silhouette, unequal side spires, elevated openings and accessible hall.

Fine dimensions, damage profiles, interior accessibility and stone patterns
are procedural display approximations, not a surveyed reconstruction of every
architectural component. The metric OSM anchors, complete source records and
112.9650867 m² of retained wing footprint remain. Photographs serve only as
external references; no photograph, crop or runtime texture is included.

## Preservation and resources

The bounds, 93-place catalogue, streets, other monuments and Bikini Berlin are
unchanged. Independent geometry hashes confirm that the three unrelated City
West batches (towers/Kranzler, Bahnhof Zoo and Urania) are byte-identical to
v153. Earlier preservation fixtures remain frozen; the v154 override records
only the requested City West correction. The native modern church ensemble
and source-wing batch tail retain their exact v153 matrices and colours.

| Model | Draw calls | Stored vertices | Instances | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Complete drawn City West | 12 | 113,516 | — | 2,434,560 |
| Native church ensemble | 1 | 24 | 15,632 | 1,188,872 |

Full and mobile drawn buffers are identical. Exact vertex welding avoids
repeated coincident vertices without changing any visible surface. Geometry
and materials are merged into existing fixed batches; there is no new texture,
per-frame scene generation or draw-call expansion. These figures describe
stored geometry buffers, not total browser memory.

## Validation

- Ruff formatting and lint passed; all 498 Python tests passed on the final
  version metadata.
- 49 focused City West and full/mobile preservation tests passed, including
  raycasts through the real openings and all earlier static-model hashes.
- 40 final church, pedestrian and Schwellenraum presentation regressions
  passed. The 35 full/mobile static preservation tests also passed.
- 78 isometric-world/construction-lifecycle tests and 50 earlier native-model
  preservation tests passed. The final synchronous/cooperative native-world
  fixture passed all four construction checks.
- TypeScript and the production Vite build passed; the existing large-chunk
  advisory remains. Release readiness and the extracted local-package smoke
  passed for v1.0.54.
- The final native world stores 317,218,360 bytes for full and 107,681,276
  bytes for mobile, with no changes to source/tree inventories.
- Production Chrome desktop and Playwright 1.62.0 / WebKit 2336 with the
  iPhone 13 profile passed all five modes, repeated camera movement, camera
  continuity and one active church representation, with no runtime or HTTP
  errors. Close western/eastern views, glass, night and Minecraft screenshots
  were reviewed.
- The ZIP is 35,734,446 bytes (SHA-256
  `909a2535e3be25cb2c2067c6d6206761892183d4e69fb171135f31d14ae5a8e3`);
  the static TAR.GZ is 35,615,499 bytes (SHA-256
  `8363b1ee8624d927e0f86e803cbcf52e0574801d2dd5a80466298f9d0a8d5081`).
- Pages staging retains all 1,382 previously hosted paths and verifies all 59
  current build files byte-for-byte. Existing hashed dependencies are retained
  for already-open tabs.

The WebKit 2359 context-loss finding from the [v153 review](release-v1.0.53-review.md)
remains a known compatibility limit, also reproduced on the preceding public
version. This architectural change does not claim to resolve it or establish
physical iPhone GPU compatibility.
