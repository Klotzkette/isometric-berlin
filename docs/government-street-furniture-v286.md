# Step 10 — v1.0.185 government-quarter street furniture

## Scope and publication status

This unpublished candidate refines twenty street lamps along
Heinrich-von-Gagern-Straße and its Paul-Löbe-Allee crossing, and one western
cycle-wayfinding mast. Seven owner photographs guide recognition. Existing
source geometry, roads, kerbs, paths, trees, coverage, all six presentations and
the 93-place tour remain retained. Production-build, archive, offline-package and internal-browser checks pass;
public deployment remains pending, with the published viewer still v1.0.184.

The [evidence ledger](../geo_data/regierungsviertel/government-street-furniture-v286-evidence.json)
records all seven photo identities, source-file hashes, lamp receipts, estimated
anchors and guidepost identification. Photographs and the bounded official
orthophoto are reference-only. No image pixels, photographic textures, media
files or runtime media requests are added. Stickers identify the photographed
guidepost but are not reproduced.

## Twenty lamps: source points and estimates

The inventory is exactly **ten retained municipal points plus ten estimated
positions**. These are different evidence classes:

| Anchors | IDs | Evidence |
| --- | --- | --- |
| Three Heinrich-von-Gagern-Straße points | `231349`, `231363`, `231319` | Complete existing municipal records; original XZ and ground Y remain receipts. |
| Seven Paul-Löbe-Allee crossing points | `244884`, `92930`, `92928`, `92927`, `92931`, `92925`, `92926` | Complete existing municipal records at the photographed crossing. |
| Five western and five eastern intervals | `photo-west-01` through `05`, `photo-east-01` through `05` | Photo- and verge-aligned spacing estimates, not individually surveyed pole bases. |

All twenty use the retained **6.8 m display height**. This value is not a
surveyed lamp height. The ten additional positions follow five paired 24.9 m
intervals beside retained kerb/footway courses; the orthophoto does not reliably
distinguish private pole bases from bollards. No foreign source owner near an
estimated position is removed. Inactive/provisional source records `231368` and
`231334` remain excluded.

The procedural recipe supplies a slender tapered post, collar/controller,
curved S-neck, tilted shallow dish, separate upper plate and dark underside.
Small sections, dish dimensions, material tones and head bearings are explicit
photo/context estimates, not a manufacturer identification or measured survey.
The adjacent `92928`/`92927` heads use distinct estimated bearings; a regression
checks their actual dish polygons for separation and over 0.5 m clearance.

The drawn batch preserves the ten original source ground datums. Estimated
grounds use the supplied terrain sampler or interpolation between retained
source points. Native construction uses the host's existing terrain sampling
and independent, connected, world-axis boxes rather than rotated smooth parts.
Full drawn static detail is identical on pointer and touch profiles.

## One western cycle guidepost

Photos 1 and 4 show the same distinctive mast. Their sticker sequence and
tree/hydrant/verge context identify western OSM node `10298343088`, at viewer
XZ `[-51.299, -51.259]`. The separate eastern node `5151420229` is retained as a
different source identity; the seven photographed labels are not copied there.

Four white fingerboards carry green lettering, borders, chevrons and bicycle
pictograms, with these seven photo-read destinations and distances:

| Board | Destination | Shown distance, km |
| --- | --- | --- |
| Hauptbahnhof / Moabit | Hauptbahnhof | `0,6` |
| Hauptbahnhof / Moabit | Moabit | `0,3` |
| Potsdamer Platz / Brandenburger Tor | Potsdamer Platz | `1,4` |
| Potsdamer Platz / Brandenburger Tor | Brandenburger Tor | `0,8` |
| Reichstag | Reichstag | `0,2` |
| Schöneberg / Siegessäule | Schöneberg | `3,3` |
| Schöneberg / Siegessäule | Siegessäule | `1,7` |

Wording, German diacritics and decimal commas are retained on both faces.
The mast's 4.26 m height, 1.75 by 0.39 m boards, small fittings and bearings are
display estimates. Bearings follow retained route axes; native panels snap to
cardinal axes and use independent run-length pixel lettering. Drawn lettering
uses procedural strokes. Both families keep text, distances, bicycle marks and
arrows outside the white faces without overlapping their allocated zones.

