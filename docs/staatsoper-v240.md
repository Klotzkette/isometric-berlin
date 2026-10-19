# Staatsoper Unter den Linden v240

This finite recognition refinement retains the complete existing opera body and
its measured roof hierarchy. The six-column northern portico, pediment,
architrave inscription, large side windows with triangular caps, attic and base
windows, pilasters, balustrades, lateral columns and small sculptural silhouettes
make the building recognizable from Unter den Linden and Bebelplatz. All mobile
devices receive the same drawn geometry. Native fittings are built independently
as orthogonal blocks, including a stepped pediment and block column order.

## Sources and limits

- [Landesdenkmalamt, monument 09095952](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095952): Knobelsdorff's monumental portico, Palladian composition, the Apollo/Muses inscription, main and rear pediment reliefs, later stage and lateral additions, and the sculptural programme.
- [Landesdenkmalamt, Staatsoper reference photograph](https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2022/einladung-staatsoper-unter-den-linden-1215421.php): photograph by Wolfgang Bittner, 2009, used to read the six-column frontage, side openings, capitals and balustrades. The photograph is reference-only and is not packaged.
- [Staatsoper, 2010–2017 restoration](https://www.staatsoper-berlin.de/de/staatsoper/unter-den-linden/sanierung/): the exterior form was preserved from pedestrian viewpoints. The existing measured envelope remains authoritative.
- Retained official Berlin LoD2 parent families `DEBE01YYK0000Bw5` (11 leaf parts) and `DEBE00YY1P700099` (one low part), in `alt-mitte-v169/source-391_5819-00.json.gz`. The main auditorium's measured roof is y=26.055–33.678; the taller stage reaches y=41.115. The two low front solids at y=10.829 and y=8.2 remain as source geometry.

Window divisions, fitting depths and heights, colours, Corinthian capital
abstractions and simplified human silhouettes are display estimates based on
the primary references. They are not a measured facade survey or reproduction
of individual sculptures. The existing v169 vertical display transform remains
unchanged. The v182 measured edges also retain their own original datum.

## Exact ownership

Legacy prism `15976892` already belongs to the complete v169 source replacement;
no additional prism or navigation suppression is introduced here. All 408 drawn
source-shell triangles, all twelve source parts, their roof sheets and existing
navigation remain with v169. All 282 measured v182 opera edge segments remain.

Only earlier generic facade recipes yield:

| Original layer | Exact transfer |
| --- | ---: |
| Streamed `3_0` drawn v169 window layer | 3,816 triangles |
| Resident native `3_0-piece-0` full-minus-shell faces | 2,789 triangles |
| Native shell-minus-full faces restored with v240 | 219 triangles |
| v182 generic window boxes | 220 rows |
| v182 generic window edge segments | 440 rows |

The source native model was created from the shell and old windows together.
Removing a whole source owner would lose walls and roofs. Instead the generator
reproduces the exact prior recipe and computes both set differences. The
retained full model, minus the 2,789 obsolete faces, plus 219 restored faces,
equals the original native shell exactly, before the new fittings are added.
The lower parent has no old facade and loses no triangles.

Immutable packet SHA-256 hashes, encoded-array fingerprints, triangle indices,
exact v182 row values, and hashes of every untouched triangle sequence are in
`staatsoper-v240-evidence.json` and `staatsoperV240Previous.json`. Changed bytes
fail open. Source ink, other owners and navigation are not filtered. Default
standalone factories retain the old facade; production explicitly enables
`staatsoperV240` only in a construction transaction that requires the new model.

## Budget and construction

| New required mode | Vertices | Triangles | Indices |
| --- | ---: | ---: | ---: |
| Drawn | 52,195 | 38,433 | 115,299 |
| Native, including shell restoration | 36,883 | 55,119 | 165,357 |

Each mode uses one texture-free mesh and stays below 65,536 vertices. The packed
two-mode data is approximately 0.61 MiB gzip. There are 218 individually framed
replacement windows rather than a generic repeated floor grid. Native fittings
sit outside the conservative extent of the existing two-metre source cells;
the previously used one-metre-skin offset would bury some frames. No global
residency, prefetch or packet limit changes are needed.

`addStaatsoperV240` participates in the existing cancellable required-site
construction. `drawn` and `minecraft` are independent weak construction fields;
the receipt's `records`, `boxes` and `segments` are likewise constructor-only.
Roots retain no source arrays or receipt maps. The optional transfer flag does
not change a shared decoded-source cache.

## Verification

`tests/test_staatsoper_v240.py` checks immutable sources, the raw LoD2 origin of
all surviving v182 measured edges, exact native shell set equality, bounded
orthogonal native geometry and untouched packet triangle sequences.
`src/app/tests/staatsoper-v240.test.ts` checks exact transfer, changed-byte
fail-open behavior, original-row guards, standalone versus opted-in construction,
both required modes and cancellation before publication. Paired local rendered
previews compare the old and new model with the full measured body; they are
ignored research artifacts, not production assets.

A useful northern-portico/west-side camera is position `[1470, 100, 155]`, target
`[1575, 21, 279]`, y-up, parallel scale 65. The broader building centre is near
`[1575.3, 20, 284.3]`.
