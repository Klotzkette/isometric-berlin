# District town halls: identity and architecture evidence (v1.0.127)

Reviewed 16 October 2026. This inventory interprets “all former districts” as the 23 boroughs immediately before the 2001 reform. All twelve present borough main seats fall within the same 23 site identities; a present borough can retain several additional administrative offices.

This is an identity/recognition inventory, not a claim that every window has been surveyed. Source coordinates, complete building sheets, roofs and actual heights belong to `townhall-osm-v227.json` and `townhall-source-v227.json`. The matching keys in `townhall-identities-v227.json` provide the compact semantic record. Unknown facade colors and subdivisions remain display estimates. Published approximate tower heights do not override measured geometry.

The independent completeness check compares every site's retained envelope with its mapped building and building-part footprints, allowing ordinary OSM/LoD2 boundary disagreement. This catches a small annex being mistaken for a complete Rathaus. Coverage does not establish roof accuracy: explicitly marked OSM fallback envelopes remain estimates. In particular, no independently mapped tower part was found in the retained OSM polygons at Spandau, Neukölln or Reinickendorf; the semantic tower descriptions below are not permission to fabricate their geometry.

`townhallV227Ownership.json` independently replays exact colored packet triangles and ink for 25 complete-source replacement owners. Four Rathaus Mitte parents already have more detailed packet bodies than a coarse parent-envelope replay, so they remain retained in both modes. The receipt grants no transfer for those four, for dedicated existing landmark models, or for preserved fallback bodies. The replay and coverage checks are in `tests/test_townhall_inventory_v227.py`.

