# Nikolaikirchplatz frontage corrections

V353 replaces the repetitive V169 window layers on 14 selected frontages of
8 existing LoD2 building families. It retains the measured house footprints,
wall planes, house roof positions and courtyards. A separately identified balcony strip receives an open structure and matching navigation. The correction uses
external photographs to distinguish the small reconstructed town houses from
the larger buildings around the quarter. It is not a new measured survey or a
claim that every Nikolaiviertel facade is complete.

| Existing source family | Selected frontages | Visible correction |
| --- | --- | --- |
| `DEBE01YYK00003ze` | Knoblauchhaus, square and curved Poststraße side | Three storeys, six square-facing and seven street-facing axes, blind upper bays, pale plaster, dark subdivided windows and abstracted running frieze |
| `DEBE01YYK00005JA` | House at the southern end of the photographed row | Three storeys and four axes; cream plaster and discrete cornices |
| `DEBE01YYK00007so` | Pink house facing the church | Three storeys, four axes and muted pink plaster |
| `DEBE01YYK00001s9` | Taller cream house and adjoining low library frontage | Different storey and bay rhythms, a dark upper dormer band on the low part |
| `DEBE01YYK0000B7V` | Broad, low cream house, photographed number 6 | Two full storeys, five axes and long upper dormer band |
| `DEBE01YYK0000BYA` | Narrow Lessing house and adjoining Paddenwirt frontage | Separate three- and five-axis rhythms; Lessing door panel, uninscribed plaque and small support brackets |
| `DEBE01YYK00009i8` | Zum Nußbaum, gable and long side | Small two-storey proportions, yellow banded base, dark shutters, upper gable openings |
| `DEBE01YYK00004FS` | Ephraim-Palais rounded corner and adjoining wings | Four storeys, three axes per selected frontage, pale pilaster relief and abstracted gilt balcony lattice |

Selected existing tiled-roof surfaces receive muted terracotta colours without
moving their vertices. The retained detailed Ephraim balcony and pilaster roles
are preserved. The older generic window surrounds and mismatched sill/lintel
positions are retired by exact source-triangle identity, rather than hidden
behind another opaque window grid.

## Source evidence and photographic interpretation

The [Berlin monument ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011266)
and [Knoblauchhaus record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011272)
supply building history and the distinction between historic and reconstructed
houses. Exact placement comes from the already retained Berlin LoD2 source
families, copied without alteration into the V353 source receipt.

The following photographs were inspected on 15 November 2026. They are external
reference evidence only: no photographic pixels are copied into meshes, textures,
the repository or the public viewer.

