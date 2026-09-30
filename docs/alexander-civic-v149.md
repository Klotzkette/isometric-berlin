# Rotes Rathaus and St. Marienkirche — v1.0.49

Pipeline step 10. The owner requested a detailed Rotes Rathaus and the church
beside the Fernsehturm. This is St. Marienkirche, distinct from the previously
refined Friedrichswerdersche Kirche. The supplement stays wholly inside the
approved v1.0.48 bounds, adds no tour stop and changes no existing source file.
The four drawn modes share identical full geometry on pointer and touch;
Minecraft has its own surface-only cube batch without a smooth duplicate.

## Complete metric evidence

`alexanderCivicSource.json` retains every original wall and roof sheet, ground
ring, source elevation and parent identity. Regenerate with
`uv run python -m scripts.build_alexander_civic_source`.

| Building | OSM identity | Geoportal Berlin LoD2 parent | Parts |
|---|---|---|---:|
| Rotes Rathaus | [relation/4211905](https://www.openstreetmap.org/relation/4211905) | `DEBE01YYK00000wg`, tile `391_5819` | 4 |
| St. Marienkirche | [way/474111581](https://www.openstreetmap.org/way/474111581) | `DEBE01YYK000006X`, tile `391_5820` | 5 |

Both official archives have a 2 March 2026 creation date. They are licensed
[dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0), and their exact SHA-256
hashes remain recorded in the supplement. The entire Rathaus profile, including
all three source courtyards, is copied from the preceding outline supplement;
that v1.0.48 source file remains byte-for-byte unchanged. The Marien main nave,
all pitched roof planes, polygonal choir and both lower annexes remain original
source sheets. No mass is fitted to an invented rectangle. Source basement
values stay 3.460 m / 4.607 m in the E389500/N5820000/H30 scene frame; ordinary
pedestrian/native ground retains the established 5.2 m datum.

## Source-separated architecture

The [Senatskanzlei building history](https://www.berlin.de/rbmskzl/service/rotes-rathaus/architekturgeschichte/)
and [Landesdenkmalamt inventory 09011264](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011264)
identify the red-brick four-wing complex, three courts, Renaissance/Norman
vocabulary and terracotta frieze. The model keeps round-headed lower windows,
the two principal facade orders, paired mullions, light stone horizontal bands,
brick arcatures, cornices, relief-like terracotta fields, four clock faces,
terminal structure and a small procedural Berlin-colour flag. Decorative
marks are geometric cues, not reproductions of historical narrative reliefs.

The [parish's building history](https://marienkirche-berlin.de/kirchen-standorte/baugeschichte/)
identifies the medieval brick hall church and the 1789 copper-clad tower crown.
The [official on-site history sheet](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2491_st-marien-baugeschichte.pdf)
distinguishes the nave, later western tower and 1789/90 tower form. The model
adds red roof/brick, exposed pale masonry, pointed windows, mullions, low
buttresses, southern side chapels, entrance, four dark/gold clocks, copper
pilasters, balcony rails, open octagonal lantern, shaped copper helm, gilt
knob and cross. It depicts the enduring architecture, without inventing a
current scaffold campaign. Every intermediate subdivision, member size,
material swatch and clock-hand pose is a procedural photograph fit rather than
a metric facade survey. There are no photographs, textures, fonts or new
runtime requests in the model.

Two explicit display conflicts are preserved rather than concealed:

1. **Rathaus tower:** the LoD2 tower `DEBE3DgmfpurHZfT` has a closed pyramidal
   roof rising from 73.158–75.613 m to 87.125 m. The actual upper termination
   consists of a flat parapet/platform and an open steel terminal. The inventory
   and [Senatskanzlei tower account](https://www.berlin.de/rbmskzl/service/rotes-rathaus/rathausturm-928027.php)
   establish the 94 m complete silhouette and almost 5 m clock faces. The
   [official Solarzentrum profile](https://www.berlin.de/solarcity/solarzentrum/information/leuchtturmprojekte/denkmalgeschuetztes-rotes-rathaus-erzeugt-solarstrom/)
   separately confirms the 74 m parapet and 94 m complete silhouette.
   The visible model therefore preserves the original lower tower walls and
   uses a separately labelled platform at 77.460 m scene elevation, with thin
   steel members and the flagpole top at 97.460 m. It does not draw the retained
   solid source pyramid over the open steelwork. All three other Rathaus
   source parts and all courts/roof sheets are unchanged.
2. **Marien tower:** parts `DEBE3Dm03ICrhanR` and `DEBE3DdD31Y72ErY` overlap as
   closed ground-to-roof hulls. These cannot represent the transparent Gothic
   lantern. The display keeps the measured lower masonry outline, partitions
   it at a documented procedural 42.4 m material transition, and fits the
   copper clock stage and genuinely open lantern to the measured centre and
   footprint. Its shaped helm reaches the retained source top 83.072 m;
   a procedural knob/cross reaches 87.4 m. Unpublished intermediate heights
   are not claimed to be survey data, and the model does not silently stretch
   every source part to a nominal overall church height.

## Integration and collision

`createAlexanderCivicArchitecture(mobileLike=false)` and
`createMinecraftAlexanderCivicArchitecture(mobileLike=false)` construct the
separate static roots. The mobile argument does not reduce detail. The
lightweight profile exports all nine parts, exact prism identities and
`isAlexanderCivicReplacementColumn`; only the exact owned footprints and
retained previous fallback records are eligible for replacement.

The two coarse Marien tower part IDs are excluded from ordinary source
collision and covered by `alexanderCivicTowerSolidAt`: masonry/clock body,
actual slender lantern posts, upper arches, helm and finial. The centre of
the lantern stays open. `alexanderCivicPartRoofAt` returns the corrected Rathaus
platform instead of the generalized source pyramid; `rathausTerminalSolidAt`
adds only the steel terminal and mast. The three Rathaus courts and surrounding
streets remain outside building collision. These upper-level callbacks do not
create an invented publicly enterable church interior.

## Inspected visual references and licensing

These four Commons thumbnails were downloaded into `/tmp` and inspected;
complete author/license metadata came from Commons imageinfo. They are
external visual references only. Merge-ready credits were supplied as
`/tmp/alexander-civic-v149-references.json` for both shipped credit manifests.

| Reference | Author | License |
|---|---|---|
| [Berlin-Rotes Rathaus-04-Fernsehturm-2017-gje.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Rotes_Rathaus-04-Fernsehturm-2017-gje.jpg) | Gerd Eichmann | CC BY-SA 4.0 |
| [Berlin-Rotes Rathaus-14-Turm-2017-gje.jpg](https://commons.wikimedia.org/wiki/File:Berlin-Rotes_Rathaus-14-Turm-2017-gje.jpg) | Gerd Eichmann | CC BY-SA 4.0 |
| [St. Marienkirche, Berlin-Mitte, Turm, 160213, ako.jpg](https://commons.wikimedia.org/wiki/File:St._Marienkirche,_Berlin-Mitte,_Turm,_160213,_ako.jpg) | Ansgar Koreng | CC BY 4.0 |
| [Marienkirche B-Mitte 03-2014.jpg](https://commons.wikimedia.org/wiki/File:Marienkirche_B-Mitte_03-2014.jpg) | A. Savin | CC BY-SA 3.0 |

## Validation and cost

Two Python regressions verify deterministic re-extraction, equality with every
retained Rathaus source field, all five Marien parts, all three courts, source
wall/roof completeness and every vertex against approved bounds. Five frontend
regressions verify finite texture-free buffers, unchanged evidence, exact
pointer/touch detail equality, collision of the represented tower solids and
actual rendered ray clearance through all three Rathaus courts, the copper
lantern and the open steel terminal. Four local Chrome WebGL poses were
inspected in both drawn and native forms: Rathaus, Marien, close tower and
courtyards. No physical-phone performance claim is made.

| Representation | Draws | Instances | Geometry + instance buffer bytes |
|---|---:|---:|---:|
| Full drawn, identical on touch | 7 | 32,439 | 2,586,204 |
| Native Minecraft, identical on touch | 1 | 29,175 | 2,217,948 |

Native construction took approximately 30 ms in the local Bun measurement;
this is a bounded construction observation, not a device/frame-rate guarantee.
The geometry is built once, stays resident and introduces no per-frame work,
textures, camera-dependent reconstruction or hidden solid voxel fill.
