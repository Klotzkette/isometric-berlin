# Auswärtiges Amt and Reichsbank street elevations — v344

This changes six finite public elevations inside the existing `EastCivicArchitecture` owner. The old v148 building sheets, all 57 LoD2 part IDs, measured roofs, church, original atrium, open Stadtloggia and unaffected courtyard/wing details remain. It does not replace the complete complex with a new guessed solid or recolour a district.

## Visible correction

The earlier generator treated each straight source-ring segment as a complete facade and discarded segments shorter than eight metres. Consequently, long curved Reichsbank elevations had missing windows, while the northern four-level monumental facade received the same six rows as other office walls. The modern northern facade had isolated windows although the photo shows five continuous glazing bands.

- The 111.207 m northern Reichsbank elevation now has the large lower order and three upper window rows, with narrower bronze divisions and a higher pilaster/architrave arrangement.
- The 190.265 m Kurstraße and 140.039 m Unterwasserstraße paths retain every original curve vertex. Five storey rhythms continue over the short curve segments. Small stone course joints and projecting cornices follow the same measured path.
- The modern 65.236 m Werderscher Markt and 35.535 m river elevations receive five continuous grey-green glass bands with slim horizontal divisions and mullions.
- The measured 31.921 m Lichthof curtain receives slim stays, glass fins, floor divisions and entry frames. Its original glass source sheet and roof remain.

Photographs inform the facade composition, member proportions and muted local tones. They are not textures; no photograph pixels or network image requests are shipped. Existing body colours remain. Window bay counts, subdivisions, projection depths and lower doorway proportions are display fits, not a new measured survey. This is an exterior correction, not an assertion of accessible offices or a complete interior reconstruction.

## Source and visual evidence

Metric placement is the unchanged retained Berlin LoD2 source in `src/app/src/eastCivicSource.json`, tile `391_5819`, already documented in [east-civic-v148.md](east-civic-v148.md). Its six paths are copied reproducibly by `src/app/scripts/build-foreign-office-v344.ts`; all vertices and top elevations remain bound to their exact source owner.

Primary descriptions checked on 2026-11-14:

- [Auswärtiges Amt: building history](https://www.auswaertiges-amt.de/de/aamt/geschichte-des-auswaertigen-amts/gebaeude): identifies Heinrich Wolff's 1934–1940 Reichsbank extension and the contrasting new ministry building.
- [Landesdenkmalamt, Reichsbank extension, object 09095989](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095989): steel structure, granite/sandstone exterior and the curved building form. No new historical footprint was inferred from the description.
- [Müller Reimann Architekten: Auswärtiges Amt](https://www.mueller-reimann.de/projekte/auswaertiges-amt-berlin): the Lichthof, Empfangshof and Stadtloggia, and the layered glass curtain with narrow elements and cables.
- [Auswärtiges Amt: Das Haus am Werderschen Markt](https://www.auswaertiges-amt.de/resource/blob/1345836/48af40d154e608b33fe02bd886c06248/das-haus-am-werderschen-markt-data.pdf): northern monumental order and office facade character.

Freely licensed photographs inspected; only geometric observations were used:

| Image | Credit / licence | Observation |
| --- | --- | --- |
| [Auswärtiges Amt 01.jpg](https://commons.wikimedia.org/wiki/File:Ausw%C3%A4rtiges_Amt_01.jpg), 14 May 2023 | Derbrauni, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Northern continuous five-band glazing; glass entry curtain; fine stone courses |
| [Auswärtiges Amt Neubau Berlin.jpg](https://commons.wikimedia.org/wiki/File:Ausw%C3%A4rtiges_Amt_Neubau_Berlin.jpg), February 2006 | Andreas Praefcke, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | River glazing rhythm, open loggia and narrow piers |
| [Berlin, Mitte, Kurstrasse, Erweiterungsbau der Reichsbank.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Kurstrasse,_Erweiterungsbau_der_Reichsbank.jpg), 17 June 2010 | Jörg Zägel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Continuous curved stone front, five rows, dark narrow frames and cornice |
| [Auswaertiges Amt Spree.jpg](https://commons.wikimedia.org/wiki/File:Auswaertiges_Amt_Spree.jpg), 25 June 2007 | Doris Antony, Berlin, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Canal curve and dense repeating stone-window rhythm |
| [ZK-SED-Berlin.jpg](https://commons.wikimedia.org/wiki/File:ZK-SED-Berlin.jpg), uploaded 16 April 2006 | Bettenburg, [CC BY-SA 2.0 DE](https://creativecommons.org/licenses/by-sa/2.0/de/) | Three upper rows above the monumental lower order |
| [Berlin auswaertigesamt kl.jpg](https://commons.wikimedia.org/wiki/File:Berlin_auswaertigesamt_kl.jpg), 2004 | Sansculotte, [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/) | Context, roof courts and placement of modern glazing |

The dated images support permanent architectural features; they are not claimed as a 2026 photographic survey. Scaffolds, temporary works, flags and occupants are not extrapolated from them.

## Integration and ownership

Both existing factories accept `{ refineForeignOffice: true }`. With that option, the new source guard checks the complete retained source encoding (208,052 characters, guard `525428176`, SHA-256 `5a776bc658ad0995169c6e522fcbc0540fb6e06b532536d33eaf37092dd05a69`). Only when all new details have been constructed does `ministry` omit the six corresponding legacy facade ranges and the replaced old-front pilasters. New glass roof beams, loggia supports and old entrance steps remain.

If the full source changes, the new refinement declines and the complete legacy facade builder remains active. Omitting the option retains the previous standalone matrices and budgets, allowing existing historical owners/tests to keep their contract.

Native independently derives its new details from the actual two-metre grid columns emitted by `nativeShell`. For each fitting it uses the exposed cardinal face, visible wall base, roof height, exact part ID and nearby matching source path. It does not copy the rotated Drawn facade. All six Native paths must be represented before any old fitting is retired. The resulting 310 exposed faces cover north/curves/new glass/curtain with 53/110/84/31/17/15 faces respectively. The twenty-four monumental pilaster stations are individually transferred onto those existing cardinal north-front faces. There is no lowered mobile setting or camera-distance detail reduction.

## Verification and bounded cost

`bun test tests/foreign-office-v344.test.ts tests/east-civic.test.ts` passes 11 tests. These inspect actual output: rays hit continuous glass between the old isolated-window positions; more than 94% of the sampled short-curve window probes hit the new visible glass; the monumental/five-floor elevations differ; every new Native instance matrix is cardinal and attached to the emitted shell; all four original source meshes remain byte-identical; the open loggia and lower atrium remain; a source edit restores complete legacy fitting matrices.

| Entire EastCivic owner, including retained church | Draws | Instances | Geometry + instance bytes |
| --- | ---: | ---: | ---: |
| v148 Drawn default | 7 | 16,907 | 1,624,700 |
| v344 Drawn enabled | 9 | 26,195 | 2,331,236 |
| v148 Native default | 1 | 32,323 | 2,457,196 |
| v344 Native enabled | 3 | 40,045 | 3,044,716 |

The increase is bounded to +706,536 bytes Drawn / +587,520 bytes Native and two static draw batches, with no texture allocation, runtime fetch, animation, timers or additional district shells. Each instance buffer is directly sized; no duplicate constructor buffers are retained. The focused TypeScript check of both modified modules passes. The all-app default Node TypeScript invocation exceeded its 4 GB heap before producing diagnostics; the parent release performs overall validation and viewer screenshots.