| Former borough | Site / address | Current borough | Main seat today | Primary identity evidence |
|---|---|---|---|---|
| Mitte | Rathaus Mitte — Karl-Marx-Allee 31 | Mitte | No | [Official source](https://www.berlin.de/ba-mitte/ueber-den-bezirk/erinnerungskultur/historisches/rathaeuser/) |
| Tiergarten | Rathaus Tiergarten — Mathilde-Jacob-Platz 1 | Mitte | Yes | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050351) |
| Wedding | Rathaus Wedding — Müllerstraße 146–147 | Mitte | No | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030306) |
| Friedrichshain | Rathaus Friedrichshain — Frankfurter Allee 35–37 | Friedrichshain-Kreuzberg | Yes | [Official source](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/bezirksamt/clara-herrmann/) |
| Kreuzberg | Rathaus Kreuzberg — Yorckstraße 4–11 | Friedrichshain-Kreuzberg | No | [Official source](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/kontakt-zur-unteren-denkmalschutzbehoerde-514431.php) |
| Pankow | Rathaus Pankow — Breite Straße 24a–26 | Pankow | Yes | [Official source](https://www.berlin.de/ba-pankow/ueber-den-bezirk/das-rathaus/architektur/artikel.195528.php) |
| Prenzlauer Berg | Bezirksamt Prenzlauer Berg / Fröbelstraße — Fröbelstraße 17 | Pankow | No | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090089) |
| Weißensee | Rathaus Weißensee / Askaniahaus — Berliner Allee 252–260 | Pankow | No | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030598) |
| Charlottenburg | Rathaus Charlottenburg — Otto-Suhr-Allee 100 | Charlottenburg-Wilmersdorf | Yes | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096383) |
| Wilmersdorf | Ehemaliges Rathaus Wilmersdorf — Fehrbelliner Platz 4 | Charlottenburg-Wilmersdorf | No | [Official source](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/gebaeude-und-anlagen/verwaltungs-und-gerichtsgebaeude/artikel.158748.php) |
| Spandau | Rathaus Spandau — Carl-Schurz-Straße 2–6 | Spandau | Yes | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085502) |
| Steglitz | Rathaus Steglitz — Schloßstraße 37 / Grunewaldstraße | Steglitz-Zehlendorf | No | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065628) |
| Zehlendorf | Rathaus Zehlendorf — Kirchstraße 1–3 / Teltower Damm 16–18 | Steglitz-Zehlendorf | Yes | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075954) |
| Schöneberg | Rathaus Schöneberg — John-F.-Kennedy-Platz 1 | Tempelhof-Schöneberg | Yes | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066565) |
| Tempelhof | Rathaus Tempelhof — Tempelhofer Damm 165 | Tempelhof-Schöneberg | No | [Official source](https://fbinter.stadt-berlin.de/ScansBPlan/07_TS/7-82a_Begr.pdf) |
| Neukölln | Rathaus Neukölln — Karl-Marx-Straße 83 | Neukölln | Yes | [Official source](https://www.berlin.de/ba-neukoelln/ueber-den-bezirk/sehenswertes/artikel.105690.php) |
| Treptow | Rathaus Treptow — Neue Krugallee 4 | Treptow-Köpenick | No | [Official source](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41392.php) |
| Köpenick | Rathaus Köpenick — Alt-Köpenick 21 | Treptow-Köpenick | Yes | [Official source](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41403.php) |
| Marzahn | Rathaus Marzahn — Helene-Weigel-Platz 8 | Marzahn-Hellersdorf | No | [Official source](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085212) |
| Hellersdorf | Rathaus Hellersdorf / Marzahn-Hellersdorf — Alice-Salomon-Platz 3 | Marzahn-Hellersdorf | Yes | [Official source](https://www.berlin.de/ba-marzahn-hellersdorf/politik-und-verwaltung/bezirksamt/) |
| Lichtenberg | Rathaus Lichtenberg — Möllendorffstraße 6 | Lichtenberg | Yes | [Official source](https://www.berlin.de/ba-lichtenberg/politik-und-verwaltung/behoerdenwegweiser/artikel.264580.php) |
| Hohenschönhausen | Bezirksamt Hohenschönhausen / Große-Leege-Straße — Große-Leege-Straße 103 | Lichtenberg | No | [Official source](https://www.berlin.de/ba-lichtenberg/aktuelles/rathausnachrichten/artikel.1151425.php) |
| Reinickendorf | Rathaus Reinickendorf / Rathaus Wittenau — Eichborndamm 215–239 | Reinickendorf | Yes | [Official source](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/tourismus/artikel.82768.php) |

## Distinctions that affect the model

- Mitte means the existing Karl-Marx-Allee 31 administrative building; the merged borough’s main seat is Rathaus Tiergarten. Neither the demolished Hotel Berolina nor a future Haus der Statistik Rathaus is a current replacement.
- Friedrichshain-Kreuzberg’s main mayoral address is Frankfurter Allee 35–37. Yorckstraße remains a separate Rathaus/BVV site; the neighboring Dragoner barracks are not its building.
- Prenzlauer Berg is the Fröbelstraße 17 former hospital campus, with separate roofs and open courts. The official monument record identifies houses 6 and 9 and the gatehouse separately. A temporary Bürgeramt move does not identify the entire campus as house 9.
- Weißensee means the Askania administrative ensemble at Berliner Allee 252–260, not the town hall of Weißensee in Thuringia. Hohenschönhausen means Große-Leege-Straße 103, not the older village hall at Hauptstraße 50.
- Wedding’s red clinker original and its modern high-rise/assembly-hall extension have different architectural treatments. Reinickendorf likewise has a distinct modern south extension and Ernst-Reuter-Saal.
- Zehlendorf’s historic design explicitly omitted a tower. Planned extensions are not existing structures. Schöneberg’s present tower crown is the postwar open bell/sound stage, not the destroyed original cupola.
- Wilmersdorf means the existing Fehrbelliner Platz 4 building. The destroyed Brandenburgische Straße predecessor and the unrealized Preußenpark plan must not be reconstructed here.

## Recognition cues and limits

### Rathaus Mitte

Existing district administration; the present merged district's main seat is Rathaus Tiergarten. 1998 administrative high-rise with horizontal window/concrete bands and a glazed stairwell Rear assembly pavilion; not the former Hotel Berolina or a future Rathaus at Haus der Statistik

Evidence: [Source 1](https://www.berlin.de/ba-mitte/ueber-den-bezirk/erinnerungskultur/historisches/rathaeuser/), [Source 2](https://service.berlin.de/standort/122280/).

### Rathaus Tiergarten

Existing main seat of the merged district Mitte. Five-storey civic block with recessed honor court and portico facing Turmstraße Preserve the court and actual roof; no invented Rathaus clocktower

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050351), [Source 2](https://www.berlin.de/ba-mitte/ueber-den-bezirk/erinnerungskultur/historisches/rathaeuser/).

### Rathaus Wedding

Existing former district town hall and later administrative extension. Plain red clinker main block from 1929–30 Distinct 1964–66 modern extension/high-rise and assembly hall; do not give the extension the old block's brick treatment

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030306), [Source 2](https://www.berlin.de/ba-mitte/ueber-den-bezirk/erinnerungskultur/historisches/rathaeuser/).

### Rathaus Friedrichshain

Existing main administrative/mayoral address of Friedrichshain-Kreuzberg. Modern office building: use its retained source envelope, actual roof and facade tags No independently verified historic tower or ornament; source-bound regular facade fittings remain estimates

Evidence: [Source 1](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/bezirksamt/clara-herrmann/), [Source 2](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/service-und-organisationseinheiten/facility-management/aktuelles/220622_verbrauchsveroeffentlichung_bafk_berichtsjahr-2020.pdf).

### Rathaus Kreuzberg

Existing municipal office/BVV site; not the current district mayor's principal address. Retain the source office block and its separate parts Do not confuse the adjacent Dragoner barracks in the Rathausblock with the Rathaus itself; unsurveyed window divisions remain estimates

Evidence: [Source 1](https://www.berlin.de/ba-friedrichshain-kreuzberg/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/kontakt-zur-unteren-denkmalschutzbehoerde-514431.php), [Source 2](https://www.berlin.de/rathausblock-fk/gebiet/).

### Rathaus Pankow

Existing main town hall of merged Pankow. Broad red clinker and red sandstone main building with granite base Projecting center with three entrance arches and columns; corner clocktower with balcony bays, balustrade, cylindrical upper stage and lantern The original copper main roof was removed historically; retain the measured present roof rather than reconstructing the original

Evidence: [Source 1](https://www.berlin.de/ba-pankow/ueber-den-bezirk/das-rathaus/architektur/artikel.195528.php), [Source 2](https://www.berlin.de/ba-pankow/).

### Bezirksamt Prenzlauer Berg / Fröbelstraße

Existing municipal campus in the former hospital and hospice ensemble; several buildings, not one invented freestanding town hall. Retain mapped campus buildings, courtyards and distinct source roofs Hospital ensemble dates to 1886–89; houses 6 and 9 and gatehouse are separate 1896 additions House 6 is documented for district administration; temporary moves to house 9 do not justify moving the complete Rathaus identity there. Material and window estimates must remain labeled

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090089), [Source 2](https://www.berlin.de/ba-pankow/aktuelles/pressemitteilungen/2020/pressemitteilung.891504.php), [Source 3](https://www.berlin.de/ba-pankow/politik-und-verwaltung/service-und-organisationseinheiten/finanzen/artikel.127205.php).

### Rathaus Weißensee / Askaniahaus

Former district Rathaus in the Askania factory administration ensemble; present Bürgeramt. Office/factory ensemble with administrative building and hall from 1940–41; use the measured envelope Do not substitute a picturesque medieval town hall from the unrelated town Weißensee; no invented clocktower or speculative facade material

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030598), [Source 2](https://service.berlin.de/standort/329682/).

### Rathaus Charlottenburg

Existing main town hall of Charlottenburg-Wilmersdorf. Ornamented sandstone street facade with Jugendstil details and clocktower Street roofs with red tiles, courtyard roofs with slate; the 1911–13 extension is more restrained Retain measured tower and roof geometry; published overall heights are not replacement dimensions

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096383), [Source 2](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/spazieren-und-wandern/kiezspaziergaenge/artikel.176577.php), [Source 3](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/geschichte/literatur/mdb-hausarbeit_rathaus_charlottenburg-1.pdf).

### Ehemaliges Rathaus Wilmersdorf

Existing former Rathaus, not the merged district's main seat; specific present tenancy is not asserted. 1941–43 masonry complex with rounded inner court and horizontal divisions; Tuscan columns in the court Do not reconstruct the destroyed predecessor at Brandenburgische Straße or the unbuilt Preußenpark Rathaus plan

Evidence: [Source 1](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/gebaeude-und-anlagen/verwaltungs-und-gerichtsgebaeude/artikel.158748.php).

### Rathaus Spandau

Existing main district town hall. 1910–13 town hall with tall clocktower and four clock faces Keep the present surveyed tower crown and roof; do not restore destroyed historic elements from old photographs

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085502), [Source 2](https://www.berlin.de/tourismus/touren/6420239-956960-spaziergang-durch-das-alte-spandau.html).

### Rathaus Steglitz

Existing former district town hall and present municipal site. 1896–97 town hall with 1934 alteration; preserve the existing dedicated brick/gable/spire recognition Keep the complete source sheets and distinct roof parts; no unverified numeric tower-height override

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065628).

### Rathaus Zehlendorf

Existing main municipal campus; proposed extension is not an existing building. Three-wing 1926–29 administrative scheme, column arcade, loggia and large civic hall windows Explicitly designed without a Rathaus tower; retain actual campus buildings instead of filling the whole site polygon Competition and future extension plans do not authorize future volumes

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075954), [Source 2](https://www.berlin.de/ba-steglitz-zehlendorf/politik-und-verwaltung/aemter/stadtentwicklungsamt/stadtplanung-und-denkmalschutz/denkmalschutz/denkmal-des-monats/artikel.92620.php), [Source 3](https://mein.berlin.de/projekte/rathaus-zehlendorf/information/).

### Rathaus Schöneberg

Existing main district town hall. Four-storey plaster building above high sandstone base, colossal Ionic pilasters, high hipped roofs and multiple courts Clock/bell tower's postwar crown has open sound bays; do not reconstruct the destroyed original cupola

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066565), [Source 2](https://www.berlin.de/sehenswuerdigkeiten/3560314-3558930-rathaus-schoeneberg.html).

### Rathaus Tempelhof

Existing former district town hall and municipal site; future Neue Mitte Tempelhof plans excluded. Four-storey old building and lower 1960 extension are distinct source parts Keep measured roofs and tower-like masses without adding a guessed historic tower; the low extension is not treated as the old facade

Evidence: [Source 1](https://fbinter.stadt-berlin.de/ScansBPlan/07_TS/7-82a_Begr.pdf), [Source 2](https://www.berlin.de/ba-tempelhof-schoeneberg/aktuelles/pressemitteilungen/2022/pressemitteilung.1168103.php), [Source 3](https://www.berlin.de/neue-mitte-tempelhof/stadtquartier/).

### Rathaus Neukölln

Existing main district town hall. Light stone facade, red roofs and green copper clocktower crown with Fortuna weather figure Retain postwar wings as built; documented overall tower-height differences are not geometry instructions

Evidence: [Source 1](https://www.berlin.de/ba-neukoelln/ueber-den-bezirk/sehenswertes/artikel.105690.php), [Source 2](https://www.berlin.de/tourismus-neukoelln/entdecken/artikel.1153524.php).

### Rathaus Treptow

Existing former district town hall, current municipal/BVV site. 1909–10 Renaissance-influenced town hall; keep existing irregular source building and roofs Distinct from the merged district's main Rathaus Köpenick; facade subdivisions not measured in the reference remain estimates

Evidence: [Source 1](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41392.php), [Source 2](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/service-und-organisationseinheiten/facility-management/artikel.849447.php).

### Rathaus Köpenick

Existing main district town hall, with 2026 reopening after refurbishment. Brick Gothic town hall, ornamental gables, tracery and glazed bricks Preserve corner tower and all 1901–04/1920s/1930s source wings; retained dedicated model remains authoritative

Evidence: [Source 1](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41403.php), [Source 2](https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/artikel.9466.php), [Source 3](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/service-und-organisationseinheiten/sozialraumorientierte-planungskoordination/regionen/artikel.977782.php).

### Rathaus Marzahn

Existing listed former district town hall and municipal offices. 1985–88 civic building by Eisentraut, Bock and Walther at the square's north edge Keep distinctive measured massing and roof articulation; material/window details beyond retained tags remain display estimates, with no added medieval clocktower

Evidence: [Source 1](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09085212), [Source 2](https://www.nachhaltige-erneuerung.berlin.de/marzahn-hellersdorf/helene-weigel-platz), [Source 3](https://www.berlin.de/ba-marzahn-hellersdorf/politik-und-verwaltung/aemter/stadtentwicklungsamt/).

### Rathaus Hellersdorf / Marzahn-Hellersdorf

Existing main administrative seat of Marzahn-Hellersdorf. Modern Rathaus within Helle Mitte; retain measured block/courtyard and regular window character No independently verified historical tower or exact color specification; material and subdivision estimates remain labeled

Evidence: [Source 1](https://www.berlin.de/ba-marzahn-hellersdorf/politik-und-verwaltung/bezirksamt/), [Source 2](https://www.berlin.de/ba-marzahn-hellersdorf/service/wegweiser/artikel.638658.php), [Source 3](https://www.nachhaltige-erneuerung.berlin.de/marzahn-hellersdorf/alice-salomon-platz).

### Rathaus Lichtenberg

Existing main district town hall. Red brick town hall from 1898 with retained source gables and roof Keep present roof and upper masses; no conjectural restoration of a former crown

Evidence: [Source 1](https://www.berlin.de/ba-lichtenberg/politik-und-verwaltung/behoerdenwegweiser/artikel.264580.php), [Source 2](https://www.berlin.de/ba-lichtenberg/auf-einen-blick/buergerservice/gemeinwesen/stadtteilprofil_alt_lichtenberg_2015_teil1-1_stand_2806.pdf).

### Bezirksamt Hohenschönhausen / Große-Leege-Straße

Existing former borough administration and current municipal/Bürgeramt site. Preserve actual modern office envelope and facade tags with modest source-bound regular window fittings This is not the old village Rathaus at Hauptstraße 50; no invented ornamental tower

Evidence: [Source 1](https://www.berlin.de/ba-lichtenberg/aktuelles/rathausnachrichten/artikel.1151425.php), [Source 2](https://www.berlin.de/ba-lichtenberg/politik-und-verwaltung/behoerdenwegweiser/artikel.264580.php).

### Rathaus Reinickendorf / Rathaus Wittenau

Existing main district town hall with modern extension and Ernst-Reuter-Saal. Red brick and shell limestone, curved Dutch-Baroque gables, bays and clocktower 1950s south extension and Ernst-Reuter-Saal retain their separate modern character; do not apply old brick ornament to every part Published tower heights vary; retain measured source geometry

Evidence: [Source 1](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/tourismus/artikel.82768.php), [Source 2](https://www.berlin.de/ba-reinickendorf/service/wirtschaft/wirtschaftsfoerderung/tourismus/dorfertour_dorfkerne-in-reinickendorf.pdf), [Source 3](https://denkmaltag.berlin.de/denkmal/?id=6776).
