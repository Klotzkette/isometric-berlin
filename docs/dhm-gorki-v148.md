# Deutsches Historisches Museum and Maxim Gorki Theater — v1.0.48

Pipeline step 10. These bounded recognition models add no tour stop, texture,
remote asset request or out-of-polygon geometry. The four drawn modes retain
the same full model on touch and pointer devices. Minecraft uses its own
surface-only cube batches and does not retain a smooth duplicate.

## Original geometry and identity

`uv run python scripts/build_dhm_source.py` extracts eleven original parts from
the retained [Berlin LoD2 tile 391_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip),
Geoportal Berlin, dl-de/zero-2-0. `dhmSource.json` retains every original wall
and roof ring, source archive hash, creation date and previous display record.

| Building | Official parent | Parts | OSM identity / old prism |
|---|---|---:|---|
| Zeughaus | `DEBE01YYK00000ln` | 1 | `way/15971186` / `15971186` |
| Schlüterhof glass canopy | `DEBE01AL53j00006` | 1 | Within Zeughaus; no separate old prism |
| Pei-Bau | `DEBE01YYK00000wY` | 9 | `way/330840124` / `30840124` |

The source Zeughaus has a detailed open courtyard ring and a principal source
top of 22.786 m in the viewer coordinate system. Its separate glass roof
retains the four original planes, perimeter y=25.374–25.402 m and apex
y=29.305 m. These distinct source heights are preserved, not flattened to a
generic single building roof. The closed vertical envelope below this canopy
is a LoD2 generalisation: the display keeps only its actual roof sheets and
steel grid, with the original walls retained in the source file. The court
remains open below the canopy; collision uses base y=25.374 m for this part.

The Pei-Bau retains all nine parts, including the curved triangular limestone
body, adjoining lower volumes, glass foyer and upper stair cylinder. The foyer
part `DEBE3DFw5k86zVJB` has source top y=18.453 m; the upper glass cylinder
`DEBE3De1XccDSz8G` reaches y=22.649 m. The latter's duplicate lower glazing is
displayed only above the foyer roof, avoiding overlapping glass walls while
retaining every original source record. The two existing OSM fallback prisms
alone are excluded; the replacement-column predicate includes their exact
old footprints and all eleven measured parts, without a surrounding rectangle.

## Architecture and interpretation limits

