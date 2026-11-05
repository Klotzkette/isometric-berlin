# Treptowers, Arena Berlin and Badeschiff

Step 10 refines three existing waterfront sites in v1.0.198. The complete
Treptowers complex, Arena's former bus depot and Badeschiff remain separate
identities. Molecule Man's existing three figures and every unrelated owner stay
under their previous construction and source receipts.

## Sources and recognition

- [Priedemann, Treptowers](https://priedemann.net/de/projekte/projectdb/treptowers.html)
  documents its double-skin glass facade, stainless framing, masonry refurbishment,
  architects and approximately 125 m tower. The reference photographs show a
  dark stone base, tall narrow glazing, silver mullions and lower stone/glass
  office bars. Photographs are reference-only. The 2005 former-Allianz image is
  historical evidence of architecture. Its tenant advertising is not a current
  occupancy source.
- [IGP, Treptowers DRV](https://igp-muenchen.com/projects/ttd-treptowers-drv/)
  distinguishes the independently retained tower from the renovated lower
  ensemble, describing ten-storey bars, six-storey rows, stone facades and nine
  internal courts. The original 75 official leaves retain these different
  heights and openings.
- [Berlin's Treptowers account](https://www.berlin.de/sehenswuerdigkeiten/3559829-3558930-treptowers-und-molecule-man.html)
  identifies the 32-storey tower and the distinct 30 m Molecule Man.
- [Arena Berlin, Arena Halle](https://www.arena.berlin/veranstaltungsort/arena-halle/)
  establishes Eichenstraße 4, the 1927 Franz Ahrens bus depot, 6,500 m² hall,
  crosswise rooflights and glazed arched ends. The five original official leaves
  supply the roof, annexes and full measured walls. Six source-roof-fitted
  rooflight strips and arched fields clipped to measured gable walls are explicit
  recognition estimates.
- [Arena Berlin, Badeschiff](https://www.arena.berlin/veranstaltungsort/badeschiff/)
  identifies the floating barge, timber deck and designers AMP Arquitectos,
  Gilbert Wilk and Susanne Lorenz. Its operator gallery photographs, including
  the Markus Nass evening waterfront image, show the narrow blue pool, dark
  hull, projecting timber deck, metal railings and shore access.
- [visitBerlin, Badeschiff](https://www.visitberlin.de/en/badeschiff-der-arena)
  supplies the approximately 30 m barge and 2.05 m water depth. Retained OSM
  way [174099109](https://www.openstreetmap.org/way/174099109) supplies the exact
  267.46 m² pool ring. Way [45197923](https://www.openstreetmap.org/way/45197923)
  supplies the complete 523.01 m² timber platform, including its narrow landings
  and step-ins. The retained September 2026 Geofabrik extract is authoritative
  for those source courses.
- [Geoportal Berlin DOP 2025](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr?SERVICE=WMS&REQUEST=GetCapabilities)
  supplies reference alignment, courts, Arena rooflights and the short timber
  shore return. The checked EPSG:25833 image bounds are
  394850/5817100/395650/5817700. Layer `dop_2025` was used. Its short return from
  viewer point 5518.310/2498.259 to 5512.200/2510.600 and 3.6 m width are DOP-fitted
  display estimates. The last four short treads meet the retained 3 m bank datum.

All source photographs and orthophoto pixels remain in the ignored working
directory. The shipped scene uses procedural geometry and source notices.
Reference image hashes are retained in the versioned evidence.

## Complete geometry and height decisions

The original archives `LoD2_395_5817.zip` and `LoD2_394_5817.zip` supply all
75 Treptowers leaves and five Arena leaves, including every one of their 430
and 51 wall/roof sheets, millimetre coordinates, holes and source identifiers.
The complete sheets remain in `treptow-waterfront-v317-source.json.gz`.
The drawn model triangulates every sheet at the established centimetre storage
precision. Original source millimetres remain independently available.

The old parent `DEBE09YYP0000AJc` used its approximately 127.10 m maximum height
over the entire 24,411 m² envelope. The new model uses each original leaf's own
roof. `DEBE09YYP0000E8C` receives its complete Arena pitched roof and annexes.
The exact false 9 m `OSM-way-45197923` extrusion yields to its thin timber deck.

Each official family has one recorded rigid vertical datum fit to the existing
3 m scene ground, preserving all relative source elevations. These offsets are
display fits, not new terrain measurements. The tower's approximately 127.10 m
official envelope and published approximately 125 m architectural height differ.
The complete official envelope is retained. Unsurveyed glass subdivisions,
material tones, rail sections, water level, 0.40 m platform thickness, pool hull
depth and short landing steps are documented display estimates.

The native family independently samples the same complete roof/ground leaves on
a one-metre cardinal grid with half-metre height levels. Equal neighbouring
cells are merged losslessly into row runs, retaining courts and roof steps.
Source-clipped facade slot recipes generate the full estimated window inventory
in both families. Thin native members remain cardinal. Static source data and
geometry are constructed once per family, with no new frame loop or textures.

## Exact ownership and lifetime

Six immutable source packets are admitted lazily through the existing serial
loader. They are drawn/native `10_4`, `10_5` and `ring182-11_5`. Their original
wire SHA-256, all raw/prepared mesh fingerprints, full navigation and line
fingerprints bind the transaction. Exactly 525 drawn triangles, 185 roof-ink
segments and 2,596 native triangles belong to the three named old owners.
All other index words, vertices, paint, ink, navigation and packet bytes remain
unchanged. The complete outside difference of the retained source footprints is
included, including small source precision remnants.

`createTreptowWaterfrontV317(native)` constructs the whole required replacement.
`hasCompleteTreptowWaterfrontV317(root,native)` uses private identities, actual
buffer versions/storage, material provenance, poses and resource lifetimes.
Changed transforms, cloned roots and authored disposal close admission. Legal
GPU parking remains supported. `treptowWaterfrontV317Solids(native)` supplies the
same complete roofs and actual cardinal runs, including the pool, timber deck
and shore return. Root integration gates navigation and streamed owner removal
through the attached complete family.

The default loader keeps the old sources. Its explicit `treptow-v317` admission
rechecks the live gate before and after publication, evicts affected residents
on either gate transition and reloads the complete appropriate source. Unrelated
regions, all six modes, full drawn touch detail, existing tour stops and live
budgets use their established paths.

## Reproduction and checks

Run `uv run --no-sync python scripts/build_treptow_waterfront_v317.py` with the
retained source archives and raw source cache. This writes only the versioned
v317 derivatives and evidence. It reads the actual production predecessor
preparation path to obtain the exact raw/prepared guards.

Focused Python tests verify every original measured sheet, every immutable
packet SHA and identical cardinal navigation/body heights. Bun tests exercise
both complete factories, actual source decoders, every unchanged foreign
triangle/ink/nav component, failed source admission, material modes, disposal,
closed defaults and a real resident admission/revoke/reload cycle. The existing
lazy-recipe and northern-loading suites also pass.
