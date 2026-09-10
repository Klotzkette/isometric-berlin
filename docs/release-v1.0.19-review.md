# v1.0.19 startup repair and verification

Pipeline step 10. The deployed viewer crashed while constructing the Kulturforum
entrance signs. `GEMÄLDEGALERIE` requested a missing `Ä`; the following shared
library/cabinet sign also requested a missing middle dot. These exceptions
aborted scene construction in browsers with a canvas. The previous local-start
launcher change did not address this runtime defect.

## Repair

The drawn alphabet now contains German umlauts and the middle dot, and completes
the previously incomplete Latin capitals and digits. Umlaut dots remain inside
the existing cap-height envelope; NFC normalization accepts canonically
equivalent decomposed input. Building names retain their original spelling.

`createLetteringTexture` now validates layout before its DOM/canvas guard.
Previously headless tests returned early and never checked the production
labels. Regressions construct the real catalogue in full and mobile profiles
and verify all five Kulturforum signs. Unknown characters still fail validation.

The new browser smoke gate observes the real presentation-ready canvas,
startup-curtain removal, caught console exceptions and critical HTTP failures.
An exact WebKit advisory about an ignored viewport option is reported separately;
application errors are failures. Five Python regressions cover this gate.
The recovery copy no longer implies that every runtime defect is a stale tab.

## Evidence

- A fresh installed Chrome context reproduced the public v1.0.18 failure:
  two `Ä` console exceptions, no uncaught `pageerror`, and the visible recovery
  panel. The new gate correctly rejected it.
- The fixed packaged build passed cold Chrome desktop (13.01 s), Chrome touch
  emulation (11.16 s), and WebKit touch emulation (9.16 s). All had a visible
  ready canvas, no startup curtain, no runtime errors and no failed critical
  requests. Screenshots show the rendered scene.
- A fresh extraction of the final ZIP, served from a temporary directory,
  passed the same browser gate through `START-HERE.html` (10.84 s), including
  its redirect to the complete 3D viewer.
- TypeScript, production build, release readiness and the local HTTP/package
  smoke passed. Final build assets match the browser-tested package byte for
  byte. Ruff passes; all 366 Python tests pass (41.52 s).
- The complete frontend suite passes: 1,828 tests across 231 files, zero
  failures and 7,030,751 assertions (376.47 s).

Browser timings are local observations, not performance guarantees. Touch
emulation and desktop WebKit do not establish physical iPhone GPU compatibility.

## Artifacts

- ZIP: 36,304,957 bytes,
  SHA-256 `823a378ea78f0be15a99e56a684ba3bc8c3255f6596c906798e706d8a1ec503d`.
- Static viewer archive: 35,724,736 bytes,
  SHA-256 `e107d6c8df3e586bf50faca0c241dfff394d98ce1896a72dac10770cef18584c`.
