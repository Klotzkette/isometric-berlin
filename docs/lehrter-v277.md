# Lehrter Straße: Kulturfabrik and police, v277

This is a bounded reconstruction of two existing mapped sites along the Lehrter corridor, not a claim that the entire street has been resurveyed. All 51 retained named Lehrter Straße line records remain unchanged; no road, curb, coverage or navigation budget is replaced.

## Identity and evidence

The Kulturfabrik is **Lehrter Straße 35**, the 1911–12 Wertheim building by Ernst Scharnke. The [Berlin heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050403) describes the narrow five-storey facade, three axes, monumental arched recesses, stone piers, relief spandrels and balustrade. The operator’s [historic facade photograph](https://kulturfabrik-moabit.de/wp-content/uploads/2016/06/fassade_leerstand.jpg) supplies architectural recognition, not metric survey coordinates or a bundled texture. Three upper round arches, paired rectangular windows, their mullions and transoms, two lower arched openings, piers, courses and balustrade are explicit geometry. Small dimensions, subdivision positions and facade tones are interpretation. The historic monochrome photograph does not establish current paint colours.

[Filmrauschpalast](https://kulturfabrik-moabit.de/gruppen/filmrauschpalast/) belongs here. [Slaughterhouse](https://kulturfabrik-moabit.de/gruppen/slaughterhouse/) is in the **rear courtyard at ground level**, distinct from the former basement venue and from cultural use at Lehrter Straße 60/61. Its modest geometric sign is therefore on an actual rear source facade. Venue-sign placement and size are display estimates; these are not surveyed apertures or invented walk-through tunnels. See also the operator’s [history](https://kulturfabrik-moabit.de/ueber-uns/geschichte/) and [room information](https://kulturfabrik-moabit.de/kontakt/vermietung/).

The police owner is the measured **Kruppstraße 2–4** site adjoining Lehrter Straße, confirmed by [BIM](https://www.bim-berlin.de/ueber-uns/nachhaltigkeit/foerdermassnahmen) and a current [Berlin police employment notice](https://www.karriereportal-stellen.berlin.de/SachbearbeiterinSachbearbeiter-Digitalisierung-in-der-Land-de-j70665.html). The [former clothing depot at Lehrter Straße 57–58](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050323) is not relabelled police. Police roof/body geometry is surveyed; small secondary facade rows and entrance-sign placement are explicitly estimated.

## Complete source ownership

The new frozen source contains all **8 measured parts and 83 original wall/roof surfaces** from [Berlin LoD2 tile 388_5821](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5821.zip). Original surfaces and all old presentation records are retained. The existing scene ground datum remains 5.2 m; original relative heights and roof slopes are preserved.

| Site | Official parent | Old presentation owners | Complete parts |
|---|---|---|---:|
| Kulturfabrik | DEBE01YYK0002RHX | ui4o8MEJ, hlcQTuwD, UEwVyTdb | 3 |
| Police | DEBE01YYK0002Kmg | 37687041 / OSM way 237687041 | 5 |

The police body was previously an 11 m generic prism. Its complete survey reaches 26.52 m above the retained scene datum. The comparison against the **actual quantized rendered** old footprint gives 99.5896% overlap. All **4.3933684323 m²** of old-only footprint remain as explicitly recorded original-height wall/roof complements and navigation; source-only footprint is 4.5399419323 m². The earlier research estimate of about 99.63% used the unquantized OSM footprint, not the runtime prism.

Kulturfabrik has **1.3002988143 m²** of old-only footprint, likewise retained. Its quantized `ui4o8MEJ` ring is self-crossing. GEOS `make_valid` linework retains both bounded polygon components, rather than discarding a component through largest-polygon selection or `buffer(0)`. The exact original ring and both polygonized components are in the evidence file. No historic source file is rewritten.

Only the four exact old fingerprints yield. Native retirement binds **96 complete exclusive column tuples on 94 XZ cells**. Four exact neighbour records and **14 mixed neighbour column tuples** remain. A changed/missing/duplicated owner, changed tuple or cell size fails closed; new or changed neighbouring geometry protects its overlapping cells. No bounding rectangle is erased. Neither v269 Moabit facade-head data nor v273 residential colour data names these four owners.

## Runtime and walking

`LehrterV277.ts:createLehrterV277(native=false)` provides all detail in both desktop and mobile construction. Drawn geometry contains 389 triangles, 1,317 facade boxes, 100 arch segments and four geometric labels. The independent native representation contains 2,976 surface cells plus 4,712 orthogonal fittings and native lettering, with no hidden solid infill. It does not rotate the drawn facade mesh into native mode.

`lehrterV277Ownership.ts` exports `isLehrterSourceV277` and `createLehrterColumnTesterV277`. The shared option is `lehrterV277`; the required group must be constructed before the old presentation yields. `lehrterV277Profile.ts:lehrterSolidsV277` supplies complete measured roof triangles plus every old-only outline in drawn mode, and the exact occupied cell union in native mode. Native solids are bound once per site to existing old owners; police measured parts are explicitly bound to `37687041`. Both open courtyard witnesses remain walkable. No new stairs or raised external steps are inferred.

Measured submitted geometry, including lettering:

| Mode | Draws | Instances | Attribute/instance bytes |
|---|---:|---:|---:|
| Drawn | 2 | 1,670 | 169,580 |
| Native | 1 | 7,958 | 605,456 |

Mobile and desktop submissions are byte-identical within each mode. Source runtime JSON totals **456,430 bytes** before existing lossless build encoding: model 423,289, navigation 28,202, ownership 4,939. No runtime limits were increased.

## Verification and provenance

`tests/test_lehrter_v277.py` checks the independent original archive, every retained wall/roof surface and ground footprint, old/new outline union, both self-crossing-ring components, every native source vertex, orthogonal fitting clearance, courtyard openings, venue distinctions and untouched road-source digest. The optional raw ZIP is not distributed; the archived geometric source remains in the repository. The ZIP test ran against the original archive in this work session.

`lehrter-v277-ownership.test.ts` checks all exact source/column mutations and the actual initial, distant and progressive retirement paths. `lehrter-v277.test.ts` checks required construction, submitted mobile/native geometry, actual navigation through live Day → Native → Day changes and the actual native constructor. The constructor leaves all mixed-neighbour bodies and old neighbour-window matrices intact. Newly exposed generic windows may appear on retained neighbour faces after a neighbouring old column retires; they must still belong to those retained columns. All old exclusive-owner window matrices disappear.

Source SHA-256: `ad977c54ad90f21d645cbd252b9a937cb51c6224f7cbe7210d5e521ea6891b94`.
Evidence SHA-256: `de01fcc736830685041b202ec7416e2c361f2fc7e1a357ccdd18408328fe8800`.
Original ZIP SHA-256: `44676967f904025d91adc5b013e21bf68cd2260da88983d6c7c02a2c1b41e723`.

No browser rendering or production release build was run by the Lehrter subtask; those are separate integration checks. The source proves the measured building geometry, not every present-day material or unmeasured window dimension.
