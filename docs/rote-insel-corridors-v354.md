# Rote Insel, Yorckstraße and Hohenzollerndamm

V354 refines **15 photographed street elevations on 14 retained building families**. The changes replace individually matched V188 window grids where present and add photograph-guided plaster, window rhythms, frames, cornices, projecting bays and open balconies on the actual existing walls. The complete original building bodies, roofs, courtyards, navigation, wires and unrelated architectural fittings remain.

This is a finite architectural correction. It does **not** claim that every house along either street or throughout Rote Insel has been photographed or rebuilt. The address inventory records the broader search and its gaps explicitly. Photographs range from 2005 to 2025; their publication on a current official page does not make them a current survey. Dimensions of facade relief, individual apertures and colours are display estimates. Roofs remain the measured retained source geometry.

## Corrected fronts and references

| Front | Recognition changed | Primary photographic evidence |
| --- | --- | --- |
| Leberstraße 65, Marlene Dietrich birthplace | Five floors/eight axes, pale plaster, projecting central bays, three pairs of open side balconies and two differently placed memorial plaques | [LezFraniak, own photograph, 28 July 2012, CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Marlene_Dietrich_Birth_House_Panorama_2012-07-28_small.tiff); [public memorial register](https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/marlene-dietrich/1791); [official Inseltour](https://www.nachhaltige-erneuerung.berlin.de/fileadmin/user_upload/Dokumentation/Projektdokumentation/Tempelhof-Schoeneberg/FG_Suedkreuz/Inseltour/PDF/inseltour-broschuere.pdf) |
| Leberstraße 13 | Four floors/seven axes, rusticated base and individual window hoods | [LDA 09066611, photograph 2005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066611) |
| Leberstraße 18 | Four floors/six axes, central entrance rhythm, cornices and framed windows | [LDA 09066612, photograph 2005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066612) |
| Leberstraße 32 | Five floors/eight axes, paired side balconies and upper window hoods | [LDA 09066613, photograph 2005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066613) |
| Yorckstraße 47 and 48 | Separate six-floor fronts, three-floor projecting central bays, different green-brown/red-brown frames, articulated base and cornice | [LDA 09066750, LDA-Fotoarchiv/Bittner 2014](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066750) |
| Yorckstraße 76 | Six-floor, seven-axis ochre frontage with darker red-brown frames and open side balconies | [Property owner GSE gGmbH, photograph published 2025](https://gseggmbh.de/hauser/yorckstrasse-76/) |
| Riehmers Hofgarten, Yorckstraße 83 and 84–86 | Individually bounded five-floor fronts with attic rhythm, repeated projected bay groups and denser cornice relief | [LDA 09031026, LDA-Archiv/Bittner 2012](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031026) |
| Scharoun house, Hohenzollerndamm 35–36 | Two independently supported elevations: white six-floor body, broad glazing, interleaved small service windows and balconies | [LDA 09011450, LDA-DK/Beitl 2009](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011450) |
| Hohenzollerndamm 44 | Four-floor office frontage, stone-coloured base and central stair glazing | [LDA 09011451, LDA-DK/Beitl 2011](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011451) |
| Hohenzollerndamm 45 | Four-floor office frontage with separate floor/window rhythm | [LDA 09011452, LDA-DK/Beitl 2011](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011452) |
| Hohenzollerndamm 181 and 182 | Separate five-floor fronts with window surrounds and projecting architectural rhythm | [LDA 09011556, LDA-DK/Beitl 2009](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011556) |

The two Dietrich plaques are recognition geometry at the documented sides of the entrance. The bronze plaque uses the register's 50 × 70 cm dimensions; portrait and inscription are not reproduced. The elaborate reliefs elsewhere are architectural interpretations, not scanned statues or an asserted reproduction of every ornamental figure. No reference photograph is shipped as a runtime image or texture.

## Broader street audit and unresolved coverage

The compact `rote-insel-corridors-v354-addresses.json.gz` searches public OSM address **points** from the Geofabrik Berlin extract dated 13 November 2026. It contains only public addresses, positions, IDs and exact retained-family bindings. A 5 cm tolerance handles source rounding at the footprint boundary. It never chooses a nearby house merely because no containing building was found.

| Search street | Points inside a retained building family | Points with no retained family at their position |
| --- | ---: | ---: |
| Yorckstraße | 95 | 14 |
| Hohenzollerndamm | 176 | 107 |
| Leberstraße | 79 | 5 |
| Gustav-Müller-Straße / -Platz | 74 | 0 |
| Cheruskerstraße | 39 | 0 |
| Torgauer Straße | 9 | 44 |
| Gotenstraße | 82 | 12 |
| Naumannstraße | 55 | 4 |
| Kolonnenstraße | 81 | 3 |

These are address points, including multiple businesses at one address, **not unique house counts**. The named Rote-Insel streets are a search set rather than a surveyed quarter boundary. Non-selected fronts keep all previous detail; a matching address alone does not establish facade appearance. Yorckstraße 80 was investigated but is not part of the final correction. Western Hohenzollerndamm ensembles at 67–80 and 127–129 have official photographic evidence but no matching retained building body at the examined address points; they receive no guessed facade. The DRV high-rise is not inferred from the lower neighbouring source owner.

## Ownership and independent modes

`roteInselCorridorsEntriesV354` uses the existing source-quarter loader and existing host lifetime, before `railway-parks-v354`. There are nine existing hosts and 18 mode keys, totalling 573,617 compressed bytes. Drawn and Native are independently clipped to their actual source walls; Native relief is cardinal, including stepped window hoods. Full Drawn geometry is the same on mobile and desktop. No new controller, resident scene, navigation solid, ground district, photographic texture or budget increase is introduced.

For each selected wall, the compiler checks the actual family's footprint boundary and confirms its exact triangle survives the full previous production decoder. Prior V188 generic window triangles are retired only after matching their complete positions and colours; every retired triangle has a durable receipt. Main source geometry is not retired. All recipes contain complete nonempty replacements and close if raw bytes, prepared geometry or gzip bounds differ.

The existing `-2_7` predecessor already declines five older families at their raw guard (`network-fidelity-v326`, `main-road-fronts-v346`, `sacred-places-v347`, `civic-facilities-v350`, `facility-paths-v350`) in both modes. This release records the same pre-existing behaviour; it does not weaken those gates. The new production proof compares against the actual admitted predecessor, including all retained ground overlays.

## Reproduction and validation

Run from the repository root:

```sh
PYTHONPATH=.:scripts uv run python scripts/inventory_rote_insel_corridors_v354.py
PYTHONPATH=.:scripts uv run python scripts/build_rote_insel_corridors_v354.py
bun src/app/scripts/capture-rote-insel-corridors-v354.ts <task>/support < <task>/capture-inputs.json
PYTHONPATH=.:scripts uv run python scripts/build_rote_insel_corridors_v354.py --build
uv run pytest -q tests/test_rote_insel_corridors_v354.py
bun test src/app/tests/rote-insel-corridors-v354.test.ts
```

The source point extract must be available for the first command. The compiler's task directory defaults to the V354 research workspace and can be set with `--task-dir <task>`. The support capture intentionally excludes the current corridor and subsequent railway-park recipes. Their raw/previous output remains the production input, not a synthetic fixture.

Seven Python checks cover exact sources, public-only address metadata, all retirement positions/colours, independent cardinal Native geometry and payload bounds. Two Bun tests exercise the real production decoder on all 18 keys, preserve every old position/colour word, unrelated triangle, ordered ownership entry, material hook, navigation record and wire, and test stale/corrupt transfer closure. Actual production proof is saved in the task's `actual-production-proof.json`.
