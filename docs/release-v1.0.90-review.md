# v1.0.90 — Rail, northern neighbourhoods and Grunewald

## Delivered scope

- [Rail detail](rail-stations-v190.md): all 27 Ringbahn stations and the 14 Stadtbahn stops including both junctions
  are source-identified: 39 distinct stations. Continuous route vertices are
  retained, with source-bound platform/canopy recognition and the four major
  interchanges. Platform grades are documented display estimates where surveyed
  elevations are absent. Previously detailed central stations remain.
- [Northern city coverage](north-city-v190.md) adds 13.584 km², 84 cells and
  9,278 source building records through Ortsteil Pankow and Weißensee. It does
  not extend to the entire administrative Bezirk Pankow.
- [Northern sites](north-sites-v190.md): both Jewish cemeteries, source-mapped
  grounds/paths/entrances, Teutoburger Platzhaus, Kulturbrauerei and Kastanienallee.
  Unnamed grave-field markers are representative, not a survey of individual graves.
- [Park details](park-sites-v190.md) retain existing Humboldthain/Friedrichshain
  terrain, trees and paths, with mapped furniture, basin edges, stair/fence
  detail and the two surviving Humboldthain lookout platforms. No imaginary
  museum interior is added.
- [Grunewald](grunewald-v190.md): official DGM terrain is applied to surfaces, roads, trees and
  buildings together; lake surfaces remain level. The connected Havel/Wannsee
  system retains its original common water plane across the finite terrain border. The Brücke-Museum and the
  Grunewaldturm on Karlsberg receive source-bound models. The latter is the
  former Kaiser-Wilhelm-Turm, rather than a Bismarckturm.

## Preservation

All previous source inventories and the 93-place tour remain. Audited exact
coarse-owner substitutions reveal complete source roofs and open station halls.
Grunewald's altitude correction retains previous source plan vertices and
subdivides ground triangles only as needed to follow the official relief.
The 262 transformed primary packets have 71 lossless geometry companions; runtime serial loading and
resident CPU/GPU limits are unchanged. No mobile quality reduction, reduced
viewing distance or photographic texture payload is introduced.

## Validation

- Python: complete regression sweep (961 passed, four skipped, six initial failures), followed by final
  reruns of every changed or initially failing check. The 58 retention tests,
  76 release/readiness tests and 25 source/startup checks pass; Grunewald also
  has six focused source, water, terrain and navigation tests. Seven final
  retention and connected-water checks pass against the published packets.
- Bun: 2,965 cases in the complete sweep. Historical source-index/count fixtures
  and extracted-function bindings were updated without runtime changes; all 111
  affected cases pass in isolated reruns. Historical appearance hashes remain
  checked, and the current synchronous/cooperative Minecraft signatures agree.
- Production build, Ruff, package readiness and local-package launch checks pass.
- Fresh desktop Chrome and touch WebKit profiles both start the extracted package
  without console errors, failed critical requests or page exceptions. Chrome
  visual checks cover the four hubs and ten park/northern/Grunewald views.
- iPhone 13 WebKit profile: seven package visits across normal, night,
  Schwellenraum, snowstorm, flood and Minecraft, including native Grunewaldturm.
  Zero page errors and WebGL context-loss events; measured vertex/instance
  buffers peak at 270.59 MiB (driver/texture memory is not included).
- Mobile Chromium: five layouts, all six modes, flood-depth controls, credits
  and returning to the ordinary view pass.
- Shared-mode lifecycle checks release old geometry/materials and reproduce exact
  drawn/native buffers when returning to a mode.
- The combined manifest is 1,391,385 bytes, under the unchanged 2 MiB network
  limit through lossless compact serialization; no source entries were removed.

Browser profiles do not reproduce physical iPhone RAM limits. Platform heights,
small architectural subdivisions, woodland planting and unnamed grave-field
markers retain the documented distinction between measured data and interpretation.

## Download size

The complete extracted package is approximately 802.1 MiB. The finite archive-only
ceiling is 810 MiB for the explicitly added northern coverage and lossless terrain
subdivision. Per-packet and live rendering/memory budgets remain unchanged.
