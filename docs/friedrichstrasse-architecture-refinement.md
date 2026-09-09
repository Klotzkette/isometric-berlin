# Friedrichstraße and Schiffbauerdamm refinement — step 10, v1.0.10

The recognition layer refines nine building groups around Bahnhof
Friedrichstraße and the Berliner Ensemble. All 52 committed source parts remain
in the source inventory. The main Ensemble theatre, its rotating sign, Brecht
and Helene Weigel installations, Tränenpalast and the station's curved double
Tudor train sheds and clinker entrance remain separate, unchanged models.
No tour place or boundary is added.

## Metric and identity evidence

`friedrichstrasseArchitectureSource.json` retains the original 52 public prism
records verbatim, their exact IDs, outlines, holes, ground levels and envelope
heights. The bounded [Geoportal LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5820.zip),
created 2 March 2026, supplies the three Admiralspalast parts' 205 original wall
and roof surfaces and each group's conservative facade eaves. Its archive hash
is recorded. The raw CityGML is not bundled. Other buildings keep their
existing body/roof meshes; their additions are thin exterior facade details.

| Building | Committed LoD2 parent / IDs | OSM identity |
| --- | --- | --- |
| Admiralspalast | `K00002ap`, `K00006mJ`, `K00002uV` | [way 43088667](https://www.openstreetmap.org/way/43088667) |
| SpreeDreieck | `DEBE01YYK000011x`, 2 parts | [way 43185522](https://www.openstreetmap.org/way/43185522) |
| Meliá Berlin | `DEBE01YYK00001cp`, 21 parts | [way 43173921](https://www.openstreetmap.org/way/43173921) |
| Schiffbauerdamm 5 | `DEBE01YYK0000BQ7` | [way 105347629](https://www.openstreetmap.org/way/105347629) |
| Schiffbauerdamm 6–7 | `DEBE01YYK00008ID`, 6 parts | [way 105347632](https://www.openstreetmap.org/way/105347632) |
| Schiffbauerdamm 8 / Koepjohann block | `DEBE01YYK0000592`, 11 parts | [relation 6288426](https://www.openstreetmap.org/relation/6288426) |
| Albrechtstraße riverfront | `DEBE01YYK0000Bcw`, 3 parts | [way 32399630](https://www.openstreetmap.org/way/32399630) |
| Schiffbauerdamm 12 | `DEBE01YYK000088z`, 3 parts | [way 32359480](https://www.openstreetmap.org/way/32359480) |
| Berliner Ensemble Neues Haus | `DEBE01YYK00001hf`, 2 parts | [way 104392614](https://www.openstreetmap.org/way/104392614) |

The Schiffbauerdamm 8 binding is checked against the address node
`4226497211`, Berliner Republik node `336384880` and Ständige Vertretung node
`332554285`; these occupy different wings of the same 11-part parent.
The rear service building at `DEBE01YYK0000Csz` is not assigned this identity.
Schiffbauerdamm 12 is independently checked against Zimt & Zucker node
`332625327`. The OSM roads stored alongside the profiles orient facade
selection; they are not added as duplicate roads.

## Architectural evidence and source conflicts

The [Landesdenkmalamt Admiralspalast record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065048)
documents Heinrich Schweitzer's 1910–11 complex, giant Doric granite
half-columns, Franz Naager's Istrian-limestone relief fields, the neo-Baroque
court and Ernst Westphal's Roman/Moorish Planckstraße facade. The
[restoration architect](https://www.reckersarchitekten.de/referenzen/kulturbauten/admiralspalast.html)
and [Deutsche Stiftung Denkmalschutz](https://www.denkmalschutz.de/denkmal/admiralspalast-friedrichstr-101-102.html)
provide restoration and ensemble context. The model differentiates the street
portico, five opening bays, segmental upper arches, pale relief registers,
open balcony rails, permanent entrance name, five flat-faced roof dormers and
cream/terracotta court. Relief figures are small procedural recognition marks,
not facsimiles. Current promotional artwork is absent.

The original public prisms reduce the three Admiralspalast parts to complex
flat envelopes. The added official planes recover the pitched roofs and open
court without discarding those prism records. Original CityGML surfaces are
translated vertically by 1.690 / 2.719 / 3.541 m respectively, solely to retain
each existing viewer ground datum. Their resulting maximum heights agree with
the delivered envelopes to decimetre rounding. These datum translations are
not changes to the measured building heights. Pedestrian roof support uses
the same sloping official planes. Facade and dormer dimensions are photo-based
display subdivisions, not additional survey measurements.

[Feldhaus](https://feldhaus.de/en/projekte/spree-dreieck/) documents the
SpreeDreieck's paired curved bodies, double element facade, curved glazing and
thin canopy; [Müller-BBM](https://www.mbbm-bso.com/de/projekt/?id=M66484)
identifies the ten-storey office building and double-skin sunshade system.
Its dark spandrels and continuous aluminium fins follow the actual retained
curved outline. Meliá uses the photographed pale stone courses, narrow dark
window frames and Juliet guards. Schiffbauerdamm 5 retains the pale plaster
and arched top-storey reading; numbers 6–8 retain separate plain and decorated
frontages, while number 12 uses the ochre facade and selected open balconies.
The [Berliner Ensemble](https://www.berliner-ensemble.de/node/386) identifies
the Neues Haus as the converted rehearsal/workshop building opened in 2019.
Its modest retained shell receives restrained window subdivisions; no
unverified interior is reconstructed. Ordinary facade bay pitches, floors
without a published count, local cornices, colours and railing sections remain
explicitly non-surveyed estimates.

## Performance, modes and verification

One static mesh carries the official Admiral planes. Two shared instanced
cube batches carry masonry/metal and opaque coloured glazing. Minecraft uses
two dedicated block batches, one-cell perimeter walls and roof tiles without
hidden volumetric infill. Its coarse source columns are removed only within
the three original Admiral footprints, retaining their height ownership.
The generic Minecraft window generator consults the existing source lookup's
exact `sourceIdAt` identity and omits its arbitrary grid only for these
52 dedicated facade parts. A two-column fixture taken from the actual payload
verifies that an unrelated neighbouring building retains its generic windows.
Facade projections account for nearby four-metre source cells; mobile keeps
the entire ensemble and all major structural features. Every material has
Day, Night and moonlit variants. Snowstorm remains governed by the existing
scene snow presentation; no additional texture or image asset is fetched.

| Profile | Draws | Instances | Rendered vertices | Geometry buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Smooth full | 3 | 18,862 | 454,182 | 1,487,944 |
| Smooth mobile | 3 | 15,532 | 374,262 | 1,234,864 |
| Minecraft full | 2 | 22,027 | 528,648 | 1,674,700 |
| Minecraft mobile | 2 | 18,681 | 448,344 | 1,420,404 |

A source bounding-box broad phase reduced measured factory construction from
roughly 400–500 ms to 85–110 ms in Bun during isolated local QA. This is a CPU
construction measurement, not a browser or phone frame-rate claim.

The focused test checks all 52 source records, the three exact replacement
IDs, maximum source heights, bounded geometry/material budgets, each family's
recognition features, actual exterior-pane raycasts against retained source
meshes and coarse Minecraft cells, sloping roof raycasts and the open court.
The separate street-front checks caught and corrected an initial facade-axis
reversal and alignment against a source half-column. Actual Three.js triangles
and instance matrices were also inspected with orthographic software renders,
including front, court, hotel and riverfront views; these are geometry QA,
not live browser screenshots.

## External visual references

The eight inspected Commons files below are attribution-only references.
Their authors and licences are mirrored in both public source manifests; no
photograph, crop, font, facade texture or current show poster is bundled.

- [Admiralspalast - Facciata esterna.jpg](https://commons.wikimedia.org/wiki/File:Admiralspalast_-_Facciata_esterna.jpg) — Matt Cec; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).

- [Berlin, Mitte, Friedrichstrasse, Admiralspalast 02.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Friedrichstrasse,_Admiralspalast_02.jpg) — Jörg Zägel; [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).

- [Admiralspalast - Cortile interno.jpg](https://commons.wikimedia.org/wiki/File:Admiralspalast_-_Cortile_interno.jpg) — Matt Cec; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).

- [Spreedreieck, Berlin-Mitte, 170117, ako.jpg](https://commons.wikimedia.org/wiki/File:Spreedreieck,_Berlin-Mitte,_170117,_ako.jpg) — Ansgar Koreng; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0).

- [Berlin-Mitte, Häuser Schiffbauerdamm 6-8.JPG](https://commons.wikimedia.org/wiki/File:Berlin-Mitte,_H%C3%A4user_Schiffbauerdamm_6-8.JPG) — Dguendel; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0).

- [20241030 xl 0722-Meliá Berlin.jpg](https://commons.wikimedia.org/wiki/File:20241030_xl_0722-Meli%C3%A1_Berlin.jpg) — Molgreen; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0).

- [141209 Schiffbauerdamm 12 Berlin-Mitte.jpg](https://commons.wikimedia.org/wiki/File:141209_Schiffbauerdamm_12_Berlin-Mitte.jpg) — Ansgar Koreng; [CC BY 3.0 de](https://creativecommons.org/licenses/by/3.0/de/deed.en).

- [Berlin, Mitte, Schiffbauerdamm 5, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Schiffbauerdamm_5,_Mietshaus.jpg) — Jörg Zägel; [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0).
