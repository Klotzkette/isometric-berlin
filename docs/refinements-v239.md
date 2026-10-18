# Northern Mitte and Schlossplatz — v1.0.139 / Step 10

The requested streets are interpreted as Choriner Straße, Zehdenicker Straße
and Oranienburger Straße by Monbijoupark. This revision stays inside the existing
city coverage and preserves the 93-stop tour, seven flight starts and six modes.
The preceding v238 elevated U-Bahn/venues work is also included in this release.

- [Northern Mitte street fronts](north-mitte-fronts-v239.md): 5,647 verified
  existing panes on 265 source owners along Torstraße, Linienstraße, Koppenplatz,
  Gipsdreieck, Fehrbelliner/Veteranenstraße and the Choriner/Zehdenicker junction,
  plus twenty previously authored Choriner Höfe panes.
- [Google, Delivery Hero and Leo-Baeck-Haus](named-fronts-v239.md): 764 existing
  openings receive differentiated restrained frames and upper glass reflections.
  The Google office is the Gropius ensemble, not the Haupttelegraphenamt.
- [Staatsratsgebäude and Neuer Marstall](schlossplatz-v239.md): complete measured
  owners, Liebknecht portal, source-height correction and HfM portico.
- [Nikolaiviertel](nikolaiviertel-v239.md): source-bound recognition including
  the church's twin copper spires and named historic facades.
- [Altes Stadthaus](stadthaus-v239.md): closed two-drum tower, pediment, dome,
  western mansard and window surrounds, preserving all five open courts.

Existing aperture anchors are previous procedural estimates, not surveyed
window positions. Source-bound refinement makes the model more legible but does
not establish photographic accuracy for every facade. Fine dimensions and
material hues remain explicitly documented display estimates.

## Preservation and loading

The 2,121 predecessor packet descriptors and their actual bytes remain intact.
Fourteen additive companion descriptors reuse existing bounded serial delivery;
coverage rings and old metadata are unchanged. New tile data remains under the
existing 12 MiB decoded-packet limit, 24 MiB resident allowance and 4 MiB prefetch
budget. No mobile geometry, resolution or detail reduction was introduced.

Schlossplatz and the corrected Stadthaus tower load in the required city
transaction. Only exactly recorded obsolete geometry yields to complete new
models; source packets remain immutable. Drawn and native data decode separately
and use weak constructor caches. Each required source mesh is built independently
to retain compact indices; cancellation remains owned by the normal generator.
The Stadthaus companion file is packaged as source proof but is not also streamed.

## Validation

- 34 focused Python source/integration tests pass; 23 selected runtime and
  ownership tests pass, including standalone fail-open behavior, exact legacy
  retirement, all-mode native geometry and cancellation disposal.
- Production TypeScript/build and repository Ruff checks pass. Release readiness
  and the complete downloadable local-package smoke test pass.
- Desktop day close views cover all requested street sectors and named fronts;
  thirteen facade companions and the required Stadthaus load without browser,
  HTTP or WebGL errors. Existing cartographic boundary/Ringbahn lines remain
  visible over some nearby facades by their earlier intentional depth policy;
  none of the new packets introduce line geometry.
- Mobile WebKit with iPhone 13 emulation completes 21 views across day, night,
  snowstorm, flood, Schwellenraum, native and back to day: zero JavaScript errors,
  context losses or hidden resets. Views include both revised areas and wide
  zoom. Measured buffer-allocation peak: 331,536,669 bytes; this includes existing
  complete city geometry and is not a whole-process memory measurement.
- Desktop Chrome completes the same 21-view/all-mode sweep with zero errors,
  context losses or hidden resets. Measured buffer-allocation peak: 702,094,152
  bytes in the independent native mode; returning to drawn releases that world.
- Full Python suite: 1,520 passed and 4 skipped; its only failing assertion was
  the required `Local v1.0.139` README status wording. The wording was restored
  and the complete release-readiness test passed on rerun against the final artifacts.

These finite browser checks are emulation on the test computer, not a guarantee
for every physical phone or an indefinite no-crash claim. No live residency
allowance was raised. The complete extracted release is 915,771,831 bytes
(873.35 MiB); the finite 875 MiB archive allowance affects download packaging only.
