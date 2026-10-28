# Mitte and Berliner Ensemble: v281 / Step 10

This bounded correction distinguishes five existing source owners. It does not
replace complete buildings with proxy boxes, alter roofs or expand city coverage.

| Place | Measured owner | Correction |
|---|---|---|
| BE rehearsal building / courtyard canteen | `DEBE01YYK00007Hk` | Predominantly closed rust-red walls, sparse upper window row, thin walkway guard, grey service base and canteen entry |
| BE Neues Haus | `DEBE01YYK00001hf` | Gold screened long side, panel joints, dark foyer; the existing v218 front screen and lettering remain |
| Ganymed / Schiffbauerdamm 5 | `DEBE01YYK0000BQ7` | Plain historic chamfer with an arched gold mural niche and small abstract allegory cue, burgundy awnings, geometric GANYMED lettering and entrance |
| Former Hotel Splendid / Dorotheenstraße 37 | `DEBE01YYK0000D6X` | Neobaroque street front, central risalit, curved opening hoods, open iron balcony rails and abstract relief cues |
| Former Preußische Hypothekenbank / Dorotheenstraße 35 | `DEBE01YYK00002Gu` | Open three-axis stone framing, central triple divisions, colossal order, cornices and base joints; its earlier transparent shell and glazing remain |

## Sources and ownership diagnosis

The original full LoD2 records are copied byte-for-value into
`geo_data/regierungsviertel/mitte-ensemble-v281-source.json.gz`; every part,
source sheet, hole, vertical transform and roof remains in the original runtime
owner. Original inputs and generated outputs have SHA-256 receipts in
`mitte-ensemble-v281-evidence.json`. Sources are Geoportal Berlin LoD2 and retained
OSM attributes under the existing project attribution terms.

The red rehearsal building was still using the v169 repeated aperture grid.
Neues Haus had a corrected gold **front** from v218, but an untreated long side.
Ganymed's small chamfer carried generic windows where the historic mural niche
belongs. The neighbouring Splendid street front also used a uniform window grid.
The bank at No. 35 is an older retained transparent shell, so it receives only
open fittings: no replacement glass or opaque wall covering.

For the wider user screenshot, the bounded source-centroid audit box
`1160 < x < 1440`, `35 < z < 330` contains 39 measured owners: 25 v169 core and
14 retained older representations. All 39 have source roof sheets. The broad
uniformity is therefore not evidence of missing roof data everywhere. This
change concretely improves the two named Dorotheenstraße fronts; the other
blocks, including older Dussmann and modern office facades, are **not claimed as
newly reconstructed**. Full citywide architectural accuracy remains a limitation.

## Reference evidence

Reference pages and images were inspected on 2026-10-26. No photograph, video,
texture, font asset or current advertising image is distributed.

- [Berliner Ensemble: courtyard canteen](https://www.berliner-ensemble.de/magazin/kennen-sie-schon-die-be-kantine), operator article of 2024-07-03; the
  [courtyard view](https://www.berliner-ensemble.de/sites/default/files/2023-10/Drohne_Hof_02-Foto-Dronebrothers.jpg)
  is credited to **Dronebrothers / Berliner Ensemble**. It establishes the sparse
  red rehearsal wall, grey base and gold screened neighbouring building.
- [Berliner Ensemble: Neues Haus](https://www.berliner-ensemble.de/neues-haus), operator building and venue history.
- [Ganymed operator](https://www.ganymed-brasserie.de/unser-restaurant/), address
  and historic building identification. The architectural reference is
  [Jörg Zägel, Schiffbauerdamm 5, 2010-04-28](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Schiffbauerdamm_5,_Mietshaus.jpg),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), reference only.
  The niche uses a deliberately abstract original geometric cue, not the artwork
  or a photographic texture. Awnings are an approximate historic reference state.
- [Landesdenkmalamt Berlin: Hotel Splendid, 09055004](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055004)
  and its [2001 facade photo](https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09055004a.jpg).
- [Landesdenkmalamt Berlin: Preußische Hypothekenbank, 09055003](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055003)
  and its [2001 facade photo](https://denkmaldatenbank.berlin.de/media/uploads/Mit/02/09055003a.jpg).
  The heritage photographs establish architectural character, not today's tenant,
  exact paint hue or a measured facade survey.

All unmeasured bay widths, opening heights, colours, screen divisions, rail
sections, signs and reliefs are **display estimates**. The existing source
envelopes and roof planes are measured. This distinction is also embedded in
the source and evidence files.

## Runtime and exact transfers

`MitteEnsembleV281.ts` adds one bounded required mesh per mode. Both mobile and
desktop receive the same geometry. Drawn fittings are clipped to the original
measured wall polygons. Native fittings are generated independently on the
existing orthogonal native wall faces, clipped again to the measured ground and
eaves. All native cells remain untouched.

Only 864 exact old v169 **drawn facade-decoration** triangles retire (528 on the
red rehearsal house, 336 on Splendid). `mitteEnsembleV281Previous.json` stores
the immutable packet fingerprints and individual triangle indices. No source
shell, roof, neighbouring face, line, navigation entry or native triangle is
included in this transfer.

The old Friedrichstraße planner survives in full as
`planFriedrichstrasseArchitectureV281Control`. The regular planner applies
`refineEnsembleFrontagesV281` to its result. This removes only 145 drawn / 99
native old decorative blocks on two exact measured faces, restricted by source
ID, normal, edge, position and known generic role. The full source JSON is
guarded by FNV-1a `2434103950`; the required layer, transfer and planner all fail
closed on a changed source. All unrelated old objects survive unchanged.

The legacy v218 historical hash still tests that complete control plan. The new
v281 full-model test compares its complete current counterpart, while existing
functional tests continue to use the normal viewer planner.

## Integration

The Friedrichstraße planner hook and required/streamed integration are installed:

1. `addMitteEnsembleV281` into the required drawn/native groups.
2. `transferMitteEnsembleTrianglesV281` into the existing geometry ownership
   pipeline, enabled only after its required replacement is available.
3. The required group participates in the existing retained/disposal transaction,
   without increasing residency, draw-range, prefetch or quality limits.
4. This document's source attributions into the main NOTICE and release notes.

## Validation

- `uv run pytest -q tests/test_mitte_ensemble_v281.py`: source identity, clipped
  wall fittings, exact generic retirement, native orthogonality and empty nav.
- `bun test src/app/tests/mitte-ensemble-v281.test.ts`: complete control-model
  complement, source mutation guard, packet fingerprint mutations, unchanged
  unselected indices, cancellation, disposal and required-mesh construction.
- Existing Friedrichstraße and v218 functional checks run separately with a
  15-second per-test allowance for the already expensive native source check.
- `scripts/preview_mitte_ensemble_v281.py` generates diagnostic facade
  elevations in the task cache. It is not a live full-scene visual proof. The
  parent task performs integration/browser inspection only in the internal app
  browser; no external Safari is used.

Exact triangle and byte counts are generated in the evidence JSON. The bounded
new runtime data is 79,534 bytes gzip (3,065 drawn / 3,827 native triangles); no existing detail or package asset was
removed to make space.
