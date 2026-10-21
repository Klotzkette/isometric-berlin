# Alte Münze and Leipziger Straße (v257, step 10)

This finite refinement uses 36 retained LoD2 wall planes on 14 existing owners.
It adds no district, source building, roof, court fill, street surface, descriptor,
tour stop or photographic texture. Detlev-Rohwedder-Haus and its already complete
dedicated campus model remain unchanged; it is the western endpoint, not a new
ministry reconstruction.

## Architecture and scope

The combined source owner `DEBE01YYK00006oT` contains the main Alte Münze street
front and Palais Schwerin. The six selected source walls are indices 4, 7, 20,
25, 33 and 110 of its sole part. They receive a complete three-storey facade
reading, stone window reveals, divided white frames, ground-floor bars, the
two-pier gated main portal, a shallow Münzfries band with original approximate
craft-figure silhouettes, and the Palais's ochre plaster, quoins, rounded heads
and two balconies. No photographic relief, inscription or artwork texture is
reproduced. The gate remains a facing on the existing solid source wall, with
unchanged navigation; no walk-through opening is claimed.

The earlier v169 generic 3.25 m grid created six apparent window rows here.
The primary monument record explicitly documents three storeys. The bounded
correction overlays **only these six exact planes**, behind the new facade
members, with a thin facing 0.20 m outside the wall. All **1,344** earlier
authored triangles on these planes are independently matched to the retained
delivered packets. The source recipe's exact half-centimetre quantizer ties
are tested against actual delivered triangle hashes, not a broad spatial
tolerance. Their recipes and the complete original packets remain immutable.
This is explicitly an authored-estimate correction, not an additive-only claim.
No wall, roof, other source surface or unrelated authored detail is deleted.

Along Leipziger Straße, six existing towers at numbers 40, 41, 43, 44, 46 and
47 receive long-side loggia floor noses, parapet strips and thin dividers on
their measured planes. The photographed blue strips distinguish 40/41; the
other towers use restrained neutral estimates. All existing window apertures
are matched to delivered triangles and preserved. Two existing pavilions at
42 and 45 gain the documented folded-parapet rhythm, without inventing new
ground-floor tenant names. Five existing western frontage owners gain shallow
sills, reveals and cornice profiles around their retained original openings:
`DEBE01YYK0000B5V`, `DEBE01YYK0000EdR`, `DEBE01YYK00007So`,
`DEBE01YYK0000Ak4`, and `DEBE01YYK00004NG`.

Every unmeasured bay subdivision, colour, relief figure, fitting thickness and
projection remains a **display estimate**. The official street study is a
2019 architectural account, not evidence that every later proposed renovation
is completed. The 2024 WBM publication confirms the 40/41 building identity;
retained LoD2 is authoritative for current delivered envelopes and roof levels.

## Evidence and source credits

Sources were accessed 21 October 2026. Exact per-source credit records are in
[leipziger-muenze-v257-sources.json](leipziger-muenze-v257-sources.json).

- Berlin LoD2 and retained official coordinates: Geoportal Berlin,
  [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0).
- Retained OpenStreetMap street courses, identities and addresses:
  © OpenStreetMap contributors, ODbL-1.0.
- [Landesdenkmalamt 09020051](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020051)
  supports the mint's three storeys, plain plaster/stone-framed openings,
  Schadow frieze, double-height supported portal and seven-axis Palais with
  two balconies. Architecture: Fritz Keibel and Arthur Reck; Palais attributed
  to Jean de Bodt. Historical frieze: Johann Gottfried Schadow.
- [Alte Münze operator](https://www.alte-muenze-berlin.de/) confirms the current
  cultural use and Molkenmarkt / Am Krögel identity.
- [Berlin Mitte architectural study, pp. 26–27](https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2020/1155-2020-anlage-3-1-gutachtenleipzigerstrasse_textteil.pdf),
  Meyer Große Hebestreit Sommerer for Bezirksamt Mitte, 2019: tower loggias,
  differentiated paired high-rises, two-storey bases and folded pavilion
  parapets. This is a factual reference; no protected plan is copied.
- [WBM, Mittendrin 3/2024, p. 5](https://www.wbm.de/fileadmin/user_upload/MITTENDRIN_Q3_2024_Web_barrierefrei.pdf)
  confirms Leipziger Straße 40/41 and its 1974 occupation.
- Main Münze photograph: [Jörg Zägel, 6 August 2009](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Molkenmarkt,_M%C3%BCnze_02.jpg),
  CC BY-SA 3.0. Palais photograph:
  [Jwaller, 21 September 2008](https://commons.wikimedia.org/wiki/File:B-Molkenmkt.JPG),
  CC BY-SA 3.0 (selected from offered licences). Tower photograph:
  [Axel Mauruszat, 17 February 2014](https://commons.wikimedia.org/wiki/File:Leipziger-Str-40%2B41.jpg),
  CC BY-SA 3.0. These three freely licensed photographs were inspected solely
  as external visual references. No pixels are redistributed.
- [BMF history](https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Video-Textfassungen/Geschichte/textfassung-detlev-rohwedder-haus.html)
  confirms the separate retained ministry endpoint.

## Integration and preservation

`leipzigerMuenzeV257Rows(cell, native)` decodes only the requested family's rows
for an existing v186 cell. `altMitteEdgesV186Batches.ts` appends these rows after
the exact original instance prefix. The cells are `1:1`, `2:1`, `2:2`, `3:1`,
`3:2`, and `4:0`; no new cell or draw call is created. The correction metadata
identifies cell `4:0`. Disposal, frozen transforms and settled geometry upload
retain the existing batch lifecycle. There is no mobile quality switch.

| Complete existing v186 family | Before | After | Draw calls |
|---|---:|---:|---:|
| Drawn instance matrices + colours | 270,560 B | 590,368 B | 54 unchanged |
| Drawn complete geometry + instances | 305,552 B | 625,360 B | 54 unchanged |
| Native instance matrices + colours | 2,130,432 B | 3,173,000 B | 54 unchanged |
| Native complete geometry + instances | 2,165,424 B | 3,207,992 B | 54 unchanged |

The addition contains 4,208 drawn cuboids and 13,718 separately authored
axis-aligned native surface rows. Native rows are not smooth rotated boxes
reused from drawn geometry. These are measured constructor buffer bytes, not
new live allowances; no residency, transfer, decode or prefetch limit changes.
The numeric source is 725,379 bytes, approximately 85 KiB gzip; release tooling
must account for its measured static/offline bytes separately from live limits.

`leipziger-muenze-v257-source.json.gz` freezes the selected planes, old apertures,
source-file hashes, delivered-packet hashes and correction receipts.
`leipziger-muenze-v257-evidence.json.gz` retains every face's clipping audit and
independent numeric families. No prior source/data asset is written by the
generator. Running `uv run python scripts/build_leipziger_muenze_v257.py`
rebuilds only these two evidence files and the bounded new runtime JSON.

## Checks and views

Targeted checks pass: three Python tests for complete source hashes, every exact
correction receipt, source-wall containment and deterministic generation; two
Bun tests for finite independent families, unchanged old instance prefixes,
existing spatial batches and exact complete-family byte accounting. Scoped
Ruff formatting/lint passes. Production screenshot review is performed with
the shared v257 release build.

| View | Camera | Target |
|---|---|---|
| Alte Münze | `[2380,48,333]` | `[2482,14,416]` |
| Palais Schwerin | `[2470,36,295]` | `[2525,14,372]` |
| Leipziger towers | `[1460,75,830]` | `[1630,38,990]` |
| Leipziger western fronts | `[1020,42,875]` | `[1000,18,954]` |
