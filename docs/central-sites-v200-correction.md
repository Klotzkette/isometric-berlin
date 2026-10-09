# Central sites v1.0.100: exact underground-station proxy correction

Pipeline step 10 corrects one false above-ground mass at
Oranienburger Straße / Tucholskystraße. The retained source remains intact.
This is separate from the Delivery Hero, Heckmannhöfe and former HU barracks
facade additions.

## Identity and evidence

The exact delivered prism `98956069` is the compact suffix of
`OSM-way-398956069`, the mapped underground station footprint. The retained
`raw/outer-v159/candidate.gpkg`, layer `multipolygons`, identifies that way in
`osm_way_id` (not `osm_id`) and records `building=train_station`, `layer=-1`,
`location=underground`, and `indoor=yes`. Its heritage reference is `09050129`.
The context building's 12 m height explicitly has the provenance
`display_fallback:building=train_station`; it is not a measured surface building.
[Original OSM identity](https://www.openstreetmap.org/way/398956069).

`src/app/src/data/centralSitesV200Correction.json` preserves the complete raw
attribute row and geometry, the complete context properties and projected
footprint, the original delivered prism, complete affected native source rows,
and SHA-256 receipts. Original data files are not changed or regenerated.
OSM attribution and ODbL-1.0 remain applicable; the retained LoD2 and ground
contributions remain credited to Geoportal Berlin under dl-de/zero-2-0.

## Exact native scope

`minecraft-voxels.json` uses a 4 m grid. Each
`building_rows[zOffset]` run is `[xOffset, count, y0Dm, y1Dm, classId]`, relative
to the payload's grid origin. There are exactly **29** occupied target cells,
in **seven runs across six rows**, all with `(y0Dm, y1Dm, classId)=(52,172,3)`.
The footprint is concave; filling its bounding rectangle would remove unrelated
or empty space. The receipt freezes absolute cell keys and original columns,
and hashes both all source `building_rows` and each complete affected row.
Array hashes use compact UTF-8 JSON, compatible with `JSON.stringify`, with
no trailing newline.

Every frozen centre lies inside both the original OSM context footprint and
the simplified delivered prism. All current source owners and delivered prisms
were checked: **zero target centres are shared**. Closest other source owners:

| Owner | Source footprint clearance |
|---|---:|
| `OSM-way-98338944` | 3.473165 m |
| `OSM-way-68793122` — Postfuhramt | 3.775291 m |
| `OSM-way-24054923` | 6.256097 m |
| `OSM-way-199124892` — Fernsprechamt | 9.969562 m |

The receipt separately records distances between the simplified prism rings;
these differ slightly from the unsimplified source measurements. Twelve nearby
owners and their complete delivered prisms are retained as negative controls.
The legacy native raster merges competing owners by snapped height. No such
ambiguity occurs here; a changed or shared cell requires a fresh audit.

## Integration contract

Import only from `src/app/src/centralSitesV200Profile.ts`:

```ts
CENTRAL_SITES_V200_FALSE_PRISM_IDS: ReadonlySet<string>
isCentralSitesV200FalseColumn(worldX, worldZ, y0, y1): boolean
```

Use the same singleton ID set to omit the false prism from drawn presentation
and pedestrian obstacle compilation. It has no mutation methods and never
matches the neighbouring Fernsprechamt prism `99124892`. The native predicate
accepts only exact original cell centres, `worldX=(xIndex+0.5)*4` and
`worldZ=(zIndex+0.5)*4`, with **decoded metre** heights `y0Dm/10` and `y1Dm/10`.
Call it before terrain translation. It does not round arbitrary points to cells,
accept fuzzy heights, clear a rectangle or infer a replacement solid.

Keep existing roads, ground and other obstacles. This correction adds no
navigation surface, underground station floor, entrance stairs or tunnel.
The original underground source feature is retained as evidence, not moved to
an invented underground elevation. Shared Isometric/Minecraft/pedestrian hooks
are integrated by the root task; this bounded change does not edit them.

Validation: `cd src/app && bun test tests/central-sites-v200-correction.test.ts`.
The regression checks the complete native stock, full source digests, every
neighbouring prism, concave gaps, wrong heights, non-centre coordinates and
immutable exact-ID semantics. Actual near/distant construction in both profiles
and the production Day/Minecraft pedestrian index retain a real neighbour and
an identical foreign-ID control. The separate [construction audit](minecraft-construction-v200.md)
records the exact native whole-world delta; facade-factory tests remain separate.

## Remaining source limits for adjoining recognition work

- The Delivery Hero corner at Oranienburger Straße 70 / Tucholskystraße 16 is
  the 1958–1963 Institute for Post and Telecommunications, separate from the
  1926/27 clinker Fernsprechamt at Tucholskystraße 6–14. Exact current facade
  materials and opening positions for the postwar corner remain unverified in
  primary text. The modern roof project does not clearly divide its scope
  between these bodies. [LDA corner](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020488),
  [LDA clinker building](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035281),
  [roof architect](https://fjarchitekten.de/projekte/fernsprechamt/).
- The Forum's public square and Oranienburger access through the Torhaus are
  textually documented; precise passage widths and all additional exits are
  not. Ziegelstraße 23 is a delivery address, not proof of a public throughway.
  [Owner](https://www.forum-museumsinsel.de/torhaus/),
  [Delivery Hero](https://www.deliveryhero.com/imprint/).
- Heckmannhöfe has three linked courts and a passage between Oranienburger
  Straße and Auguststraße. Exact current remise facade materials, opening
  measurements and unrestricted opening hours remain unverified.
  [Operator](https://heckmannhoefe.de/historie/),
  [operator passage statement](https://heckmannhoefe.de/wp-content/uploads/2023/02/heckmann-hoefe_pressemitteilung_2023.pdf).
- The former barracks' east and west towers are not interchangeable: the west
  was rebuilt in simplified form. HU's documented access at Geschwister-Scholl-
  Straße 7 and Am Weidendamm 2–3 includes a gate/barrier; it does not establish
  a permanently unrestricted public throughway. No unsurveyed courtyard wing
  is reconstructed from that description. [LDA](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075018),
  [HU access](https://zeh2.zeh.hu-berlin.de/cgi/webpage.cgi?campus=0&f=1&spid=6e38550a64b0a2c0634212fe114b0ceb&z=55).

All recognition dimensions beyond retained metric source geometry remain
labelled display estimates. No photograph, interior design or protected plan
is reproduced by this correction.
