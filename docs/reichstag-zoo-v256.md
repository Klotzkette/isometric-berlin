# Step 10 — Hippo house and Reichstag, v1.0.156

This bounded refinement keeps all city coverage, seven starts, six modes and
93 tour stops. It reuses existing scene batches and live residency budgets.
Full drawn geometry is identical on desktop and mobile.

- [Hippo house: evidence, preserved geometry and buffer checks](zoo-hippo-v256.md).
- [Forum fountains and public-space fittings](reichstag-public-v256.md).
- [Sinti and Roma memorial: exact correction receipt and native model](sinti-roma-v256.md).

## Unity flag and existing visitor area

The existing OSM anchor `[226.039773, 57.925456]`, 28.5 m mast, 60 m² cloth,
stripe geometry and bounded wind animation remain unchanged. The
[Bundestag account](https://www.bundestag.de/dokumente/textarchiv/2023/kw34-rtg-flagge-der-einheit-383254)
confirms these dimensions and the bronze base inscription. The already retained
close photograph by [Sir James](https://commons.wikimedia.org/wiki/File%3A2004-12_Fahnenmast_Flagge_der_Einheit_Reichstag_Berlin_2v2.jpg),
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), guides a flush
square bronze plate, circular collar and raised lettering. The 1.66 m plate,
small member dimensions and patina are visual estimates. Lettering uses the
project's original geometric alphabet, without a font or texture. Independent
orthogonal native cells represent the same fittings.

The provisional visitor security containers retain complete LoD2 owner
`DEBE01YYK0002TmN` (ground plan 2016-03-09, source created 2026-03-02,
height 3.005 m). Only perimeter coping and indicative modular joints are added.
The footprint and input hash are recorded in `unityVisitorV256.json`.
Fittings use the retained rendered prism's ground Y = 5 m and height = 3 m
(`lod2-prisms.json`, owner `K0002TmN`), while the measured source height remains
3.005 m in metadata. Neither interior layouts nor security equipment locations
are inferred.

Native fittings follow the exact exposed faces of the existing 43 source
voxel columns, whose quantised tops are 8.9–9 m. Thirty coping blocks and
thirty joints follow that stepped perimeter rather than the smooth outline.
`unityVisitorNativeV256.json` records every unchanged source column, exposed
face and payload hash. No native column is replaced, moved or recoloured.

The [Bundestag visitor-centre account](https://www.bundestag.de/besuche/architektur/reichstag/besucherzentrum-795064)
distinguishes these existing containers from the future BIZ.
[Berlin Mitte's project record](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/planung-entwurf-neubau/besucher-und-informationszentrum-des-deutschen-bundestages-biz-bebauungsplan-1-94-1478690.php)
still describes the construction project. No planned BIZ, tunnel, security
ditch or future relocation is rendered as existing. The separate Berlin-Pavillon
restaurant/shop remains intact. References checked 20 October 2026.

No reference photographs are redistributed. All previous ground, paths,
source trees and measured buildings remain. These changes add no per-frame
callback, streamed descriptor or memory-budget increase.

## Release validation

The production build and Ruff checks passed on 21 October 2026. The final
focused Bun run passed 54 tests with 1,224,552 assertions, including source
preservation, native roof alignment, exact pool tint and mode-family visibility.
Independent code review found no actionable regression.

Current-build browser QA passed 44 views without page errors, crashes, context
loss or GL errors: 24 memorial/flag/visitor views and 18 public-realm views in
Chrome and iPhone WebKit through day → Minecraft → night, plus two fresh
hippopotamus-house views. Screenshots were visually inspected. The broad Forum
ground still uses the retained green fallback; no surveyed plaza paving is
claimed. The hippo roof remains the retained angular LoD2 abstraction beneath
the new grid, not a newly surveyed curved shell.

The complete offline package has 4,725 files and 931,789,949 bytes
(888.624 MiB), within the unchanged 889 MiB allowance. Both complete archives
passed content checks; their remote draft-release sizes and SHA-256 digests
match `releases/SHA256SUMS-v1.0.156.txt`. The local TAR was then removed to free
space for historical source replay; the verified ZIP and full package remain.
The prospective Pages tree is 1,020,363,458 bytes with 53,378,366 bytes of
headroom below 1 GiB, retaining exactly the two preceding live asset sets.

The first full test attempt was interrupted by the overnight session restart.
An isolated replay failed only with `ENOSPC`; no lineage assertion failed.
The fresh full repository run is in progress. Final test and publication
receipts follow after completion.
