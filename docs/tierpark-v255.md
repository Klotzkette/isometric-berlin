# Step 10 — Tierpark Friedrichsfelde, v1.0.155

This bounded companion refines the existing eastern Tierpark, distinct from
Zoo Berlin in the west. It preserves every v187 source building, measured roof,
enclosure, barrier, watercourse and path. No coverage, tour stop, texture,
loader, animation or resident-budget increase is introduced.

The three existing complete official building owners remain authoritative:
Schloss Friedrichsfelde (`DEBE11YYI00009hE`, OSM `way/11269749`), Alfred-Brehm-Haus
(`DEBE11YYI0000Nxm`, `way/11269594`) and Giraffenhaus (`DEBE11YYI0000GSB`,
`way/11643292`). The 160 previously authored, source-face-bound openings gain
narrow pale frames, mullions and transoms. Their positions, prior panes and sills
remain intact. Native openings have a separate orthogonal interpretation on the
existing block facade exterior; no smooth frame double is loaded.

Sixteen exact retained OSM garden polygons include the palace's formal beds,
Karl-Foerster-Garten and the garden near Alfred-Brehm-Haus. Distinct low green
borders and inner lawn colour make these mapped divisions legible. The full
source outlines and holes are frozen; visible garden complements subtract
mapped paths with conservative width clearances, water, animal enclosures,
OSM buildings and every delivered LoD2 building. The owl enclosure, although
OSM tags it as a garden, is excluded. Native garden pixels are independently
contained orthogonal runs. The low layers are at y=3.06/3.08 above the retained
y=3 outline ground; these are display separation, not new surveyed relief.

Four actual tagged devices at the south playground receive compact static
recognition: swing `5826913162`, climbing structures `5826913164` and
`5826913177`, basket swing `5826913170`. Their OSM node anchors are unchanged.
Dimensions, orientations and member subdivisions are display estimates, not a
playground equipment survey. Granular timber/rung collision follows the visible
members, leaving the open frames and routes free. Native members are separately
sized on an eighth-metre display grid. All four stand on independently checked
retained y=3 source ground.

The Fabelwald trampoline node `11804233493` is retained in the source inventory
but deferred: it intersects the delivered LoD2 parent `DEBE11YYI0002EnN`, whose
existing upper surface is y=17.96. This is recorded for both families. Nothing
is placed invisibly beneath that roof, and the measured parent is preserved.
No speculative current elephant house or future masterplan geometry is inferred.

## Primary sources and licensing

The unchanged 29 September 2026 OSM extract supplies coordinates, complete rings,
named identities and equipment types (ODbL-1.0). Retained Berlin LoD2 supplies
all metric building envelopes (dl-de/zero-2-0). SHA-256 receipts cover the old
source/east runtime/navigation files and every original affected tile.

Checked 20 October 2026:

- [Tierpark visitor map](https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan): current named areas. The protected plan is neither traced nor bundled.
- [Operator history](https://www.tierpark-berlin.de/de/ueber-uns/historie): palace landscape, 1963 Alfred-Brehm-Haus and later Giraffenhaus.
- [Regenwaldhaus](https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus): the existing Alfred-Brehm-Haus and its renovated rainforest identity.
- [Schloss operator account](https://www.schloss-friedrichsfelde.de/das-schloss): the early classical palace exterior and historical building identity.
- [Fabelwald](https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/fabelwald) and [2016 opening account](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/zwei-auf-einen-streich): distinct woodland and water playgrounds.
- [Designer account](https://danpearlman.com/news/auf-die-plaetze-fertig-los/): retained sand-area equipment and the two playground projects. No proprietary plan or photograph is redistributed.

Small frame dimensions, garden colours and inner-border widths, and play-member
sizes/orientations are explicit presentation estimates. The existing flat ground
datum is preserved and is not misrepresented as a newly measured DGM survey.

## Delivery and validation

`TierparkV255.prepareTierparkV255` appends one packed mesh to each of five existing
512 m tiles in each family. It checks packet identity, ground fingerprint, exact
origin and datum, and yields before publication. Existing packet decode/upload,
cancellation, GPU retirement and disposal own the additions. Only narrow play
solids extend navigation; original geometry, navigation arrays and lines retain
their complete prefixes. There is no monolithic park scene or device-dependent
reduction of drawn quality.

Tierpark preparation runs in the streaming caller, leaving the shared geometry
decoder unchanged. Its constructor-only packet index has a pure initializer.
The final production worker is 14,214,442 JavaScript bytes, below the unchanged
16 MiB ceiling; unused Tierpark and Alt-Mitte construction data is absent.
A regression checks this unused-import boundary; rendering still decodes all
ten original family packets with identical geometry. The locally retained
ground-receipt hash is tested against the existing shared implementation.

Reproduce with:

```sh
uv run python -m scripts.build_tierpark_v255 --extract
uv run pytest tests/test_tierpark_v255.py -q
cd src/app && bun test ./tests/tierpark-v255.test.ts
```

Python checks verify immutable previous bytes, garden/path/water/building
separation, full source rings, deferred conflicts, finite packed arrays and
orthogonal native triangles. Runtime tests build and dispose all ten real
packets below the existing 16 MiB geometry bound, verify retained navigation,
idempotence, unrelated/wrong-family fail-closed behaviour and cancellation.

Useful scene targets (x,z): palace `(10290,1802)`, formal southern beds
`(10315,1880)`, Alfred-Brehm-Haus `(11010,2374)`, Giraffenhaus `(10998,1928)` and
south playground `(10729,2390)`. Garden/park overview radius 450–700 m; building
and equipment recognition radius 60–150 m.
