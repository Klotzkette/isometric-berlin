# Step 10 — Tempelhof entrance and Airlift Memorial (v261)

The existing six complete Tempelhof LoD2 owners remain unchanged. The new small
companion supplies entrance fittings on the retained wall and an independently
authored Luftbrückendenkmal at its mapped anchor. No airport, court, runway,
surrounding source packet or tour stop is replaced.

## Evidence and limits

`geo_data/regierungsviertel/tempelhof-v261-source.json` records source links,
credits, retrieval date, the exact retained entrance polygon, and the SHA-256 of
the complete earlier `airports-v194-source.json`. The generator asserts that
earlier hash before producing anything. The 2,044 earlier polygons remain intact.

The high window wall is attached to owner `DEBE07YY9000088X`, wall
`UUID_2760c007-1fc2-41d9-abae-f4e80bd91795`. Its approximately 72.33 m frontage
and original coordinates are preserved. Fittings follow the earlier 22 glazed
bays: horizontal window divisions, framed ground-floor doors, handles, shallow
canopy, roof coping, round gold-toned frieze details and geometric
**ZENTRALFLUGHAFEN** lettering. The lettering reads correctly from the forecourt.
The entrance doors, canopy and lettering use their own projecting hall, owner
`DEBE07YY90002dsj`, exact wall `UUID_26fbc141-5662-4de8-895d-4d77891da844`.
This wall sits approximately 6.39–6.51 m in front of the high window wall, with
source bottom/top at 4.494/9.733 m. Attaching the lower details to the upper wall
would bury them inside this retained hall. The native version builds independent
orthogonal fittings; its entrance-specific offset clears the earlier diagonal
2 m source lattice without deleting any original boxes.

These architectural details were visually checked against the
[Berliner Zentrum Industriekultur entrance photograph](https://industriekultur.berlin/ort/flughafen-tempelhof/)
(© Andreas FranzXaver Süß, reference only). Their dimensions and colors are
display estimates, not surveyed façade measurements. The owner confirms the
[surviving entrance lettering](https://www.thf-berlin.de/ihr-besuch/fotos-stories/thf-fotostories/100-jahre-bfg)
and the use of
[Tengener Muschelkalk](https://www.thf-berlin.de/aktuelles/neuigkeiten/detail/tengener-muschelkalk-fuer-die-substanzerhaltung-der-gebaeudefassade).

The memorial uses [OSM node 27431777, version 23](https://api.openstreetmap.org/api/0.6/node/27431777.json)
at 13.3874049° E / 52.484135° N. In the existing local frame this is
`[996.4178, 3, 3890.2578]`. The ground datum is the scene datum, not an absolute
terrain survey. [The Landesdenkmalamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09055091)
identifies Eduard Ludwig's 1951 reinforced-concrete memorial and its 20 m height.
[The borough](https://www.berlin.de/ba-tempelhof-schoeneberg/ueber-den-bezirk/gedenken/artikel.358187.php)
confirms the three west-pointing ribs.

[Kähler/Kuhn, “Luftbrückendenkmal”, Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/luftbrueckendenkmal-5015/)
records a 20 × 7 × 6 m overall envelope, approximately 42 cm pedestal and 32 cm
bronze band on its curved southern edge. Those dimensions constrain the new
model. Photographs by **Layla Fetzer, 2020, CC BY 4.0** guide its broad curved web,
three proud ribs, two open top gaps and shallow pedestal. The interpretation
places the 7 m breadth across the ribs and approximately 6 m depth along their
westward bend; this axis assignment, detailed curve, thickness and taper remain
photographic estimates. The published dedication is represented on the bronze
band. Unresolved victim names are not invented.

All reference photographs remain external. No photographic pixels, video,
textures, fonts or network requests are included in either runtime model.

## Geometry, navigation and budget

`scripts/build_tempelhof_v261.py` deterministically generates
`src/app/src/data/tempelhofV261.json`: 999 memorial triangles and 112 independent
orthogonal memorial/pedestal blocks. Runtime lettering and fittings are merged
or instanced once, with frozen transforms and the same complete static detail on
desktop and touch devices.

| Mode | Draw calls | Instances | Separate triangles | Geometry/instance buffers |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 2 | 234 | 2,103 | 245,556 bytes |
| Native Minecraft | 1 | 3,200 | 0 | 243,848 bytes |

The local ceiling is 300,000 bytes per mode. Existing residency budgets, source
quality and rendering settings are unchanged. This adds no animation callback or
per-frame allocation.

`tempelhofV261Navigation.ts` collides only with the actual curved web, separated
ribs and shallow plinth; native collision checks the actual independent blocks.
The pedestal offers a 0.42 m walkable rise. The approach paths and space between
the top ribs remain open. Earlier airport walls retain their existing collision.

## Integration

Add `createTempelhofV261(nextNative)` immediately after the existing
`createAirportsV194(nextNative)` in `OutlineLandmarksV182.ts`, followed by the
usual `yield`. Add `tempelhofV261SolidAt(x, y, z, radius, activeMode === "minecraft")`
to the solid chain and `tempelhofV261GroundAt(x, z, activeMode === "minecraft")`
to the ground chain in `OuterThinOutlines.ts`. Keep all previous factories and
navigation tests. Add the cited source notices to the shared release attribution
and manifest through the release owner.

Optional internal-browser inspection cameras are exported in
`TEMPELHOF_V261_PROFILE`: entrance `[1042,39,3982]` toward `[1097,15,4063]`, and
memorial `[966,17,3912]` toward `[995,12,3890]`. No external browser was started.

## Validation

- `uv run --no-sync ruff check scripts/build_tempelhof_v261.py tests/test_tempelhof_v261.py`
- `uv run --no-sync pytest -q tests/test_tempelhof_v261.py`: 4 passed.
- `bun test tests/tempelhof-v261.test.ts` in `src/app`: 4 passed.

Checks cover exact older source preservation, deterministic regeneration,
published height/breadth/depth, west-pointing separated tips, nondegenerate
surfaces, orthogonal native matrices, byte ceilings and walkable/open collision
cases. Combined-scene raycasts against the complete earlier airport verify all
22 door bays at four samples in each mode and sample the entrance lettering from
the inspection camera, protecting against buried details. A small CPU projection
of generated memorial triangles was inspected
against the credited reference. Integrated browser visual QA belongs to the
release owner; no full build or staging output was generated by this packet.
