# Friedrichswerdersche Kirche and Auswärtiges Amt — v1.0.48

Pipeline step 10. This bounded source supplement restores the church's two
front towers and gives the old and new Foreign Office separate source envelopes
and facade readings. It adds no tour stop, no runtime photo and no proposed
building. All four drawn modes share full detail on touch and pointer devices;
Minecraft uses its own single surface-only cube batch.

## Metric sources and retention

The already retained official [Berlin LoD2 tile 391_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip),
created 2 March 2026 and licensed dl-de/zero-2-0, supplies every wall and roof
sheet in `eastCivicSource.json`. The JSON records the archive hash, all thirteen
parent identities, all fifty-seven original part identities and all four old
fallback prisms unchanged. The canonical LoD2/OSM data is not rewritten.
Regenerate with `uv run python -m scripts.build_east_civic_source`.

| Building | OSM | Official families | Parts | Old display prism IDs |
|---|---|---:|---:|---|
| Friedrichswerdersche Kirche | way/24044937 | 1 | 3 | `24044937` |
| Foreign Office new building, atria and reception canopy | relation/15933949; relation/15933948 | 5 | 14 | `15933949`, `15933948` |
| Foreign Office old building and attached historic wings | relation/57390 | 7 | 40 | `on-57390` |

The church parent is `DEBE01YYK00001lM`: the main nave and two separate tower
parts `DEBE3DyLqyvesbrt` / `DEBE3DwNDmqAIY6r`. Their original roof tops are
**42.161 m** and **42.057 m** in the E389500/N5820000/H30 scene frame. The
previous OSM-only prism reached 19.2 m including its 5.2 m ground datum and
therefore could not show the towers. The full nave roof, polygonal apse,
buttress footprint and both tower envelopes now survive in every mode.
Small pinnacles above source roofs are explicitly procedural subdivisions;
their unpublished member heights are not claimed to be survey measurements.

The main new-office parent is `DEBE01YYK0000AMm`. Independent official families
`DEBE01YYK0001yYO`, `DEBE00YY1Mk000Kv`, `DEBE01YYK0001xuZ` and
`DEBE01YYK0001xIr` retain the western glass hall, eastern loggia, reception
canopy and its eight measured piers. The old main family `DEBE01YYK0000437`
retains all 27 parts, its pitched roof hierarchy and the courtyard network;
six smaller families retain the attached southern/eastern wings and service
parts. Original basement elevations remain source values; the ordinary walking
datum is 5.2 m, without translating the building heights.

## Architecture evidence and display limits

