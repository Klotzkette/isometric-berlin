# Step 10 — bounded ordinary street fronts, v263

The owner asks for remaining grey generic house clusters to look more like
actual buildings. This pass adds source-bound window, frame, reveal, mullion
and sill cues to previously untreated ordinary street fronts. The existing
LoD2/OSM building geometry and mapped named streets remain the location and
height evidence. Window rhythm, size and paint are explicitly illustrative
fittings, not a survey of individual openings or floor counts.

## Finite selection and actual result

The compiler selects exactly **32 existing primary descriptors**, four in each
of eight world-coordinate search sectors, using descriptor building counts and
spatial separation. Those sectors are sampling selectors, not administrative
boundaries or new coverage. It reads those packets and only neighbouring drawn
occupancy intersecting their 32 m margin. It does not scan citywide packet
contents, download source data, create descriptors or rewrite public assets.

Twenty-five samples have safe, previously untreated owners: **146 fronts,
1,031 drawn windows and 687 independently fitted native windows**. The other
seven samples retain their earlier content. In particular, the four
Wedding/Moabit samples contain no qualifying unclaimed complete street walls;
no claim is made that they gained new details.

Actual accepted street groups include:

- City West: Paulsborner, Düsseldorfer, Rintelner, Warmbrunner, Mansfelder,
  Charlottenbrunner and Zähringerstraße.
- Neukölln/Alt-Treptow context: Allerstraße, Harzer Straße, Heidelberger Straße,
  Karl-Kunger-Straße and Schmollerplatz.
- Southwest: Garystraße, Augustastraße, Dürerstraße, Moltkestraße,
  Hampsteadstraße, Kleinaustraße, Schmarjestraße and Schützallee.
- Spandau: Körnerstraße, Parkstraße, Triftstraße, Falkenhagener Straße
  and An der Kappe.
- Pankow/northern context: Florastraße, Görschstraße, Wilhelm-Kuhr-Straße,
  Wackenbergstraße, Blankenburger Straße, Arnold-Zweig-Straße and Binzstraße.
- Hohenschönhausen context: Konrad-Wolf-Straße, Freienwalder Straße,
  Käthestraße, Schöneicher Straße and several nearby residential streets.
- Southeast: Adlershof's Abtstraße, Altheider Straße and Radickestraße,
  plus Bohrauer Pfad, Luisenstraße and Geraldstraße in the sampled context.

The exact street IDs, owners, front endpoints, heights and native spans live
in `geo_data/regierungsviertel/grey-facades-v263-evidence.json.gz`. Its
**274 original input hashes** include the selected packets and bounded required
occupancy neighbours. The evidence is **27,842 bytes**; the runtime recipe
`src/app/src/data/greyFacadesV263.json` is **107,926 bytes**.

## Evidence and earlier-detail preservation

Every accepted front must have both full original quantized wall triangles;
navigation clipping boundaries alone cannot qualify. It must face a mapped
named street, have a clear street sightline, and keep every frame/sill approach
clear of neighbouring mapped buildings. Native wall spans must independently
exist, remain orthogonal and fit inside the established 1.6 m source-front
corridor. Holes, courts, massing, roofs, terrain and navigation are unchanged.

All v188/v209/v230/v262 facade owners, v233 mapped door owners, v233/v262
measured roof owners, current authored source identities and the retained
protected named/non-residential/material-tagged building polygons are excluded.
Every v262 facade tile and all four v262 roof tiles are excluded outright.
OSM-only owners additionally need a positively ordinary residential building
type in their source-height record. No entrance, shop, balcony, historical
ornament, cornice or roof shape is invented.

`prepareGreyFacadesV263` reuses the tested v262 bounded fitting transaction with
its own exact recipes and a distinct idempotence marker. It checks source
origin, complete navigation, all original city position/colour/index streams
and plan limits before adding anything. Changed or incomplete bindings fail
closed. Existing mesh and navigation objects survive by identity; no previous
part is copied or replaced. The wrapper appends only the one newly generated
`grey-facades-v263` part to the existing packet, retaining prior packet lifetime,
cooperative hashing/generation and disposal.

## Runtime bounds

Per tile limits stay at **eight owners, 96 drawn / 64 native windows**,
**16 mesh parts, 400,000 vertices and 2,400,000 indices** for the complete
transaction. Actual maxima are 95 drawn / 64 native windows. Drawn windows
use five shallow quads (frame, reveal, glass, mullion, sill); native windows
use three independent orthogonal quads (frame, glass, sill).

The finite addition stores **20,620 drawn / 8,244 native vertices** across its
25 separate packet pairs, with at most **1,900 drawn / 768 native additional
vertices in any one packet**. These join the existing interleaved destination
buffers. There is no additional draw call, root, texture, descriptor, animation,
resident budget or reduced mobile quality. Older detail limits are unchanged.

## Checks and review inputs

Seven focused Python checks across v262/v263 pass: original input hashes,
bounded selection, exact original walls, prior owner/tile separation, independent
native spans and unchanged old source inputs. Fifteen focused Bun checks across
v262/v263 facades and v254/v263 materials pass: all mode recipes, source identity
and immutability, exact triangle counts, native orthogonality, refusal of modified
or over-budget inputs, repeated preparation and earlier v262 preservation. Every
one of the 50 mode plans is also decoded through the full production preparation
chain, preserving its new fittings, navigation and transaction limits. A real
Heidelberger Straße packet verifies the coexistence of its retained v254 material
receipts and the exact new fitting positions/colours in both modes; all resulting
scene roots are disposed. Scoped Ruff format/lint passes.
The parent integration records final production checks and internal-browser
review separately; no external browser is launched by this subtask.

Source-derived front review cameras (`eye` / `target`):

- Rintelner Straße, `-11_6`:
  `[-5306.54,29.18,3067.11]` / `[-5309.93,13.18,3104.96]`.
- Heidelberger Straße, `ring182-9_6`:
  `[5091.97,28.07,3442.59]` / `[5066.92,12.07,3471.16]`.
- Freienwalder Straße, `east200-16_-6`:
  `[8300.24,29.02,-2568.77]` / `[8316.08,13.02,-2603.31]`.
- Abtstraße, `east200-22_18`:
  `[11447.09,27.25,9591.6]` / `[11427.08,11.25,9559.3]`.

Existing Geoportal Berlin LoD2 (dl-de/zero-2-0) and OpenStreetMap (ODbL-1.0)
notices apply. No photograph or external reference image is used or bundled.
