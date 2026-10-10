# Kiez, memorial sites and direct mode links — v1.0.109 / Step 10 v209

This release follows the owner's named requests without rebuilding unrelated
city geometry or lowering mobile quality. The existing 93-stop tour, source
packets and resident CPU/GPU budgets remain intact.

## Named sites and neighbourhoods

- **JVA Tegel:** its actual mapped perimeter, gates and complete building families.
  This is distinct from the existing JVA Moabit and former Lehrter prison memorial.
- **Former Stasi headquarters:** the Lichtenberg/Normannenstraße campus, including
  Haus 1, is distinct from the former prison at **Hohenschönhausen**. Both use
  complete source-bound models and reference-guided public exterior details.
- **Volksbühne:** all earlier measured body sheets, facade and Räuberrad remain.
  Official 2025 bDOM samples establish the higher stage tower and auditorium
  roof levels; source-clipped upper masses correct the previously flat silhouette.
  Collision follows the new upper masses and roof slopes without closing the courts.
- **Orankesee:** exact retained shoreline plus bounded lido sand, mapped paths,
  benches, bins, boards and slides. The old artificial background had covered part
  of the lake: an exact 82-point contour cut now reveals its existing water in
  both mode families. Every background fragment outside that contour and all six
  existing water packets remain intact; no duplicate lake surface is introduced.
- **Moabit and northern inner-city neighbourhoods:** 575 eligible source frontages
  gain bounded sills, reveals and crossbars in fourteen streamed companion packets.
  Weinbergsweg and already-detailed source fronts gain subtle facade-ink definition.
  Protected individual models and documented source materials remain intact.
- **Helmholtzplatz:** the separate Kiezkind cafe and community Platzhaus retain
  their exact footprints. The latter's incorrect tall gable is replaced with a
  documented low flat form; its drawn/native roof and collision height agree.

Facade openings, colours and small members are reference-guided estimates, not
an assertion that every opening was measured on site. The Platzhaus 3.4 m height
is a display estimate supported by one-storey source tags and the cited image.
No present-day paint survey is claimed from older appearance references.

Sources, precise scope, budgets and limitations:
[kiez facades](kiez-facades-v209.md),
[Volksbühne and Orankesee](volksbuehne-orankesee-v209.md),
[prison and memorial sites](prisons-memorials-v209.md).

## Links and startup

All six explicit query links enter their mode immediately:
`?theme=day`, `?theme=night`, `?theme=snowstorm`, `?theme=schwellenraum`,
`?theme=flood`, `?theme=minecraft`. Plain or invalid-theme entry preserves the
startup chooser. Selected-mode links can be opened/copied from that chooser;
clipboard denial exposes a selectable URL. Links retain local/static-host paths.
Night starts with lights on, Flooded Berlin at 3 m, Snowstorm with precipitation.
No audio context is created merely by visiting a direct link.

After entry, existing mode switching and camera/walking continuity remain.
The running viewer's view-sharing action includes its current mode rather than
reusing the initial incoming link's mode.

## Independent preservation and loading

The immutable v1.0.108 commit `2a0b48fb609821951f54ef714621412a4203b7d3`
anchors old outline signatures. The v209 audit first reproduces that complete
baseline, then verifies every earlier byte after excluding only the three new
optional families. Historical v207/v208 preservation fixtures remain unchanged.

Exact per-owner receipts guard the affected Volksbühne, Helmholtzplatz and Stasi
packet triangles with full encoded-part fingerprints. Only those audited indices
are degenerated; original attribute arrays and all unrelated indices remain.
Corresponding old ink is retired only with its exact fingerprint. The Stasi
navigation handoff likewise requires every original field/ring/height to match;
old protruding collision roofs cannot survive the complete replacement. A changed
packet fails closed and retains its original drawing. The Helmholtz collision
correction checks the complete original owner/ring/height record.

Replacement bodies belong to required provisional world construction. They attach
before each cooperative yield and before city publication, so cancellation or
import failure cannot expose holes or leak detached replacement geometry.
Separate optional fittings never own required replacement shells. Weak JSON data
fields allow expanded construction arrays to be reclaimed without reducing detail.

## Verification

- TypeScript and production build pass; Ruff lint and formatting pass (503 files).
- The complete frontend run exercised 3,242 tests. Four failures were corrected:
  three exposed missing cancellation checks around the new lazy import, and one
  historical source assertion needed the new explicit argument. The affected
  suites passed on rerun (19 tests/95 assertions); the JSON ownership extension
  and native preload guards passed separately (17 tests/399 assertions).
- Earlier outline models remain byte-identical against the immutable v1.0.108
  baseline; all four preservation suites pass (9 tests/34 assertions).
- Exact lake-margin cut tests use the actual old constructors and water packets:
  rays hit the same existing lake after the cut, unchanged exterior points keep
  their heights, and modified receipts abort before mutation. Navigation tests
  cover source handoff, roof profiles, free courts and collision radius.
- Direct links: Chrome and automated WebKit/iPhone 13 profile pass all six cold
  starts, clipboard-denied fallback, later mode switching and no automatic audio.
- Site inspection: Chrome and WebKit each passed 26 views across all six modes
  without JavaScript errors or WebGL context loss. Final margin correction and
  the corrected Kastanienallee view were rechecked in both rendering families.
- Complete local package: **871,854,981 bytes (831.47 MiB)**. The finite archive
  ceiling is 833 MiB; all runtime resident budgets remain unchanged. Package
  readiness and local HTTP launcher smoke both pass.

The complete Python data/preservation suite passes: **1,244 passed, 4 skipped**,
with two existing projection-metadata warnings (968.62 seconds).
Automated WebKit phone profiles do not establish physical iPhone memory/GPU
compatibility, and a bounded browser pass cannot guarantee crash-free operation
on every device.
