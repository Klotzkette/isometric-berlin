# Unter den Linden and the eastern centre: finite v315 facade details

This addition completes three previously generic or deferred facades on existing
official building owners. It does not rebuild the complete Brandenburg Gate–Rotes
Rathaus corridor, change its coverage, or replace earlier landmark work.

| Site | Retained official family | Complete source sheets | Added recognition |
| --- | --- | ---: | --- |
| Komische Oper functional building, Unter den Linden 41 | `DEBE01YYK0000EHH` | 17 | Five-storey framed curtain wall, shallow spandrels and the asymmetric open-cell screen |
| Hackesches Quartier, Henriette-Herz-Platz 3 | `DEBE01YYK00007QE` | 292 in three parts | Pale diagonal exterior members and glass/floor-band rhythm following 24 measured walls of the rounded north/west corner |
| Former Mohrenstraße 67–69 | `DEBE01YYK000074x` | 51 | Thin panel joints on nine measured east-facing folds; existing glazing, projecting bays and roof geometry remain |

The old Linden corridor v197 profile explicitly deferred Unter den Linden 39/41.
The other named avenue buildings, DomAquarée v288, Hackesche Höfe/station v163,
Schwalbennest v288 and the earlier west-facing Wilhelmstraße estate details are
retained. The rounded Hackesches Quartier office is a separate building south of
the station, rather than an additional treatment of DomAquarée.

## Primary references and mapped identity

- The [Komische Oper's current letting page](https://www.komische-oper-berlin.de/entdecken/sanierung/vermietung-funktionsgebaeude/)
  identifies the listed 1966 functional building at Unter den Linden 41. Its
  [north elevation](https://kob-6a25.kxcdn.com/images/988d8eb49e6c7126424539bf9ea33848/9884/1501_funktionsgebaeude_nordansicht.jpg)
  establishes the framed glazing and open-cell screen. This is an architectural
  elevation, not a claim of a new colour survey. The mapped footprint is
  [OSM way 32699536](https://www.openstreetmap.org/way/32699536).
- [Grüntuch Ernst's project account and photographs](https://gruentuchernst.de/projekte/p207/)
  identify Henriette-Herz-Platz 3, completion in 2011, the rounded corner,
  diagonal external structure, 1.35 m planning grid and two recessed upper
  storeys. The existing measured setbacks stay intact. The photographs are
  credited by the architect to Stefan Müller, Markus Löffelhardt,
  euroluftbild.de/Grahn and Grüntuch Ernst. The mapped address is
  [OSM node 1812519826](https://www.openstreetmap.org/node/1812519826).
- The [Landesdenkmalamt's full 2021 explanation](https://www.berlin.de/sen/stadtentwicklung/denkmal/landesdenkmalamt/erklaerungsbogen_wohnquartier.pdf),
  page 1, explicitly lists Mohrenstraße 67–69 in the 1987–1992 Wilhelmstraße
  estate. Its discussion of WBS 70 panels, folded projecting bays and loggias
  grounds this treatment; see also the
  [Senate's heritage announcement](https://www.berlin.de/sen/kultgz/aktuelles/pressemitteilungen/2021/pressemitteilung.1127865.php).
  The exact address nodes are [67](https://www.openstreetmap.org/node/1552578824),
  [68](https://www.openstreetmap.org/node/1552579168) and
  [69](https://www.openstreetmap.org/node/1552579581).
- The street has been called Anton-Wilhelm-Amo-Straße since 23 August 2025,
  as stated by the [district's announcement](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2025/pressemitteilung.1591600.php).
  The historic name above resolves the owner's request and the heritage record.

Address matching uses the retained 29 September 2026 OSM snapshot. Metric wall
planes, heights, complete family parts, courtyards and setbacks are the retained
Berlin LoD2 sources `source-390_5819-00.json.gz` and
`source-391_5820-00.json.gz`. All three families are active in both Alt-Mitte v169
catalogues. Actual delivered pieces on both sides of the x=1024 tile seam prove
the whole 68.42 m functional-building frontage; the canonical core prism is not
mistaken for a still-active fallback.

## Geometry, limits and verification

`createLindenEastContextV315(native = false)` creates static decoration only.
There is no source retirement, terrain adjustment, roof, new walking support,
door opening, photograph, texture, sign claim or animation. New shallow members
are fitted outside retained surfaces. The native form has independently fitted
cardinal members on actual delivered wall planes and original bounded 4 m
columns. A member without a complete supporting exterior rectangle is omitted;
the source city remains. This prevents a rotated drawn fitting from floating
through the voxel stair or being buried in an older core column.

Window/floor spacing, member sections, diagonal slope and muted material colours
are architectural display estimates. They are not measured facade surveys.
The implementation concentrates on recognisable attributes at the three named
sites and does not claim a photographic reconstruction of every building along
the full corridor.

The runtime has 983 drawn instances plus 168 thin diagonal quads in four
renderables, or 3,395 native instances in three renderables. Geometry buffers are
below 110 kB drawn and 270 kB native. Both modes retain all static detail on touch
devices. Roots own separate disposable resources.

The 42,013-byte runtime JSON uses the existing synchronous gzip/base85 reader.
Its complete 190,936-byte recipe and every Float32 word round-trip unchanged;
this is transport compression, not a resolution reduction. Complete source
families, exact current input pins, native supporting rectangles and column
clearances are retained in
`geo_data/regierungsviertel/linden-east-context-v315-evidence.json.gz`.

Regenerate with `uv run --no-sync python -m scripts.build_linden_east_context_v315`.
Targeted Python tests verify all 23 current input files, full family retention,
delivered wall coverage, native exterior fits and compression. Bun tests verify
exact recipe bytes, independent resources, cardinal native matrices and buffer
budgets.