The [museum's architectural account](https://www.dhm.de/museum/geschichte-und-architektur/architektur/)
identifies the restored rose plaster, baroque sculptural decoration, 40 × 40 m
Schlüterhof, four exhibition levels, triangular Pei building and full-height
glass foyer. The [Berlin conservation account](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/zeughaus-deutsches-historisches-museum-641128.php)
confirms the restored courtyard glazing. Participating architects
[Eller + Eller](https://eller-eller.de/portfolio/deutsches-historisches-museum-berlin/)
describe the projecting glazed spiral stair, light French limestone and
relationship of the exhibition volume to the foyer. I. M. Pei was a
Chinese-American architect. The current
[museum construction notice](https://www.dhm.de/besuch/baumassnahme/) distinguishes
the closed Zeughaus from the operating Pei-Bau. No future renovation volume,
scaffold or temporary promotional artwork is invented.

The Zeughaus receives rose plaster, two window levels, dark mullioned glazing,
lower arches, alternating upper hoods, rusticated courses, balustrade and
bounded trophy silhouettes. Front openings follow the source projection of
each shallow pilaster/riser so that real source walls cannot bury their
windows. Four engaged columns, a low pediment, portal and shallow relief cues
identify the south entrance. Local bay/member dimensions and simplified
ornaments are procedural display fits; they do not claim an architectural
survey or reproduce sculpture scans.

The transparent Pei shell visibly contains **108 rising treads**, separate
inner/outer rails and the open steel support. Glazing is transparent in both
day and night materials, with opacity 0.16 and depth writes disabled. The
source roof and cylinder shape remain authoritative; stair radius, pitch,
member size and subdivision are explicitly procedural fits. The model does
not add general public interior navigation to the museum. Native Minecraft
keeps the same clear stair reading using separate translucent perimeter blocks
and an opaque cube batch for structural surfaces and treads. It does not fill
the entire building interior with hidden cubes.

The Maxim Gorki Theater retains all three original LoD2 parts, the unchanged
interpreted pitched hall roof and distinct northern stage tower, and its three
entrance portals. This pass adds the three photographed paired-griffin/lyre
relief fields, two rows of Corinthian leaf cues on each large pilaster capital,
and shallow west-side plaster courses. The former hall panels stay blind,
without invented glass. Roof, footprint, neighbouring Palais and prior window
details are not removed. The [Gorki history account](https://www.gorki.de/de/das-theater-und-seine-geschichte-ein-spaziergang/2017-03-04-1700)
and [Berlin monument record 09030077](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030077)
anchor its identity; photo evidence supplies facade subdivision only.

## External images inspected

Four Commons files were read through the imageinfo API and inspected at
1,000-pixel requested thumbnail width. Files remained under `/tmp/dhm-v148`;
no image, crop or texture is bundled or loaded. Merge-ready metadata is in
`/tmp/dhm-gorki-v148-references.json`.

| File | Author | Licence | Use |
|---|---|---|---|
| [Deutsches Historisches Museum, Berlin-Mitte, 170128, ako.jpg](https://commons.wikimedia.org/wiki/File:Deutsches_Historisches_Museum,_Berlin-Mitte,_170128,_ako.jpg) | Ansgar Koreng | [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/) | Curved limestone facade, glass foyer, cylinder and steel supports |
| [Treppenturm, Deutsches Historisches Museum, Berlin, 150118, ako.jpg](https://commons.wikimedia.org/wiki/File:Treppenturm,_Deutsches_Historisches_Museum,_Berlin,_150118,_ako.jpg) | Ansgar Koreng | [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/) | Visible stair ribbon, frames and upper glazing |
| [Zeughaus, Berlin front 2.JPG](https://commons.wikimedia.org/wiki/File:Zeughaus,_Berlin_front_2.JPG) | BrokenSphere | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Rose plaster, entrance columns, pediment, arches and balustrade |
| [Berlin, Mitte, Maxim-Gorki-Theater 02.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Maxim-Gorki-Theater_02.jpg) | Beek100 | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Three paired relief fields, capital leaves and side plaster courses |

Historical photos supply enduring architectural form only. Promotional posters,
flags and temporary installations shown in them are not reproduced.

## Integration and validation

- `createDhmArchitecture()` and `createMinecraftDhmArchitecture()` are separate
  roots. `DHM_PRISM_IDS` suppresses only the two documented generic prisms.
- Navigation uses all eleven `DHM_PARTS`, `dhmPartBaseAt`, `dhmPartRoofAt` and
  the bounded `dhmWalkableAt` courtyard exception.
- `isDhmReplacementColumn` removes only original/source footprint columns;
  no source ground, street, water or external facade is removed.
- No animation or per-frame geometry work is added. All instance transforms
  are frozen; there are no textures or new runtime downloads.

| Model | Stored renderables | Instances | Geometry/instance buffer bytes |
|---|---:|---:|---:|
| DHM drawn | 6 | 5,346 | 604,152 |
| DHM native | 2 | 17,560 | 1,335,856 |
| Gorki drawn | 2 | 562 | 58,480 |
| Gorki native | 1 | 1,693 | 129,316 |

Focused validation: nine Bun tests check source ownership, source immutability,
continuous rising stairs within measured glazing, transparent day/night
materials, courtyard clearance, finite instance transforms and bounded
allocation. Three Python tests cover complete source retention, approved bounds,
re-extraction and the unchanged Gorki source contract. TypeScript and focused
Ruff checks pass. Isolated Chrome renders were visually inspected for DHM,
Pei and Gorki in drawn/native forms; this caught buried facade windows and
discontinuous cylinder rings, both corrected before handoff. Integrated viewer
QA and physical-device coverage are reported in the release review separately.
