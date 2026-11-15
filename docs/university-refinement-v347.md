# University exterior refinement V347

This is a finite additive pass over five existing owners. It does not replace
any previous source shell, façade row, roof, courtyard, campus ground,
navigation record, historic ornament or streamed owner. The older 18-campus,
485-leaf V322 coverage and the separate HU/FU/TU models remain complete.

| Existing owner | Added detail | Evidence and limits |
| --- | --- | --- |
| BHT Haus Grashof, `DEBE01YYK0003tI7` | Blue metal sash, transoms and concrete spandrel joints on previously bare measured walls, including the high parts above the podium | BHT's own exterior photographs. The old two-dimensional exposure union conservatively excluded these upper walls. The new finite extractor subtracts neighbouring leaf envelopes at their actual heights. |
| HU Adlershof Lise-Meitner-Haus, `DEBE09YYO0000JKS` | Glazing, translucent-glass ribs, rust-coloured screen posts, horizontal rails and sparse summer-green climbing vegetation on the documented south-east aspect | HU Physics photographs and retained OSM relation 1929493 establish identity. Every fitting remains within the retained measured sheet; openings and occluded regions stay clear. See the height limitation below. |
| HWR Schöneberg houses A/B, `DEBE07YY900008t1` and `DEBE07YY900007oD` | Paired-window transoms, projecting sills, stone courses and eave dentils on the photographed street elevations | HWR's campus gallery, photographs credited to Oana Popa-Costea. Other HWR buildings remain unchanged. |
| FU Henry-Ford-Bau, `DEBE06YYB0000Wkm` | Pale full-height pilaster segments and projecting heads on the Gary-Straße-facing fronts | FU's architectural description and exterior photograph explicitly identify the closely spaced vertical elements. No generic extra glazing or new room is inserted. |
| TU main northern slab, `DEBE3DrjkRIowu3J` | Fine aluminium spandrel fluting below the existing glazing bands | The existing V168 aluminium façade reference and measured wall planes are retained. Fine spacing is a display estimate, not a new metric survey. The current official TU photo page was unavailable during this pass; no new photographic verification is claimed. |

All small dimensions, colour choices and rhythm subdivisions are reference-guided
display estimates. No image, texture, remote picture dependency or shop/occupant
detail is included in the viewer.

## Source-height limitation at HU Physics

The raw official LoD2 archive itself gives the broad main leaf
`DEBE3DNx5J2uyOEc` a height of only 3m. It has four direct leaf parts and no omitted
ancestor surface. The mapped physics footprint matches the retained family;
the official photographs show more upper glazing than this low source envelope.
This pass preserves that source and does **not** claim to correct the complete
height of the physics building. It adds only façade details supported by the
existing surface. A future height correction requires a separately evidenced
replacement and corresponding roof/navigation transfer.

## Models intentionally preserved

- HU main palace already has the complete V168 95-boundary model, 17-axis
  front, Corinthian columns, roof figures, cornices and gateway. HU Campus Nord
  V266 and Grimm/Hegelplatz V322 remain intact.
- FU Rostlaube, Silberlaube and Philological Library V187, Holzlaube V322 and
  the complete Henry-Ford shell remain intact.
- TU main historic wings, Audimax, courtyards and all 24 TU/VWS parts remain
  intact. This exterior pass does not imply an interior or a change to building
  access during the reported 2026 main-building closure.
- BHT's other measured houses, HWR Lichtenberg and all other V322 colleges keep
  their existing complete geometry and detailing. Proposed future BHT campus
  redevelopment is not depicted as an already built condition.

## Runtime and preservation

The V322 refinement is appended to each site's existing frame/glazing arrays
**before** the current batches and private completeness receipt are created.
There are still 36 Drawn fitting batches and 58 Native source/fitting batches.
The original 95,310 Drawn and 242,548 Native instances remain exact prefixes;
V347 adds 9,820 and 5,151 instances respectively. TU remains two batches in each
branch and adds 1,706 Drawn / 1,717 Native fittings. Its audited totals are
4,219,456 Drawn bytes and 4,991,912 Native bytes, below the existing unchanged
4.3MB/5.3MB test bounds.

Native fittings use their existing independently generated cardinal campus
faces; TU Native faces are extracted from the original independent 1m source
skin. Native is not obtained by rotating or voxelising the new Drawn fittings.
The same complete data and matrices are used on touch and desktop. Generators
yield every 64 fitting records. There is no new draw call, texture or live chunk
budget, and no new coverage deletion.

The 136,494-byte finite fitting input is frozen after its private control hash
is verified. Invalid input cannot authorize source retirement. New V322
instances participate in the existing backing-buffer, transform, material,
parking and disposal receipt. Baseline matrix/colour hashes captured from the
unmodified `84d3c452` factories prove that every old batch prefix remains exact.

## References checked 2026-11-15

- BHT campus/Haus Grashof: <https://www.bht-berlin.de/121/page/1>;
  exterior images <https://www.bht-berlin.de/fileadmin/images/campus/gebaeude/grashof_1.jpg>
  and <https://www.bht-berlin.de/fileadmin/images/campus/gebaeude/grashof_3.jpg>.
  Current building works: <https://www.bht-berlin.de/2689>.
- HU Physics architectural/photo page:
  <https://www.physik.hu-berlin.de/de/institut/ueber/lise-meitner-haus/das-institutsgebaeude>.
  Photographs Birgit Gilsenbach: `img_4435-2a.jpg` (south-east) and
  `img_4229_1a.jpg` (north-west), linked by that page.
- HWR current campus gallery:
  <https://www.hwr-berlin.de/studium/studieren-an-der-hwr-berlin/ins-studium-starten>.
  Photographs `02_2020-06-04_CS_065` and `14_2020-06-04_CS_005`, Oana Popa-Costea.
- FU Henry-Ford architectural account:
  <https://www.fu-berlin.de/presse/publikationen/tsp/archiv/2007/ts_20070416/ts_20070416_11.html>.
  Exterior photograph linked as `img/11.jpg`; credited on the source page to
  Reinhard Görner / Florian Bolk / Bernd Wannenmacher.
- TU measured model and previously verified exterior references:
  `tuWaterV168Evidence.json`; main façade photograph Gunnar Klack, CC BY-SA 4.0,
  <https://commons.wikimedia.org/wiki/File:Technische-Universitaet-Hauptgebaeude-Berlin-Charlottenburg-06-2017.jpg>.
  Current main-building status: <https://www.tu.berlin/themen/schliessung-hauptgebaeude-2026>.
- Official LoD2 source identities, archive hashes, source datums and retained
  OSM geometries: `universities-v322-source.json.gz` and its original audit.

Reproduce finite profiles with `uv run python scripts/build_university_refinement_v347.py`.
The isolated targeted run of `university-refinement-v347`, `universities-v322`,
`tu-water-v168` and `humboldt-main-v168` passed all 18 tests. The compiler passes
Ruff and its output reproduces exactly. Two broader unchanged harnesses were
also attempted: `universities-government-v322` lacked the existing V345
`nordbahnhof` constructor binding in its generated fixture, and
`universities-packets-v322` reported 0 rather than 97 expected source-quarter
triangles under its older ownership flags. Those are reported separately to the
release integrator; this subtask does not claim that they passed. No public build
or publication is performed by this subtask.
