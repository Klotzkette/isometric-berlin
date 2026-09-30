# v1.0.51 — Potsdamer Platz, Leipziger Platz and Wilhelmstraße

Pipeline step 10. The scope is the owner's requested architectural refinement;
the central-Berlin bounds, 93-place tour, streets, park details and existing
landmarks remain unchanged.

## Delivered geometry

- Mall of Berlin: complete original wall/roof sheets, measured upper setbacks,
  courtyard edges and the surviving Voßpalais at Voßstraße 33. The historic
  four-axis red-sandstone street face remains distinct from its newer pale
  upper/rear volume. The independent LoD2 part enclosing the Piazza is rendered
  as its original glass roof planes with steel ribs and an open underside.
- Leipziger Platz: the complete plaza-facing source families, including the
  modern Mosse-Palais, the western gateway, Quartier 1–3, the southern strip,
  Classicon and eastern entrances, with individual source-bounded window,
  stone, bronze and glazed-frontage detail.
- Potsdamer Platz: old/new Bundesumweltministerium and its covered atrium,
  Forum tower, Haus Huth and Grand Hyatt receive complete source envelopes
  and specific frontage details. Mandala, Moneo and the retained Piano street
  wings receive facade-only overlays on 69 verified wall planes across 68
  retained parts. Existing northern towers and Sony structures retain their
  previous detailed models.
- Czech Embassy: the measured fifteen-part envelope remains beneath folded
  granite aprons, bronze ribbon glazing and dark vertical cores. HIT Ullrich
  receives bounded storefront detail at its existing address anchor.
- Alter Dessauer: bronze figure with tricorne, uniform, baton, sword and boots,
  relief-bearing granite pedestal and a chain enclosure at the retained OSM
  node. Statue anatomy and intermediate dimensions are photo-proportioned.

## Evidence and uncertainty

Berlin LoD2 provides metric geometry; OSM provides identity and location.
Primary architects and institutions identify materials and architectural
hierarchy. Licensed Commons images are external visual references only; no
new photograph, texture or runtime network dependency is bundled.

Window spacing, member thickness, ornamental relief and sculpture anatomy are
procedural recognition estimates, not a surveyed facade or statue scan.
Complete old prisms and original wall/roof sheets remain in the source
supplements. Per-parent rigid display-height translations register those
sheets to the existing viewer street datum without flattening roof geometry.

- [Mall and Voßpalais source contract](leipziger-platz-v151.md)
- [Leipziger Platz perimeter](leipziger-perimeter-v151.md)
- [Potsdamer Platz and ministry](potsdamer-ministry-v151.md)
- [Czech Embassy, HIT Ullrich and Dessauer](wilhelm-dessauer-v151.md)

## Preservation and lifecycle

Only matching source IDs suppress prior drawn prisms. Their complete models
are awaited and staged in the existing cancellable world transaction before
publication. The covered Mall passage and roof-only canopy retain open
pedestrian space beneath their actual roofs. Native Minecraft uses separate
bounded block batches; boundary cells shared with neighboring buildings are
retained rather than removed by a broad footprint predicate.

All four drawn modes share full static detail on mobile and desktop. The
frozen v141/v146/v147/v148 preservation fixtures remain unchanged; a v151
Wilhelm-only override records the deliberately refined embassy/shop model.
Existing source mesh payloads, terrain, roads, park data and the tour are not
regenerated or simplified.

## Validation

- `uv run ruff format .` and `uv run ruff check .`: clean.
- `uv run pytest`: 498 passed.
- TypeScript and the production Vite build passed. Vite retains its advisory
  about existing chunks larger than 500 kB.
- The complete Bun run covered 2,378 tests: 2,371 passed initially; seven
  assertions still used pre-refinement geometry counts/ownership fixtures.
  Independently measured final synchronous Minecraft fixtures, exact source
  ownership and dedicated model checks replaced those obsolete expectations.
  Final reruns passed 161 tests across 11 affected model/lifecycle/preservation
  files plus all 72 tests in the city-world and Abgeordnetenhaus navigation
  files. No failing test remains unresolved.
- Exact replacement integration covers 141 original source parts: 96 from
  Leipziger Platz/Mall and 45 from Potsdamer Platz/the ministry. The covered
  passage stays open and distant fallback cannot reinstate opaque old caps.
- Final Chrome desktop and WebKit with the iPhone 13 profile passed loading,
  all five modes, mode-switch camera continuity and repeated camera moves,
  without JavaScript or HTTP errors. WebKit emits its existing harmless
  unsupported `interactive-widget` viewport-key warning. Screenshots reviewed
  Mall, Voßpalais, Leipziger facades, ministry, Potsdamer Platz and Wilhelmstraße,
  including night and native Minecraft views. This emulation is not a physical
  low-memory iPhone test.
- `check_release_readiness.py` and `smoke_local_package.py`: passed for v1.0.51.
  ZIP: 35,672,712 bytes; static TAR.GZ: 35,556,388 bytes. Release checksums cover
  both archives.
- Independent final preservation audit found no unintended source/road loss.
  All 13 new Commons references are credited in both manifests; earlier
  references remain. All 1,328 previous Pages paths are retained alongside the
  new build so existing open tabs keep their hashed module dependencies.

The final native-world stored buffers are 314,525,005 bytes for full and
104,802,025 bytes for mobile, increases of approximately 3.03 MB and 3.01 MB
over the retained v149 synchronous baseline. These are geometry-buffer counts,
not measurements of total browser or device memory.
