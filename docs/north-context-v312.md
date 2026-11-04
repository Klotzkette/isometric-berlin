# Nordbahnhof, Helmholtzplatz and Danziger Straße (Step 10, v312)

This pass adds static details to six locations using the same geometry on
pointer and touch. Minecraft uses independently fitted cardinal boxes. The
evidence ledger, `geo_data/regierungsviertel/north-context-v312-evidence.json.gz`,
records the complete station source family, original packet and source hashes,
the selected wall planes, the mapped features, and the terrain observations.

| Site | What the viewer adds | Placement and limits |
| --- | --- | --- |
| Stettiner Vorortbahnhof, Julie-Wolfthorn-Straße 1 | Yellow-brick front, three arched entry axes, large multi-light thermal window, piers and brick courses | The retained `DEBE01YYK00007hE` family has three parts and 29 official sheets. Both Alt-Mitte families already draw its actual roof, whose main ridge reaches scene Y 18.82 m in drawn mode. The original OSM fallback `27822655` is already suppressed. New details sit on the delivered façade, including separate source-aligned steps on its native face. Small fitting sizes are estimates. |
| Park am Nordbahnhof | A visible raised retaining edge and coping on the mapped southeastern course | Only OSM `way/53257004`. Its exact centreline is subdivided at intervals of up to 1.3 m. The ground beside it is tied to the retained scene Y 5.2 m and the measured nearby street sample of 35.14 m NHN. DGM1 samples inside the edge put the highest estimated wall top at Y 8.09 m before the thin coping. Sample offsets, wall width and coping profile are display choices. The complete park surface and closed Stettiner Tunnel keep their earlier representation. |
| Stettiner Carrée, Caroline-Michaelis-Straße 5–11 | Restrained two-tier glass, aluminium frame and sill rhythm on the four v266 fronts | The existing office volume and v266 entrances remain. Exact individual window sizes and positions are unsurveyed. The neighbouring Nordbahnhof Carré is a separate complex and has no new fitting in this pass. |
| MYJUMP, Caroline-Michaelis-Straße 8 | Plain procedural lettering on a v266 entrance fascia | The operator confirms the venue. The lettering identifies it in the model. It is a display label, with its proportions and styling chosen to fit the existing fascia. |
| Helmholtzplatz | Five stone-toned table tennis tables with nets | OSM nodes `2836208452`, `2836209528`, `4666202282`, `4666202533`, `9186931365`. Each rests on its delivered family’s actual surface. Table sizes and orientations are display estimates. The existing Platzhaus, Kiezkind, lawns, paths and equipment remain. |
| Grundschule im Hofgarten, Danziger Straße 50 | Four levels of brick surrounds, recessed-looking glazing, mullions, sills and bands | Ten complete drawn and nine independent native wall spans of `DEBE03AL3Ho00003` inside OSM school site `way/210109717`. The official building envelope and schoolyard remain. The earlier three `6_-5` frontage companions contain zero existing exterior fitting triangles in the selected ranges. Opening subdivisions are display estimates. |

The new walking solids use the exact rendered wall and table boxes. The gap
between the table legs, pavement and routes around both ends of the wall remain
clear. The fixed source recipes use the existing final-count instanced box
builder. The drawn station arches use one small additional mesh. The compact
runtime profile is about 96 kB before transfer compression. There are no new
streaming descriptors, textures, animations or additional tour stops.

## Primary sources and reuse

- The Landesdenkmalamt Berlin describes Armin Wegner's former Vorortbahnhof,
  the higher basilical hall, yellow brick, three-part entrance and thermal
  window. The historical main terminal is a separate, demolished building.
  [Monument 09011300](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011300)
- Bezirksamt Mitte describes the raised former railway land. The LDA documents
  the adjacent closed tunnel and surviving historic wall. The measurements
  used here come from retained Geoportal Berlin DGM1, dl-de/zero-2-0.
  [Park history](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2527_park-am-nordbahnhof.pdf) ·
  [LDA tunnel record](https://www.berlin.de/landesdenkmalamt/aktivitaeten/presse/2025/pressemitteilung.1595442.php) ·
  [DGM1 source tile](https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5820.zip)
- WICONA’s reference identifies the RKW office complex and its aluminium window
  system. MYJUMP confirms the separate hall address and use.
  [Stettiner Carrée project](https://www.heinze.de/architekturobjekt/stettiner-carre-berlin/12621434/) ·
  [MYJUMP Berlin Mitte](https://myjump.de/berlin-mitte)
- The district documents the square’s playground, promenade and two existing
  public buildings. Berlin’s neighbourhood account also confirms table tennis.
  [Pankow Helmholtzplatz](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513033.php) ·
  [Helmholtzkiez public amenities](https://www.berlin.de/special/stadtteile/kieze/7701852-7429665-helmholtzkiez.html)
- Bezirksamt Pankow confirms the four-storey brick school and the conservation
  work. The project photograph is credited to Bezirksamt Pankow. The LDA lists
  the school and former teacher’s residence as the same heritage ensemble.
  [Restoration project](https://www.nachhaltige-erneuerung.berlin.de/prenzlauer-berg/grundschule-danziger-strasse-50-denkmalgerechter-umbau) ·
  [Monument 09070139](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070139)

Existing LoD2 data is from Geoportal Berlin (dl-de/zero-2-0). The retained
mapped geometry is © OpenStreetMap contributors (ODbL-1.0). The public accounts
guide identification and interpretation. No reference media ships in the model.

Rebuild the finite data with `uv run --no-sync python -m scripts.build_north_context_v312`
from the repository root. The builder reads the retained public-source inputs
and verifies support against the existing actual mode-specific packet geometry.
`bun test tests/north-context-v312.test.ts` from `src/app` checks both batches,
including cardinal instance transforms and walking clearance around table legs.