## Ownership and construction

The [ownership guard](../src/app/src/governmentStreetFurnitureV286Ownership.ts)
requires every one of the ten municipal owners exactly once, with precisely
the original six own data keys, position coordinates and values. Missing,
duplicated, changed, extra-key, sparse or accessor-based receipts reject the
whole family. Nearby foreign records cannot satisfy a missing receipt.

Inside the existing `ParkDetails` transaction, the
[guarded factory](../src/app/src/GovernmentStreetLampBatchV286.ts) constructs all
twenty complete drawn lamps before the ten exact generic poles/heads yield.
Construction or terrain failure keeps the generic owners. Tunnel filtering
precedes admission, and cooperative yields cannot publish a partial family or
both old and new poles. Existing light-cone buffers remain unchanged. Only the
new downward dish faces receive emission through the existing night-light
switch; no new Three.js light or animation loop is created.

The guidepost is baked into the existing `HbfNorthApproach` buffers in both
families. Its native lamps append there independently; drawn lamps belong only
to `ParkDetails`. Earlier public-realm instance matrices and colours remain
byte-identical prefixes: 10,981 drawn and 58,569 native instances.

## Constructor checks and limits

With Bun 1.3.14 and a flat `terrainAt = () => 5.2` fixture, the current complete
constructors reported:

| Constructor | Renderables | Instances | Typed-array bytes |
| --- | ---: | ---: | ---: |
| `HbfNorthApproach`, drawn | 2 | 12,431 | 995,108 |
| `HbfNorthApproach`, native | 1 | 61,659 | 4,686,732 |
| Drawn twenty-lamp replacement | 3 | 1,100 | 174,248 |

These byte totals count stored vertex/index/instance arrays, not total process
or GPU memory. Wayfinding contributes 1,450 drawn or 1,590 native instances to
the existing host buffers; the twenty native lamps contribute 1,500 members.
The drawn replacement contains 1,200 primitive callbacks across its three
renderables. No live residency, decode, transfer or prefetch budget is raised.
Startup JavaScript remains capped at 400 KiB, the worker at 16 MiB, the extracted
package at 893 MiB and retained Pages output at 1 GiB.

The focused preparation run passed **29 tests, 44,671 assertions, zero failures**
across `government-streetlamps-v286`, `government-wayfinding-v286`,
`government-street-furniture-v286-ownership`, `government-street-lamp-batch-v286`
and `government-furniture-integration-v286`. These cover exact ownership and
fallbacks, source datums, independent native geometry, adjacent-dish clearance,
full/touch equality, night switching, cooperative construction, lettering and
retained instance prefixes. All three source-file SHA256 values in the ledger
were independently rechecked without modifying those files.

These constructor/source checks do not establish production-package integrity,
full-city rendering or physical mobile-device compatibility. Those checks and
publication receipts remain pending.

## Final integrated validation

The frozen combined run passed 71 tests in ten files, with 146,955 assertions and no failures. The old ParkDetails inventory is still checked exactly when the guarded replacement is rejected; the authorised new inventory adds only 1,080 net instances. Independent review also checked all 190 lamp pairs without dish/native-box overlaps. Ruff lint/format and 100 package/readiness unit tests pass. Internal-browser full-city day and night views show the new lamps, retained trees and working light switch; the green guidepost is readable at its west-side anchor. Production and publication receipts follow after completion.

## Production candidate

The complete TypeScript/Vite production build passes. The validated package contains 4,754 files / 935,366,695 bytes (1,011,673 bytes below the unchanged 893 MiB cap), manifest SHA256 `55e2bea3a8ca13cbf4909110464547365d7b9ff42032c71b984cab4653e5e99e`. Archive contents/CRC, local HTTP smoke and the actual production main-app start pass; the UI reports v1.0.185 and has no errors from the production origin. Day, night on/off, native street and green-sign views were inspected in the internal browser, one complete city at a time. No physical-device compatibility claim is made.

The reviewed Pages candidate has 4,770 files / 971,354,921 bytes, retaining all 325 assets of the actual preceding v183/v184 closures. Only 15 proven v182-only assets / 54,660,314 bytes are removed.
