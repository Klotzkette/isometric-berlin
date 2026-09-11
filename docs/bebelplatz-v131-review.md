# Bebelplatz and mobile compatibility — v1.0.31 review

Pipeline step 10. Scope: the HU old main entrance, Alte Bibliothek, Hotel de Rome,
St Hedwig and the empty-library memorial, plus the requested browser compatibility
check. Canonical source datasets, the 93-place catalogue, other architecture,
movement speed and viewing distance remain intact.

## Source and geometry review

- Four bounded complete official LoD2 parents, thirteen parts, all original
  surfaces, dates and hashes retained alongside six previous OSM fallback prisms.
  The shared source supplement is under 120 KB. Current roofs and courts follow
  the complete official envelope; dome/elevation subdivisions are documented fits.
- Exact source-facing HU axes and gateway; the library's curved facade chain;
  hotel centre glazing in front of its projecting source wall; no hidden duplicates.
- Hedwig's 84-segment main dome retains smooth silhouette polygons while copper
  seams use a subdued micro-line register. Separate surface-only Minecraft model.
- True 1.20 m glass aperture over a 7.06 × 7.06 × 5.29 m room with fourteen empty
  shelf levels. Six coarse ground cells removed only over that room. Continuous
  stone paving follows the mapped Bebelplatz polygon without depth flicker.
- A review caught a metres/decimetres mismatch in new walking obstacles before
  release. Integration tests now assert actual wall positions, open HU courts,
  no stray obstacles at one-tenth coordinates, and visible roof-height agreement.
- Source-fusion comparison retains all 17,091 canonical features and the original
  source list. Both mirrored photo-credit manifests keep their previous prefix
  and now contain 270 records. No photo is bundled or fetched by these models.

## Browser checks and their limits

`scripts/smoke_mobile_compatibility.py` opens a fresh browser context, waits for
presentation readiness, uses the actual mobile menu and cycles Day → Night →
Snowstorm → Schwellenraum → Minecraft → Day. Every mode moves through the orange
joystick with browser mouse-pointer input inside the touch layout; mode choices
use taps. The camera starts over Bebelplatz again before each movement. The
probe rejects page/console errors, error overlays, lost WebGL contexts and zero
movement, and records renderer geometry/texture counts. It adds no production
inspection API.

- WebKit with iPhone SE emulation: six mode checks passed, no page errors, no
  console errors, no lost WebGL contexts. The only ignored advisory concerns
  WebKit's unsupported optional `interactive-widget` viewport key.
- Installed Google Chrome with Pixel 5 emulation: six mode checks passed, no
  page/console errors and no lost WebGL contexts. Returning from Minecraft
  rebuilds the drawn world successfully; mobile geometry/texture residency
  drops during the family switch instead of retaining duplicate renderers.
- Static review confirms the existing bounded byte render targets, fixed
  touch resolution, Safari preserved settled backbuffer, worker cancellation,
  instance-buffer/material/texture disposal and explicit old-context release.
  New detail groups follow these existing paths; no runtime compatibility
  workaround or loss of model quality was justified by the observed runs.

These are browser-engine tests on the host, not physical iPhone/Android GPU,
RAM, thermal or OS-version tests. They do not establish performance or immunity
to process termination on every phone. Affected device/iOS details were requested
for any issue that cannot be reproduced with the available engines.

## Validation

- Production TypeScript/Vite build passed; the existing large-chunk advisory
  remains. Complete downloadable ZIP and static archive are each about 11 MB.
- `uv run ruff format .` / `uv run ruff check .`: passed.
- `uv run pytest`: 422 passed.
- Full frontend run: 1,997 tests, with six obsolete geometry/count fixtures.
  Independent synchronous Minecraft hashes and source-column measurements
  confirmed the intended changes. The three affected regression files then
  passed 40 tests; the progressive-world file passed all 32 tests. This includes
  a new check for exactly 1,096 replaced source columns and the six ground cells.
- The two originally selected HU/library prisms account for 9,658 fewer follow-up
  vertices and 145,576 fewer bytes (the shared unit quad remains allocated).
  All six fallback identities are replaced across exact and distant display.
- Synchronous and cooperative Minecraft buffers agree: full 290,679,041 bytes;
  mobile 77,884,901 bytes. Compared with the previous model these add about
  0.49 MiB and 0.76 MiB respectively; no extra runtime textures are introduced.
- `check_release_readiness.py` and `smoke_local_package.py`: passed for v1.0.31.
- Final fresh WebKit touch startup: ready in 7.62 s on this host, no page,
  console or critical-request failures. Timing is not a phone benchmark.

Full-city, HU entrance, Hotel/Hedwig front and near-glass views were inspected
locally. The shelves are visible from an oblique standing-height view; a nearly
vertical view correctly looks primarily at the floor. No screenshots or
photographs are added to the shipped payload.
