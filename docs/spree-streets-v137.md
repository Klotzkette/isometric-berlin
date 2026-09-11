# Spree public-space detail — v1.0.37

The existing retained OpenStreetMap water polygons identify the Spree and
Spreekanal. A 35 m shore selection corridor extends the existing district-road
scope inside the committed viewer bounds. Existing road axes, mapped paths,
explicit widths and lane tags remain the source; missing widths retain the
documented road-class estimate. No new cadastral or pavement survey is implied.
Reichstagufer, Schiffbauerdamm, Am Weidendamm and Am Kupfergraben are included.

`scripts/build_district_streets.py` rebuilds the offline unions, triangulation,
raised kerbs and markings. The supplement contains 2,156 road parts and 225,276
triangles. It still uses eight static draw batches, now 15,712,116 geometry
bytes. Terrain sampling, open tunnel ramps and elevated path exemptions remain
unchanged. Minecraft retains its existing source-derived block street network.

## Railings

The Overpass snapshot dated 2026-09-11T13:05:41Z selects mapped fences and
handrails within 6 m of the retained shore. Selection clips actual source lines;
it does not displace them toward the river. Walls, private/construction barriers,
short remnants and transverse property fences are excluded. The 15 surviving
runs total 1,539.43 m. Gaps between recorded runs stay open.

`scripts/build_spree_railings.py` records each OSM way ID, retained material and
height tags, snapshot/source hashes and centimetre world coordinates in
`src/app/src/data/spreeRailings.json`. The raw snapshot is a reproducible input,
not a runtime download. Query used at https://overpass-api.de/api/interpreter:

```overpass
[out:json][timeout:45];
way["barrier"~"^(fence|wall|handrail)$"](52.505,13.30,52.534,13.425);
out tags geom;
```

Height where absent (1.1 m), member spacing/section and dark metal colour are
procedural display estimates, not measured individual rail designs. Each mode
uses one instanced cube mesh, no textures, no frame callbacks, and bounded
constructor-local scratch space. The drawn reading uses 9,305 members; the
block reading 7,283. Full/mobile share the same quality in each family. Tests
check finite matrices, source-line alignment, shoreline/bounds containment,
memory budgets and continued tunnel clearance.

Data attribution: © OpenStreetMap contributors, ODbL 1.0. Existing Geoportal
Berlin terrain remains dl-de/zero-2-0. No photograph is bundled or traced.
