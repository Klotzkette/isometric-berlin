# Bounded building relief — step 10, v1.0.37

This pass refines existing facades around Friedrichstraße, Deutsches Theater,
the historic Charité entrance and Potsdamer Platz. It adds no building, window,
storey, entrance, footprint, roof or tour stop. All existing source IDs, heights,
opening layouts and courtyard holes remain intact. Existing ordinary-building
axes remain diagrammatic; they do not become an invented grid of panes.

## Source evidence and concrete changes

- **Schiffbauerdamm 8:** the existing facade ownership remains the eleven parts
  of `DEBE01YYK0000592`, OSM relation `6288426`. The already-authored balconies
  now have pale stone top/bottom courses and open balusters, matching the
  balustrade material seen in the retained reference, instead of only a generic
  dark railing. No balcony or opening is added. Four spindles per existing bay
  and their local dimensions are bounded display subdivisions, not a survey.
- **Deutsches Theater / Kammerspiele:** the ten existing courtyard arches gain
  two shallow masonry jamb returns each. Their opening dimensions, frame planes,
  placement and retained 27 LoD2 parts remain unchanged. The 0.27 m return depth
  is a display fit. It makes the existing framed opening read as construction
  rather than a single flat patch; central glazing remains unobstructed.
- **Friedrich-Althoff-Haus:** only the verified street edge of part `50yMshCk`
  gains the pale plaster register below the eaves and seven red-brick ogee
  crowns above the existing seven paired upper windows. The existing facade
  layout, three storeys, blind opening and four dormers remain unchanged.
  Local crown curves and the band's 1.32 m height are display fits to the
  retained photograph. Minecraft uses the same band and stepped crowns in its
  existing single facade/roof batch. No separate smooth facade is shown there.
- **Kollhoff Tower:** its architect explicitly describes deep clinker piers in
  front of the spandrels. The existing 4,368 window instances keep their exact
  matrices and apertures but share a small coloured construction prototype:
  recessed blue-grey pane, dark clinker returns, pale sill and red-brown outer
  edges. A 0.18 m shallow projection is a display abstraction of that depth,
  not a newly measured facade dimension. There is no second pane grid or new
  draw call. The existing Minecraft tower facade remains block-native.

Primary architectural evidence:

- [Landesdenkmalamt, Gesamtanlage Charité](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011080)
  identifies granite bases, light red facing brick, plaster fields, sandstone
  dressings and slate roofs. The distinctive upper plaster/brick treatment is
  restricted to the photographed Althoff elevation rather than generalized to
  every campus building.
