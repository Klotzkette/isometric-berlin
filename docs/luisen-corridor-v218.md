# Luisen corridor street-front refinement — v218 / step 10

This bounded pass changes four existing exterior facade edges only. It leaves
all 120 LoD2 parts, source vertices/holes, heights, roofs, 65 road axes, courtyard
facades and dedicated theatre/foundation/Palast owners intact. It adds no scene
root, runtime fetch, texture, coverage, tour stop or resident-budget allowance.

## Exact ownership and interpretation

| Street front | Retained source edge start, metres | Refinement |
| --- | --- | --- |
| Reinhardtstraße 19, main front | `12KXkIon`, `(880.5,-464.2)` | Eight axes, fifth-axis panelled entry, shallow segmented lintel, restrained horizontal courses and base joints |
| Reinhardtstraße 19, adjoining front part | `pg7QUvEX`, `(901.2,-469.2)` | Two further axes, aligned with the main front's three upper window rows |
| Luisenstraße side of the Schumannstraße 19 corner | `JtV0i0Yb`, `(565.1,-511.4)` | Taller upper corner glazing, pale metal posts/spandrels, separate balcony handrails |
| Schumannstraße side of the same corner | `JtV0i0Yb`, `(594.1,-518.3)` | Matching return of the corner glazing and balcony frames |

The two Reinhardt edges contain ten photographed axes in total. The prior
generic historic family gave nine drawn axes, six native axes and decorative
individual cornices/dentils not present on this plain front. Only this precisely
selected generic interpretation yields to the more specific photographed one.
The first ground-floor bay is a narrow window; the middle portal has two leaves.
The original facade material and source roof remain unchanged. Storey subdivision
aligns both parts using the existing main facade eaves datum `24.10020489337258`;
each measured part's own eaves/roof geometry is still retained.

The corner-building refinement retains all existing balconies, bowed fronts,
perforations and cladding seams. It makes the upper two-sided metal/glass bay
read separately from the adjacent stone-clad balcony facade. It does not invent
new projecting structural bodies or raise anything above the source envelope.

## Evidence verified 16 October 2026

- Landesdenkmalamt Berlin, [Reinhardtstraße 19, object 09095888](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095888):
  identifies the residential house and its approximate 1840 construction date.
  The [Friedrich-Wilhelm-Stadt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095859%2CT)
  supplies the broader historical context, not an opening survey.
- [Berlin, Mitte, Reinhardtstrasse 19, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Reinhardtstrasse_19,_Mietshaus.jpg),
  **Jörg Zägel**, photographed **25 April 2010**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  Commons page ID `10151507`; original image SHA-1
  `bfee16629aebbb35e49e9494575f3e251605a531`. Its inspected 1280px reference
  shows ten aligned upper axes, three upper rows, the panelled entry and base
  rustication. This is a newly used visual reference and requires the same
  per-file credit in both packaged/source Wikimedia manifests.
- [Wohn- und Geschäftshaus Luisenstraße 48-49 — Schumannstraße 19 (1).jpg](https://commons.wikimedia.org/wiki/File:Wohn-_und_Gesch%C3%A4ftshaus_Luisenstra%C3%9Fe_48-49_%E2%80%94_Schumannstra%C3%9Fe_19_(1).jpg),
  **Андрей Романенко**, photographed **6 June 2012**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Commons page ID `141649774`. The inspected 1280px reference shows the corner's
  pale metal/glass bay, grey cladding and bowed perforated metal balconies.
  This file was already credited in the corridor reference manifest.
- [Reinhardtstraße Berlin-Mitte 2024-05-09 01.jpg](https://commons.wikimedia.org/wiki/File:Reinhardtstra%C3%9Fe_Berlin-Mitte_2024-05-09_01.jpg),
  **Leonhard Lenz**, **9 May 2024**, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
  The inspected street perspective checks the contrast between the older
  window rows and modern adjoining stone grids. Its distant detail is not used
  to assert additional individual openings; its existing credit is retained.

Photographs remain external visual references; no pixels, crops or textures are
shipped. The old images establish architectural form, not present tenants,
signage or a guarantee of unchanged 2026 openings. Window widths, vertical spacing,
door dimensions, joint depth, lintel rise, metal thickness and source-edge-to-bay
allocation are procedural proportional estimates. LoD2 remains the metric
envelope. The rectangular native lintel is a deliberate block interpretation.

## Validation and frozen storage

The facade model still has two instanced draw calls sharing one 24-vertex cube.
Pointer and touch geometry are byte-for-byte equivalent within each mode family.

| Family | Instances | Geometry / instance array bytes | Existing ceiling |
| --- | ---: | ---: | ---: |
| Drawn | 24,015 | 1,825,788 | 1,840,000 |
| Native blocks | 11,295 | 859,068 | 860,000 |

Focused tests cover exact source preservation, all 25 facade families, actual
pane visibility against drawn walls/native cells, shared native clearance,
ten aligned window axes, one portal, exact edge scope, mobile equality and the
unchanged byte ceilings. Existing historical count snapshots are updated; the
former v1.0.6 budget table in `luisen-corridor-refinement.md` is historical.
