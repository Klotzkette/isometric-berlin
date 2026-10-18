# Elevated U-Bahn and music venues — v1.0.138 / Step 10

This finite refinement follows the requested northern U2 ramp and the connected
southern elevated railway. Existing city coverage, every prior source packet,
six modes, seven flight starts and the 93-place tour remain intact.

## Railway

The Eberswalder Straße supplement retains the mapped tunnel-to-viaduct course,
parallel tracks, middle platform and hall footprint. Structural references guide
the steel frames and glazed central roof light. The terrain datum and unmeasured
track-height interpolation are distinguished from source-plan coordinates.

The southern corridor connects Bülowstraße, the two separate Gleisdreieck levels
and Kottbusser Tor. Old ground-filled station proxies yield only to complete
required replacements. Thin platform/roof volumes and actual piers replace
their false street-blocking collision. The complete source footprint of the
Gleisdreieck bridge remains represented. Unrelated railways and station accesses
are preserved.

## Venues and Hermannplatz

All fifteen retained LoD2 parts of the Neue Welt complex and four Columbiahalle
parts supply their stepped roof/wall envelopes. Columbiahalle remains distinct
from the neighboring Columbia-Theater. Seven mapped Hermannplatz U-Bahn
entrances receive recognition, including six mapped stair alignments. Existing
Karstadt and square detail remains; no guessed underground opening is cut.

## Sources, delivery and preservation

- [Northern railway evidence](north-elevated-v238.md).
- [Southern railway evidence](south-elevated-v238.md).
- [Venues and entrance evidence](venues-hermann-v238.md).
- `geo_data/regierungsviertel/elevated-venues-v238-integration.json` records
  the independently resolved v1.0.137 manifest hash and exact new descriptors.
  All 2,108 existing descriptors and actual payload hashes remain checked.
- Eight mode/tile transactions match original encoded geometry and navigation
  before installing complete replacement surfaces and retiring only explicit
  old triangles/lines/obstacles. Changed evidence fails closed.
- Three exact core Gleisdreieck owners have required complete geometry in both
  mode families before city readiness. Their 195 precisely receipted native
  columns are retired without broad area deletion.

The new companions use the existing cancellable tile lifetime. The metadata-only
catalogue allowance rises to 2,144; the 24 MiB offscreen retention target,
12 MiB decoded packet ceiling and 4 MiB/two-packet prefetch remain unchanged.
These are not a global cap on all visible city buffers. Full drawn mobile detail
and independently orthogonal native construction are retained. No texture or
additional animation loop is introduced. Missing heights, pier spacing and
small facade fittings are explicit representation estimates, not surveyed facts.

## Validation

Production TypeScript/Vite and Ruff pass. Eighteen focused runtime tests pass
(16,493 assertions), covering real companion decoding, atomic owner transfer,
height-aware navigation, old house preparation and lazy source lifetime.
The independent native ownership replay passes 11,950 assertions. All 101
release-readiness and local-packager unit tests pass. Source/integration checks
verify every retained packet hash and the new bounded additions.

The full Python run completed 1,336 passed/four skipped, with two version tests
collected during the version update; both pass on a fresh targeted retry.
Thirty-five final source/preservation checks also pass after generation froze.
The full Bun suite is not wholly green: old geometry/count/source-text fixtures
fail. Counterfactual tests against unchanged v1.0.137 confirmed 23 of those
failures; the new house preparation expectation was corrected and retested.
No unrelated old fixture was rewritten to conceal these results.

Mobile WebKit (iPhone 13 emulation) completed all six modes and return to day
at maximum zoom over Gleisdreieck without page errors, context loss or a reset.
Peak tracked GPU buffer storage was 163,375,891 bytes in that run. Desktop
views confirmed the open crossing halls, Eberswalder ramp, Kottbusser Tor and
venue fronts; the longer desktop loop was interrupted by a host restart.
These checks do not constitute physical-device testing or a crash-free guarantee.
