# Deutsches Technikmuseum — v272

The museum now has a complete, four-level glass-and-steel new-building envelope,
its geographically retained suspended C-47B silhouette, the upright 44 m rotor
blade, and the two former Anhalter railway roundhouses with their turntables.
The railway yard keeps 91 retained track alignments. Six small, anonymous
locomotive models stand on actual recorded tracks behind the halls' glazed inner
fronts. Existing historic street buildings, freight warehouses, courtyard holes,
museum park, water tower and windmill bodies remain; compact windows, cornices,
the water tank and two different mill sails supplement those bodies.

## Evidence and limits

- [Museum buildings and grounds](https://technikmuseum.berlin/museum/ueber-uns/gebaeude-und-gelaende),
  Stiftung Deutsches Technikmuseum Berlin. The operator identifies the current
  four-level new building by Ulrich Wolff / Helge Pitz, the suspended Douglas
  C-47B, the historic entrance and former Anhalter railway works. Reference
  photographs credit Ériver Hijano and C. Kirchner. The announced future central
  reception is excluded.
- [Wind-energy exhibition](https://technikmuseum.berlin/programm/dauerausstellungen/windenergie),
  the same operator, publishes the 44 m Vestas V90 blade and the two historic
  windmills. Blade centreline sections total 44 m, with estimated section widths
  and bend; 44 m is the blade length rather than an invented surveyed elevation.
- [Railway exhibition](https://technikmuseum.berlin/programm/dauerausstellungen/eisenbahn),
  the same operator, confirms the two historic roundhouses, their turntables and
  glazed inner circulation. The models do **not** assert an inventory number or
  current exhibit-bay placement. Their appearance is a compact steam-locomotive
  interpretation, not a survey of six particular vehicles.
- Retained local OSM snapshot `raw/outer-v159/candidate.gpkg` supplies the aircraft
  outline `way/167983108`, rotor base `way/255072469`, two turntables
  `way/16109012` / `way/16109013`, 91 rail alignments and ancillary building
  locations. The current viewer's complete source-plan points remain unchanged.
- Official LoD2 archive `LoD2_389_5817.zip` supplies owners
  `DEBE02YY400000WL` and `DEBE02YY400001Wk`; all 431 original surface records are
  retained verbatim in `technikmuseum-v272-evidence.json.gz`, with input hashes.

The first official family merges the new museum, old entrance and first shed
into a single flat-height extrusion. Applying its maximum to the entire family
would falsely raise the historic wing and low railway shed. The runtime therefore
keeps distinct complete OSM plans. New-building top 25.879 m and second-shed maximum
14.914 m are retained in the existing NHN−30 frame. Existing viewer ground remains
5.2 m. First-shed ridge, shed eaves, facade subdivisions, glass fields, aircraft
altitude, locomotive fittings, mill sails and water-tank dimensions are explicitly
recognition estimates. No photograph, texture, recording, sound or video is
included in the application.

## Exact ownership and geometry

Only three unchanged coarse core proxies can transfer:

| Owner | Existing proxy | Replacement |
| --- | --- | --- |
| New museum | `26477645` | Complete stepped source footprint and four-level envelope |
| Roundhouse I | `93119087` | Complete fan footprint, glazed inner front and opaque fan roof |
| Roundhouse II | `15698848` | Complete fan footprint, glazed inner front and opaque fan roof |

The profile checks the complete original record, including plan, holes, base,
height, class, roof and colour. Native removal additionally requires all three
unique unchanged originals, unchanged grid size and an exact five-value receipt.
909 original tuples can retire; 45 shared tuples remain. Unrelated source owners
and changed/new overlapping neighbours fail closed. No surrounding packet or
geographic cutout is used. Attach the complete required model before enabling
these filters.

Drawn plans retain every original vertex. The native model is separately built
from orthogonal boxes. Its 1.2 m source-cell union is shared by roof construction,
cardinal walls and navigation; integer-decimetre centre tests avoid disagreement
on source edges. No rotated drawn mesh is passed off as native construction.
The roof is never hidden, transparent or removed to expose exhibits. Inner-front
glass at opacity 0.16 allows exterior views toward all six track-aligned models;
the building remains closed to walking. There is no newly invented entrance route.

## Runtime and checks

Both drawn desktop and drawn mobile receive identical full geometry. Normal
construction retains no diagnostic row lists. The model has no timers, animation
loop, remote asset loading, material texture or independent resource lifetime.
Materials participate in the existing day/night switch and normal scene disposal.

| Mode | Instances | Triangles outside boxes | Draw batches | Attribute bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 6,987 | 18,285 | 3 | 2,506,368 |
| Native | 37,329 | 0 | 2 | 2,838,156 |

The construction JSON is 82,087 bytes before transfer compression. Existing city
coverage, mobile quality, 93 stops, resident geometry limits, packet decode and
prefetch limits are unchanged.

Focused Python checks re-read both official owners and compare every retained
sheet, verify input hashes and every native source tuple, prove exclusion of
shared owner columns, match the cardinal footprint to native roof cells and
check that all six locomotives including their tenders fit inside the relevant
source shed. Focused Bun checks test exact/fail-closed retirement, every visible
native roof cell's navigation height, all-orthogonal instances, identical mobile
buffers, bounded allocations and disposal. Ray tests from each turntable pass
through glass and hit the corresponding locomotive in both modes, while roofs
remain opaque. Whole-world internal-browser inspection is performed by the main
integration task.

Production integration checks also exercise the actual initial, distant and
progressive coverage builders with transfer enabled and disabled, reject changed
source owners, and switch the actual navigation index through drawn/native/day.
An additional conservative obstruction check includes all 1,216 retained native
building tuples in the museum area, explicitly including all 45 shared tuples;
none blocks any of the six turntable-to-locomotive sightlines. The main task also
confirmed the visible locomotive views in its internal-browser inspection.

## Integration hooks

- `createTechnikmuseumV272(native, {mobileLike})`: required-site construction.
- `isTechnikmuseumSourceV272(record)`: exact three-prism transfer predicate.
- `createTechnikmuseumColumnTesterV272(prisms, cellM)`: exact native tuple predicate.
- `technikmuseumSolidsV272(native)`: three closed exteriors with shared roof heights.
- `TECHNIKMUSEUM_V272_PROFILE.cameras`: front, railway yard and glazed-hall views
  for the app's internal browser. This does not create a new tour stop.
