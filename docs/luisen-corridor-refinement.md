# Luisenstraße, Schumannstraße and Reinhardtstraße

Step 10, v1.0.6. The facade pass runs from the Charité side of Luisenstraße
south towards the Spree and east along the theatre route through Schumannstraße
and Reinhardtstraße to Friedrichstadt-Palast. These are context buildings;
the tour catalogue and bounds remain unchanged.

## Source inventory

`luisenCorridorSource.json` copies **120 exact delivered Berlin LoD2 parts**
into 25 source-parent profiles. Every footprint vertex, courtyard hole, height,
roof code and original tone remains unchanged. Its 65 existing OSM road axes
retain Luisenstraße, Schumannstraße and Reinhardtstraße placement and establish
which source walls face the public streets. These lines orient the facade
work; they do not replace roads or add invented street connections.

The following identities distinguish adjoining houses and prevent one generic
facade treatment from covering an entire block. The linked OSM elements are
identity evidence, not surveys of individual window positions.

| Address / building | Exact LoD2 parent | Parts | Identity |
|---|---|---:|---|
| Luisenstraße 14–15 | `DEBE01YYK0000D5m` | 2 | [node/538888183](https://www.openstreetmap.org/node/538888183) |
| Luisenstraße west / Schumann–Reinhardt block | `DEBE01YYK00008WW` | 3 | LoD2 street frontage |
| Philippine Embassy, Luisenstraße 16 | `DEBE00YY2ko0000r` | 7 | [way/672269130](https://www.openstreetmap.org/way/672269130) |
| Luisenstraße 17 / Reinhardtstraße offices | `DEBE01YYK000032O` | 2 | [node/1999140864](https://www.openstreetmap.org/node/1999140864) |
| Luisenstraße 19, former pharmacy / Arte Luise | `DEBE01YYK000028w` | 4 | [node/332554293](https://www.openstreetmap.org/node/332554293) |
| Luisenstraße 32–34, former Kaiserliches Patentamt | `DEBE01YYK000035D` | 1 | [node/885432795](https://www.openstreetmap.org/node/885432795) |
| Luisenstraße 35 | `DEBE01YYK00006if` | 2 | [way/32359649](https://www.openstreetmap.org/way/32359649) |
| Luisenstraße 38 | `DEBE01YYK0000EpD` | 5 | [node/1552572864](https://www.openstreetmap.org/node/1552572864) |
| Luisenstraße 39, Mori-Ôgai-Gedenkstätte | `DEBE01YYK00007KU` | 2 | [node/429739550](https://www.openstreetmap.org/node/429739550) |
| Luisenstraße 40 | `DEBE01YYK0000E5g` | 7 | [node/1999140865](https://www.openstreetmap.org/node/1999140865) |
| Luisenstraße 41 | `DEBE01YYK00004Pc` | 4 | [node/332554290](https://www.openstreetmap.org/node/332554290) |
| Luisenstraße 42 / Reinhardtstraße 39 | `DEBE01YYK00007kv` | 1 | [node/1976864021](https://www.openstreetmap.org/node/1976864021) |
| Luisenstraße 44 / Reinhardtstraße 38 | `DEBE01YYK00005Bh` | 8 | [node/1552574520](https://www.openstreetmap.org/node/1552574520) |
| Luisenstraße 45 | `DEBE01YYK00007xY` | 4 | [node/4269744593](https://www.openstreetmap.org/node/4269744593) |
| Luisenstraße 46 / Café Luise | `DEBE01YYK0000Auc` | 2 | [node/1552574990](https://www.openstreetmap.org/node/1552574990) |
| Luisenstraße 48–52 / Schumannstraße 19 | `DEBE01YYK000085n` | 32 | [node/429739553](https://www.openstreetmap.org/node/429739553) |
| Reinhardtstraße 34 | `DEBE01YYK00003Xg` | 4 | [node/1976864038](https://www.openstreetmap.org/node/1976864038) |
| Reinhardtstraße 36 | `DEBE01YYK00003OO` | 3 | [node/1976864037](https://www.openstreetmap.org/node/1976864037) |
| Reinhardtstraße 37 | `DEBE01YYK00004l8` | 4 | [node/1976864018](https://www.openstreetmap.org/node/1976864018) |
| Reinhardtstraße 19 | `DEBE01YYK00008Rk` | 4 | [node/1552567882](https://www.openstreetmap.org/node/1552567882) |
| Reinhardtstraße 15–17 | `DEBE01YYK00003hp` | 4 | [node/1552566714](https://www.openstreetmap.org/node/1552566714) |
| Reinhardtstraße 13, Haus der deutschen Caritas | `DEBE01YYK00006YO` | 4 | [way/105733623](https://www.openstreetmap.org/way/105733623) |
| Reinhardtstraße 8 | `DEBE01YYK00004ap` | 4 | [way/104393529](https://www.openstreetmap.org/way/104393529) |
| Reinhardtstraße 10 | `DEBE01YYK0000CS2` | 5 | [way/104393534](https://www.openstreetmap.org/way/104393534) |
| Reinhardtstraße 12 | `DEBE01YYK0000543` | 2 | [way/104393530](https://www.openstreetmap.org/way/104393530) |

Luisenstraße 18 / Landesvertretung Sachsen-Anhalt keeps four exact source parts
(`mIgrCTOY`, `7c76Dz9u`, `5WQW7BjX`, `T3KBPJfQ`) in its dedicated
[facade model](sachsen-anhalt-facade-refinement.md), outside the 120 parts.
Its eastern street edge now carries three ochre storeys, nine upper bays,
the central closed 1874 oriel and portal. The former four-storey north-party-wall
front and unverified side windows are removed; its source body and roof remain.
Deutsches Theater/Kammerspiele, Böll-Stiftung, historic Charité and existing
federal-state representations remain separate architectural owners.

## Facade differences and evidence

The [Landesdenkmalamt Friedrich-Wilhelm-Stadt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095859%2CT)
establishes the surviving historic street ensemble. Its
[Luisenstraße 19 pharmacy account](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095894)
specifically identifies cross-divided windows, surrounds, the central entrance
axis and cornice consoles. The German Foreign Office's
[Philippine representation listing](https://manila.diplo.de/ph-de/willkommen/laenderinfos/vertretungen-in-deutschland)
and Humboldt-Universität's [Mori-Ôgai contact page](https://www.ogai.hu-berlin.de/contact-en)
verify the embassy at number 16 and memorial at number 39.

Historic plaster houses receive shallow surrounds, cornices, cross-window
transoms, projecting sills, storey courses and restrained eaves consoles.
Modern office fronts retain separate stone-grid, punched-window and silver
louvre readings. The former Patentamt has stone joints, coupled pilasters,
arched accents and heavier ledges. Luisenstraße 48–49 / Schumannstraße 19 has
grey cladding and bowed metal balcony cues. Street-facing ground-floor glazing
is distinct from upper and courtyard windows.

Repeated floor and bay counts, window dimensions, material swatches, moulding
projections, balcony spacing and ornamental subdivisions are **photo-proportioned
procedural estimates**, not an opening-by-opening survey. Street panoramas
sometimes show only partial views or a material family across adjoining
houses. The photographed main yellow facade in *Landesvertretung Sachsen-Anhalt
in Berlin.JPG* is number 18; number 19 appears only as a narrow adjacent strip.
That photograph therefore does not establish number 19's complete facade.
Number 19's specific architectural features instead follow its monument entry.
Older photographs establish architectural vocabulary without asserting current
occupants, current signage or unchanged 2026 street conditions.

The 120 stored facade-top values derive from the existing renderer's exact
source roof/eaves interpretation. Window and cornice elements stop below these
values, leaving pitched roofs visible. The `sourcePrisms` input also checks the
full delivered context, including unselected adjoining buildings, to hide
shared interior facade fields rather than looking only at the 120 selected
parts. It suppresses 683 otherwise buried pane centres at 69 adjoining parts;
source footprints, courtyard holes and roofs remain intact. Thin Minecraft
facades sample actual 4 m cell corners and share one clearance displacement
per bay across the window, frame and trim. Impossible tight-courtyard overlays
are omitted. Mobile profiles reduce
repetitive microdetail while preserving the building sequence and facade types.

The full/mobile drawn batches and Minecraft batches each use two renderables
and one shared 24-vertex cube. The measured overlay budgets, excluding retained
source buildings, are:

| Representation | Instances | Rendered vertices | Unique geometry/instance bytes |
|---|---:|---:|---:|
| Drawn full | 24,038 | 576,912 | 1,827,536 |
| Drawn mobile | 20,614 | 494,736 | 1,567,312 |
| Minecraft full/mobile | 11,251 | 270,024 | 855,724 |

Six targeted tests with 13,209 assertions check the 120 exact source parts,
584 outward wall normals, all 3,151 pane centres against 1,158 neighbouring
source parts, shared Minecraft frame/pane offsets and actual geometry rays
across all 25 facade profiles. There are no remaining buried pane centres in
that source-context check. Software-rendered views of actual retained bodies
and voxel geometry were inspected from the north, south and in Minecraft;
these are geometry checks, not a browser or device interaction claim.

## External references actually used

All nine files below were inspected as external visual references. They remain
attribution-only, with no image, thumbnail, crop or photographic texture bundled
or loaded by the viewer. The project retains the per-file license in both
Wikimedia manifests.

| Reference | Photographer | License | Principal use |
|---|---|---|---|
| [Berlin 20260713 Luisenstraße.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20260713_Luisenstra%C3%9Fe.jpg) | NutzerAusBerlin | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Luisenstraße streetscape and pale historic facade materials, 13 July 2026. |
| [Mitte Luisenstraße.JPG](https://commons.wikimedia.org/wiki/File:Mitte_Luisenstra%C3%9Fe.JPG) | Fridolin freudenfett | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Luisenstraße street sequence and facade-family contrast; dated August 2011 streetscape, not a 2026 opening survey. |
| [Reinhardtstraße Berlin-Mitte 2024-05-09 01.jpg](https://commons.wikimedia.org/wiki/File:Reinhardtstra%C3%9Fe_Berlin-Mitte_2024-05-09_01.jpg) | Leonhard Lenz | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Reinhardtstraße street-facing building hierarchy and varied cornice/window rhythms, 9 May 2024. |
| [Wohn- und Geschäftshaus Luisenstraße 48-49 — Schumannstraße 19 (1).jpg](https://commons.wikimedia.org/wiki/File:Wohn-_und_Gesch%C3%A4ftshaus_Luisenstra%C3%9Fe_48-49_%E2%80%94_Schumannstra%C3%9Fe_19_(1).jpg) | Андрей Романенко | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Modern grey cladding and bowed metal balcony vocabulary at Luisenstraße 48–49 / Schumannstraße 19, 6 June 2012. |
| [Berlin, Mitte, Luisenstrasse 42, Geschaeftshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Luisenstrasse_42,_Geschaeftshaus.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Silver external sun-louvre facade at Luisenstraße 42 / Reinhardtstraße 39, 25 April 2010. |
| [Berlin 20260713 Kaiserliches Patentamt.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20260713_Kaiserliches_Patentamt.jpg) | NutzerAusBerlin | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Former Kaiserliches Patentamt rustication, coupled pilasters and arched facade details, 13 July 2026. |
| [Landesvertretung Sachsen-Anhalt in Berlin.JPG](https://commons.wikimedia.org/wiki/File:Landesvertretung_Sachsen-Anhalt_in_Berlin.JPG) | Kvikk | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Luisenstraße 18 Landesvertretung Sachsen-Anhalt: three-storey yellow historic facade, central bay and cornice; adjacent Luisenstraße 19 is only a partial streetscape reference. 13 September 2014. |
| [Philippinische Botschaft, Luisenstraße, 2019-12-07 ama fec (3).jpg](https://commons.wikimedia.org/wiki/File:Philippinische_Botschaft,_Luisenstra%C3%9Fe,_2019-12-07_ama_fec_(3).jpg) | 44penguins (Angela M. Arnold) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Philippine Embassy at Luisenstraße 16 and adjacent office facade, 7 December 2019. |
| [Berlin, Mitte, Luisenstrasse 39, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Luisenstrasse_39,_Mietshaus.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Mori-Ôgai-Gedenkstätte building Luisenstraße 39: historic facade, 24 April 2010. |

The additional theatre and foundation references are recorded separately in
[Deutsches Theater/Kammerspiele](deutsches-theater-refinement.md),
[Heinrich-Böll-Stiftung](boell-stiftung-refinement.md) and
[Friedrichstadt-Palast](friedrichstadt-palast-refinement.md). Those documents
also distinguish exact source anchors from the corrected interpretation of
entrance positions, the Böll cantilever and the Palast height hierarchy.