- [Hans Kollhoff, DaimlerChrysler building at Potsdamer Platz](https://www.kollhoff.de/de/PROJEKTE/Bauten/73/DaimlerChrysler-Gebaeude-am-Potsdamer-Platz.html)
  explains the change from horizontal base bands to projecting vertical tower
  piers. This supports the material/depth reading; it does not establish our
  local reveal dimensions.

The following **existing, already packaged credits** were re-inspected. No new
photograph, crop, texture, font, image asset or runtime image request is added:

| Retained external reference | Author / licence | Used here |
| --- | --- | --- |
| [Berlin-Mitte, Häuser Schiffbauerdamm 6-8.JPG](https://commons.wikimedia.org/wiki/File:Berlin-Mitte,_H%C3%A4user_Schiffbauerdamm_6-8.JPG) | Dguendel, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Pale open stone balcony construction at number 8 |
| [Deutsches Theater Berlin 2024-05-09 03.jpg](https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_03.jpg) | Leonhard Lenz, [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Existing courtyard arch surrounds and jambs |
| [Friedrich-Althoff-Haus Charité Campus Mitte 2024-05-09 01.jpg](https://commons.wikimedia.org/wiki/File:Friedrich-Althoff-Haus_Charit%C3%A9_Campus_Mitte_2024-05-09_01.jpg) | Leonhard Lenz, [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | Upper pale plaster band and paired-opening brick crowns |

These dated views do not establish a new September 2026 condition survey.
Previous source contracts remain applicable:
[Friedrichstraße](friedrichstrasse-architecture-refinement.md),
[theatre](deutsches-theater-refinement.md),
[Charité](historic-charite-refinement.md) and
[Potsdamer panorama](potsdamer-panorama.md).

## Ordinary neighbours

The existing v1.0.35 material/colour treatment previously stopped west of much
of Friedrichstraße. Its display scope now also includes world rectangle
`x=620..1280, z=-660..65`. Both colour selection and the existing facade-ink
shader derive their scope from that same list. The rectangle is a display
limit, not an administrative boundary or new source geometry.

It contains 1,206 retained source parts, of which 820 were outside the previous
scope; 302 have an accepted existing OSM attribute match, including 203 of the
newly included parts. Nine parts in the rectangle carry an explicit facade
colour. These are part counts, including small roof/annex pieces, not houses.
The retained source's mapped materials/colours remain distinct from the
illustrative fallback palette. Authored building palettes keep priority.
No new colour is claimed to be a photographic measurement and no floor count
or window position is inferred by this scope change.

## Cost and validation

The three detailed facade groups keep all existing draw counts. Current local
buffer costs, including shared geometry and instance buffers, are:

| Group | Drawn full / mobile bytes | Minecraft full / mobile bytes | Draws drawn / Minecraft |
| --- | ---: | ---: | ---: |
| Friedrichstraße | 1,504,664 / 1,251,584 | 1,699,324 / 1,445,028 | 3 / 2 |
| Theatre | 363,898 / 255,186 | 256,008 / 251,752 | 4 / 1 |
| Historic Charité | 2,460,072 / 2,145,420 | 553,016 / 350,020 | 5 / 1 |

Kollhoff's shared prototype stores only **54 vertices / 1,944 bytes**, replacing
the prior 4-vertex / 140-byte indexed plane. The unchanged 4,368-instance batch
therefore adds **1,804 stored bytes** and renders 235,872 prototype vertices.
This adds local triangles, not another batch or per-instance allocation.

This bounded facade pass adds **387 shallow Minecraft pieces / 29,412 bytes**
in each profile: 324 Schiffbauerdamm balustrade pieces, 20 theatre jambs and
43 Althoff band/crown pieces. The palette extension adds no geometry.
The final integrated world additionally includes the separate Schloss/Naturkunde,
Dussmann and Spree-railing work; its measured totals are:

| Profile | Instances | Renderables | Buffer bytes | Local synchronous build |
| --- | ---: | ---: | ---: | ---: |
| Full | 3,822,717 | 108 | 291,537,733 | 4.88 s |
| Mobile | 1,036,617 | 106 | 79,344,677 | 3.88 s |

The synchronous signatures were independently measured with
`scripts/benchmark-minecraft-world.ts` and then passed the cooperative
construction comparison. These are local Bun construction measurements,
not browser frame rates or physical-phone benchmarks.

The new six-test relief suite raycasts the actual Kollhoff triangles, checks
unchanged apertures, finite geometry and source immutability, verifies all
four theatre/Schiffbauerdamm profiles and the seven Althoff crowns, and checks
the palette/ink scope agreement. The existing 39 architecture tests pass,
including real retained LoD2/voxel occlusion rays and explicit geometry budgets.
The final integrated cooperative-construction comparison passes all four tests
and 16 assertions in 12.53 seconds, matching the independently measured
synchronous hashes and every instance capacity, colour buffer and draw count.
The broader city/fade suites pass 101 tests and 1,212 assertions. Althoff's
actual triangles and instance matrices were also inspected in drawn and
Minecraft orthographic software views. This checks the band/crown relation
and does not replace the separate browser and device checks.
The final crown alignment was followed by a fresh 25-test run covering Charité,
relief and palette (29,146 assertions), plus TypeScript and diff checks.

No canonical geodata or attribution manifest is changed by this pass. Existing
OSM, Geoportal Berlin and the three per-file visual-reference credits apply.
