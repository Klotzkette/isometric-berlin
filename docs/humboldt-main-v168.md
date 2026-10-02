# Humboldt University main building — v1.0.68

This step-10 refinement is a **small additive ornament layer** for the HU
main building at **Unter den Linden 6**, OSM relation `6647`, monument
`09095954,T`. It concerns the former Prinz-Heinrich-Palais, distinct from the
Humboldt Forum at the Berliner Schloss.

The existing model is already substantial: `BebelplatzBuildingShells.ts`
retains all **95 boundary surfaces** of Berlin LoD2 parent/part
`DEBE01YYK0000Cm9`, its exact footprint and courtyard hole, basement source
base **−1.245 m**, and roof **25.018 m**. `BebelplatzFacades.ts` provides the
17-axis main front, six central columns, both court wings, the stepped
2 + 3 + 2 wing ends, window levels, roof figures, lettering, steps and open
street gateway. Its drawn and native forms are retained unchanged.

The new generator records SHA-256 hashes of both original modules and
`bebelplatzBuildingSource.json`; tests prove those files remain byte-for-byte
intact. The existing retired prism `ion-6647` remains owned by the previous
source model. **No new source owner, suppression rule, outer packet edit,
collision solid or roof support** is introduced.

The [Landesdenkmalamt inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095954,T)
supports the fluted Corinthian columns, rear pilasters, fine plaster courses,
principal-window garlands and keystone heads. The
[official HU directory](https://agnes.hu-berlin.de/lupo/rds?k_gebaeude.gebid=52&menu_open=n&menuid=&moduleCall=webInfo&publishConfFile=webInfoGeb&publishSubDir=gebaeude&state=verpublish&status=init&subitem=editfacilities&topitem=departments&vmfile=no)
confirms the current main-building identity. HU's
[architectural history project](https://www2.hu-berlin.de/architekturen-der-wissenschaft/)
documents the restored named portal; its existing lettering remains intact.

Christian Wolf's [2015 free front photograph](https://commons.wikimedia.org/wiki/File:Frontansicht_des_Hauptgeb%C3%A4udes_der_Humboldt-Universit%C3%A4t_in_Berlin.jpg),
**CC BY-SA 3.0 Germany**, was inspected at 1,280 pixels. It supports the broad
material, window, balustrade and column reading. No photograph, crop, pixel
colour sample, font or traced relief is bundled. This previously credited
reference is supplied again in `/tmp/hu-v168-attribution.json` so the central
release can retain/deduplicate its per-file credit.

`HumboldtMainV168Details.ts` adds:

- Shallow tapered flute shadows to the six existing shafts, two bounded
  acanthus/volute tiers at their capitals, and aligned rear pilasters.
- Fine upper plaster courses, dentils, fanlight bars and sill brackets on
  **eleven exact source wall planes**, including projected wing ends.
- Central keystone faces and procedural botanical swags; existing wing
  keystone heads stay intact.
- Shallow turned baluster bellies around existing spindles, small robe folds
  on existing roof figures, and two panelled main-entry leaves with handles.

All local relief dimensions, flute counts, leaf arrangements and pane
subdivisions are display estimates. This is not a facade survey or a new
sculpture reconstruction. No old column, roof figure, gate pier or complete
building shell is duplicated.

Runtime APIs are `createHumboldtMainV168Details()` and
`createMinecraftHumboldtMainV168Details()`. Each accepts an optional
`{mobileLike?: boolean}`; both drawn device profiles are identical.
`humboldtMainV168Profile.ts` exposes identity and preservation metadata.
Its small navigation JSON explicitly records empty new-solid and new-roof
lists: existing Bebelplatz source and gateway navigation remains authoritative.

Drawn rendering uses **three batches / 345,200 bytes**, comprising 2,264 boxes,
883 shared rods and 1,355 relief instances. Native rendering is a separate
**single orthogonal batch / 2,481 boxes / 189,204 bytes**, emphasizing capitals,
arch relief, doors and balustrades. Fine plaster grooves remain a drawn surface
cue; no smooth overlay survives in Minecraft. There are no runtime images,
new lights, animation callbacks, per-frame constructors or hidden solid fill.

Four Python tests verify exact source-plane alignment, unchanged prior files,
source/court identity, finite bounded geometry and deterministic generation.
Fourteen focused Bun tests pass (30,028 assertions), including the two existing
Bebelplatz model suites: current roof/court/gateway behavior, facade ray tests,
old budgets, new full-touch parity and orthogonal native matrices remain valid.

```sh
uv run python scripts/build_humboldt_main_v168.py
uv run pytest -q tests/test_humboldt_main_v168.py
cd src/app
bun test tests/humboldt-main-v168.test.ts tests/bebelplatz-facades.test.ts tests/bebelplatz-building-shells.test.ts
```