The [SMB's institutional profile](https://www.smb.museum/en/museums-institutions/friedrichswerdersche-kirche/about-us/profile/)
identifies Schinkel's 1824–30 church as a red-brick, single-nave work inspired
by English college chapels. The [Schinkel portal](https://schinkel.smb.museum/image_orte.php?id=19)
confirms its restrained neo-Gothic vocabulary and exposed brick. The model
adds the two belfry registers, three tall belfry openings per tower face,
paired southern entrance, tall pointed nave windows, mullions, circular
tracery cues, horizontal brick bands, open parapets, four small corner
pinnacles per tower and two clock faces. The archangel above the portal is a
small generic recognition silhouette. No scanned sculpture or texture is used.
Window spacing, brick colour, mullion thickness, clock hands and individual
ornaments are procedural fits to the external licensed photographs, not a
new facade survey. The existing official roof planes remain authoritative.

The [Foreign Office's building history](https://www.auswaertiges-amt.de/de/aamt/geschichte-des-auswaertigen-amts/gebaeude)
identifies the old building as Heinrich Wolff's 1934–40 Reichsbank extension.
The [architect's completed-project dossier](https://mueller-reimann.de/sites/default/files/2018-09/060_AAB_Auswaertiges_Amt_Pressemappe.pdf)
documents Müller/Reimann's 1996–99 new building, its divided volumes,
city-related courts, library and entrance. The old building receives pale
stone frames, a more monumental lower order, dark window divisions and
horizontal courses. The new building has restrained stone window bays,
the five eastern glass bands, roof glazing with mullion divisions and the
high river-side loggia. Photographs guide material and facade rhythm only;
all positions and outer envelopes come from the official source.

Two source conflicts need bounded display correction:

1. The new building's coarse main roof `DEBE3DYaStnJ2Nlk` overlaps the more
   specific lower pitched glass roof `DEBE3DJrlFgy3FFk`. Its exact original
   roof remains recorded. The displayed broad roof receives a hole matching
   the specific part's exact footprint, and the glass roof's original planes
   become visible. Roof sampling and native blocks share that same exclusion.
   No glass roof is replaced by an invented rectangular height.
2. The east loggia `DEBE01YYK0001xuZ` and south reception canopy
   `DEBE3DsRd9T01uJe` have closed ground-to-roof LoD2 walls. They are displayed
   with their original roofs and upper 0.9 m bands. The coarse main wall's
   overlap is partitioned by the exact east-loggia footprint and opened only
   below that band. Eight source reception piers remain; two procedural east
   loggia posts remain explicit rendered and collidable solids. No outside
   wall complement is dropped.

The roof sheets of both source atria remain present. Glazing is drawn in the
project's muted vector glass colours, with no image, reflection map or runtime
transparent-layer accumulation. Unseen repeated facade boxes behind another
source part are omitted only where a full-height source solid already covers
them; every visible outside/courtyard face remains eligible.

## Integration and collision

- `createEastCivicArchitecture()` / `createMinecraftEastCivicArchitecture()`
  own the separate drawn/native roots and all fifty-seven parts.
- `EAST_CIVIC_PRISM_IDS` suppresses exactly the four old display masses and
  their generic facade decoration. Original records remain in the JSON.
- `isEastCivicReplacementColumn(x,z)` uses exact source/old rings and their
  holes, with a cheap early bounding rejection; it never removes a district
  rectangle. Actual neighbouring streets and uncovered courts stay free.
- `eastCivicPartRoofAt(part,x,z)` samples original source planes, excluding
  only the broad parent roof over the independently retained glass atrium.
  `eastCivicPartBaseAt(part,x?,z?)` supplies the canopy underside. The x/z
  arguments are needed to account for the overlapping coarse main wall.
- `eastCivicWalkableAt(x,y,z,sourceId?)` opens the two documented canopy voids.
  `eastCivicSupportSolidAt(x,z,footY,height)` protects the two explicit east
  posts. Original south piers remain independent source collision parts.
  The source church has no newly invented open interior.

## Inspected external photographs

Four Commons thumbnails were inspected outside the repository; their complete
license/author records were read from the Commons imageinfo metadata. The
merge-ready records are in `/tmp/east-civic-v148-references.json`. No source
photograph, crop or photo-derived runtime texture is bundled.

| File | Author | License | Role |
|---|---|---|---|
| [Berlin, Mitte, Werderscher Markt, Friedrichswerdersche Kirche 05.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Werderscher_Markt,_Friedrichswerdersche_Kirche_05.jpg) | Jörg Zägel | CC BY-SA 3.0 | Southern twin towers, belfries, clocks, paired entrance and tracery |
| [Berlin, Mitte, Werderscher Markt, Friedrichswerdersche Kirche 07.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Werderscher_Markt,_Friedrichswerdersche_Kirche_07.jpg) | Jörg Zägel | CC BY-SA 3.0 | Five nave bays, buttresses, parapet and pinnacles |
| [Auswärtiges Amt Neubau Berlin.jpg](https://commons.wikimedia.org/wiki/File:Ausw%C3%A4rtiges_Amt_Neubau_Berlin.jpg) | Andreas Praefcke | CC BY 3.0 | Stone and eastern glass bands, open high loggia |
| [ZK-SED-Berlin.jpg](https://commons.wikimedia.org/wiki/File:ZK-SED-Berlin.jpg) | Bettenburg | CC BY-SA 2.0 DE | Existing old building's north front and lower giant order; historic usage label is not copied |

## Validation and bounded cost

Two focused Python tests check re-extraction equality, retained previous
records, all wall/roof sheets, both tower heights and every vertex against
approved bounds. Focused Ruff format/check passes. Five frontend regressions
check actual rendered tower raycasts in both forms, open loggia raycasts,
column collision, visible lower atrium roof, original court/street clearance,
source ownership, finite buffers and texture-free static construction.

| Representation | Draws | Instances | Stored geometry + instance bytes |
|---|---:|---:|---:|
| Full drawn, same on mobile | 7 | 16,907 | 1,624,700 |
| Native Minecraft, surface only | 1 | 32,323 | 2,457,196 |

The counts cover this new ensemble, not the total viewer process. They do not
claim physical-iPhone memory measurements or a frame-rate guarantee. Geometry
is constructed once; no animation or frame-sized temporary buffers were added.
The separate local Chrome WebGL preview was inspected in drawn/native forms,
with the complete main nave/towers, new-office loggia and source courtyards
visible. Integrated viewer/mobile validation is documented by the release review.