- [Museum Knoblauchhaus](https://www.berlin.museum/museum/knoblauchhaus), including
  its [exterior reference image](https://www.berlin.museum/wp-content/uploads/2025/07/museum-knoblauchhaus-bei-nacht.jpg).
  Publisher/rightsholder: Stiftung Stadtmuseum Berlin. The individual credit of
  this specific social-preview exterior image is not exposed with that image;
  the different interior photographs on the page have their own credits.
- [Nikolaiviertel association: Lessing, Mendelssohn and the town houses](https://berlin-nikolaiviertel.com/2024/09/lessing-mendelsohn-und-die-buergerhaeuser-am-nikolaikirchplatz/),
  dated 30 September 2024. Exterior references are
  [IMG_8613](https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8613.jpg),
  [IMG_8611](https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8611.jpg),
  [IMG_8612](https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8612.jpg)
  and [IMG_4201](https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_4201.jpg).
  Publisher: Nikolaiviertel e.V.; website VICAMEDIA UG. An individual photographer
  is not separately named beside these images.
- [Zum Nußbaum association page](https://berlin-nikolaiviertel.com/restaurants-berlin-nikolaiviertel/zum-nussbaum/),
  [IMG_5941 exterior](https://berlin-nikolaiviertel.com/wp-content/uploads/2023/11/zum-nussbaum-IMG_5941.jpg)
  and [IMG_5945 entrance detail](https://berlin-nikolaiviertel.com/wp-content/uploads/2023/11/zum-nussbaum-IMG_5945.jpg).
  Same publisher and unresolved individual photographic credit as above.
- [Museum Ephraim-Palais](https://www.berlin.museum/museum/ephraim-palais),
  [exterior DSC186350_1920px](https://www.berlin.museum/wp-content/uploads/2022/09/DSC186350_1920px.jpg).
  Credit: © Stadtmuseum Berlin, photograph Alexander Rentsch. The
  [museum history](https://www.berlin.museum/artikel/das-ephraim-palais)
  distinguishes the reconstructed original building from its former later extension.
- The [Senate ISEK, July 2021](https://www.berlin.de/sen/stadtentwicklung/_assets/quartiersentwicklung/foerderprogramme/lebendige-zentren-und-quartiere/be211101_isek_nikolaiviertel_endbericht_juli2021_barrierefrei_klein.pdf?ts=1758291378)
  provides quarter context, heights and public-space analysis. Proposed works
  are not interpreted as completed construction.

Window widths, depths, colours, frieze shapes and small fittings are authored
photographic estimates. The frieze and balcony lattice are simplified reliefs,
not faithful copies of sculpture. No new usable entrances or interiors are
claimed. The long upper bands represent photographed dormers on the retained
source envelope; separate dormer roof volumes, Nußbaum's two roof dormers and its
chimney have not been newly surveyed or rebuilt. The exact portal arch and
sculptural detail of Ephraim-Palais remain simplified.

The adjoining northern frontage around Nikolaikirchplatz 3 / Poststraße 21–22
was checked against the [monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011271).
Available oblique photographs did not establish a reliable individual
facade-to-source-part mapping. Its existing geometry is retained; V353 does not
claim a completed frontage reconstruction there. The church and Wappenbrunnen
have separate [church](nikolaikirche-v353.md) and [fountain](nikolai-fountain-v353.md)
implementations. No tree positions or proposed square paving were inferred.

## The separately mapped Ephraim balcony strip

Final street-level validation found a second source family, `DEBE00YYUf00009S`,
in front of the palace wall. Its 28.128 m² crescent-shaped LoD2 envelope represents
the projecting balcony strip. The old ordinary-house generator had extruded it
as a closed five-row apartment facade, concealing the palace windows and balcony
ornament. The museum photograph clearly shows open space between the stone
columns and the upper balcony rails.

The complete original strip family is archived separately in `balconySource`.
Its exact old shell/window triangles, source-outline segments and one full-height
collision record are retired. Three open balcony floor plates and an upper
cornice use the retained footprint, six ground-floor supports and open gold/dark
rails use photographed approximate dimensions. Native constructs an independent
quarter-metre cardinal footprint and square supports. Navigation contains only
the slabs and supports, so the space below and between balconies is open. The
existing ground and palace-body navigation remain unchanged. No entry into the
palace itself is added.

## Preservation and bounded loading

Five lazy recipes attach to existing `4_0` and `nikolai239-4_0` hosts in both
Drawn and Native, plus the existing Drawn outline companion
`4_0-alt-mitte-v169-1`. They total 387,919 compressed bytes.
No new residency controller, static descriptor or city-wide resident geometry
is introduced. All five host/mode keys contain nonempty replacement meshes and require
exact original/prepared mesh, navigation and line guards.

Native detail is clipped onto its actual cardinal predecessor wall surfaces.
When an old merged face extends beyond a corrected front, its complete outside
complement is re-emitted at its original position and original linear colour.
Area and plane checks cover those complements; Native is not a rounded copy of
the Drawn ornament. Raw original geometry stays archived. The two retirement
receipts preserve every replaced triangle's host, mesh, ordinal, owner, vertex
positions and colours. Unrelated indices, original position/colour words,
material hooks, unrelated navigation records and unrelated wire data survive the actual decoder. The balcony ink receipt retains each replaced original segment.

Retired triangle ordinals: Drawn main 1,397, Drawn fittings 1,587, Native main
2,502 and Native fittings 4,561. The Drawn companion retires only exact balcony source-outline segments and adds its physical upper cornice. Some Native index triplets are duplicates;
the production proof reports the smaller number of unique index triplets.

## Validation

- `uv run pytest -q tests/test_nikolai_quarter_v353.py`: 6 passed.
- `bun test tests/nikolai-quarter-v353.test.ts` from `src/app`: 2 passed,
  31 assertions; all five actual production-decoder predecessor/successor pairs. A real navigation probe verifies open space below and between balcony slabs, while the slabs themselves remain solid.
- `uv run ruff check scripts/build_nikolai_quarter_v353.py tests/test_nikolai_quarter_v353.py`: passed.
- `bun scripts/prove-nikolai-quarter-v353.ts <receipt-directory>` regenerates
  the production receipt from repository packets and the actual prior catalogue.
  Changed origins, missing replacement meshes, changed gzip sizes and wrong
  packet keys fail closed.

The quarter compiler is `scripts/build_nikolai_quarter_v353.py`. Its capture
input comes from `src/app/scripts/capture-nikolai-quarter-v353.ts`, using the
catalogue before both V353 quarter and church entries. Church guards are then
captured after the quarter. Final release screenshots and all-mode/mobile
checks belong to the enclosing V353 release evidence.
