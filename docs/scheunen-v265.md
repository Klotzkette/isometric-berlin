# Scheunenviertel — mapped entrances and measured eaves, Step 10 / v265

This bounded follow-up addresses a specific gap in the already detailed quarter:
the v168 complete LoD2 buildings contain actual walls and roofs, while v233's
ordinary-house door selection omitted most of those separately owned sheets.
It adds **20 previously unrepresented mapped entrance locations on 12 existing
buildings**, and **five narrow roof-drain/eave treatments**. It does not claim
that the whole quarter has become a surveyed facade reconstruction.

The additions are inside the unchanged v168 Scheunenviertel working polygon.
Existing Gipsdreieck, Koppenplatz, school and dedicated shop treatments remain
intact; these locations are not counted again as new v265 work.

| Retained mapped street | New mapped entrances |
| --- | ---: |
| Linienstraße | 11 |
| Alte Schönhauser Straße | 3 |
| Rosa-Luxemburg-Straße | 2 |
| Mulackstraße | 1 |
| Rosenthaler Straße | 1 |
| Münzstraße | 1 |
| Neue Schönhauser Straße | 1 |

## Source evidence and limits

The complete `scheunenviertel-v168.json` retains 657 old/new LoD2 parent families,
including all original sheet rings and holes. Its four official archives are
`LoD2_391_5820`, `LoD2_391_5821`, `LoD2_392_5820` and `LoD2_392_5821`, from
[Geoportal Berlin's LoD2 distribution](https://gdi.berlin.de/data/a_lod2/atom/),
under dl-de/zero-2-0. The committed v233 entrance context derives from the
[retained Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf),
© OpenStreetMap contributors, ODbL-1.0. No new photograph or protected plan is
used, bundled or sampled.

There are 120 retained entrance nodes inside the working polygon; one already
has a v233 door. The compiler accepts only complete, source-bound street walls,
clear exterior approaches and unambiguous mapped-node projection. Dedicated
authored/roof owners are excluded. Thirty-one candidates pass these constraints;
eleven lack a sufficiently complete matching native wall and are left unchanged.
The final twenty have independently verified **actual rendered wall coverage**
in both modes, including the existing v168 companion where needed.

Every accepted door retains its OSM node and exact mapped point, official parent,
leaf and wall-sheet identity. Maximum smooth projection is **0.210 m** (hard
limit 0.35 m). Native wall projection is at most **1.639 m** (hard limit 1.65 m)
because it must follow the independent earlier voxel surface. The entire surround
must fit the complete original wall polygon and actual delivered wall triangles;
a clipped navigation seam or approximate building envelope is insufficient.

Door widths/heights, leaf divisions, transoms, handles and neutral material hues
are explicit **display estimates**, not measured openings or inferred business
identities. They identify real mapped entrances; no extra opening or new access
permission is invented. The existing physical building collision stays unchanged.

The five eaves are horizontal edges shared by an original roof and wall sheet,
with all original roof coordinates retained. Thin metal weather edges and one
vertical drain on each drawn front add depth without another wide cornice or
window grid. Drain location, metal section and hue are explicit estimates. Native
construction uses **62 independently located orthogonal eave segments** on its
actual delivered wall tops. Every earlier cornice, window, roof and courtyard
remains present. The retained v176 terrain-offset table is consulted and hashed;
the accepted final owners all have zero offset.

Exact source hashes, ten retained packet/companion asset hashes, node
identities, original sheets, projection distances and native planes live in
`geo_data/regierungsviertel/scheunen-v265-evidence.json.gz` (**5,002 bytes**).
All original assets are untouched. Earlier exclusions which merely identify
already detailed v168 ordinary buildings are not treated as a reason to omit a
genuinely missing mapped door; their prior facade geometry is fully retained.

## Runtime contract

`prepareScheunenV265` runs before existing packet preparers. It guards the complete
original navigation identity, exact source mesh positions/colours/indices and
origin, then appends one small part. Unknown packet keys exit before inspecting
the recipe or navigation. Repeated preparation is idempotent. Changed source,
malformed rows and exceeded capacity fail closed. Original mesh, line and
navigation objects retain their identity; no old buffer is copied or replaced.

Only existing primary packets **4_-2** and **5_-2** receive additions. The original
`4_-2-scheunen-v168` source companion remains unchanged. The recipe is **49,572
bytes** and needs no additional packed-data schema or cache.

| Existing packet | Drawn shallow boxes | Independent native boxes |
| --- | ---: | ---: |
| 4_-2 | 124 | 124 |
| 5_-2 | 171 | 178 |
| Total | **295** | **302** |

These compile to **7,080 drawn / 7,248 native additional vertices** and
10,620 / 10,872 indices across the two respective packets. The largest addition
is 4,272 vertices. The 16-part, 400,000-vertex and 2,400,000-index packet limits
remain enforced. Source hashing yields every 65,536 encoded characters,
navigation every 512 points and generation every 16 boxes. Additions join the
existing interleaved packet material/buffer lifecycle, with no separate scene
root, texture, animation loop, retained decoded cache, streaming descriptor,
tour stop or raised residency/prefetch budget. Full drawn detail is equal on
mobile and desktop; native geometry remains independently orthogonal.

## Checks and review views

Five focused Python checks pass: unchanged source/packet hashes, exact mapped
nodes and original wall rings, complete delivered drawn/native wall coverage,
real roof joins and bounded independent recipes. Five Bun checks (152 assertions)
pass: every mode/packet, source immutability, exact added counts, native
orthogonality, early unknown-key exit, idempotence, malformed/changed source
rejection and cooperative yielding. The real streaming pipeline is exercised
for both packets in both modes, comparing complete geometry to explicit
preparation and retaining every original mesh/navigation/line/origin object.
Scoped Ruff formatting/lint and TypeScript
compilation pass. Root integration records final browser/package checks.

Reproduce from the repository root:

```sh
uv run --no-sync python -m scripts.build_scheunen_v265
uv run --no-sync pytest -q tests/test_scheunen_v265.py
cd src/app
bun test tests/scheunen-v265.test.ts
```

Review Mulackstraße at entrance **[2342.063, 3, -888.407]**, with eave centre
**[2342.493, 21.162, -888.266]**. Suggested eye **[2347, 9, -903]**, target
**[2342, 8, -888]**. Load primary **4_-2** and its complete v168 companion.
The wider Linienstraße sequence is around **[2835, 11, -868]** in **5_-2**.
Use only the internal browser, as requested by the owner.
