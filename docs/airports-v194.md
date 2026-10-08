# Former airports: Tempelhof and Tegel, v1.0.94

Step 10 replaces the six documented Tempelhof coarse building owners with their
complete measured exterior sheets. The former Tegel airport receives seven
source-footprint building models and both mapped runway courses. The original
Tempelhof outline, unrelated city packets, source records and tour remain intact.

## Metric evidence and permitted visual references

`geo_data/regierungsviertel/airports-v194-source.json` retains all 2,044 polygons
of these Berlin LoD2 parents, including ground sheets, polygon IDs and holes:

| Parent | Source polygons | Measured height |
| --- | ---: | ---: |
| DEBE07YY90002dwR | 8 | 5.62 m |
| DEBE07YY90002daO | 519 | 24.77 m |
| DEBE07YY90002dsj | 9 | 8.32 m |
| DEBE07YY900008Ks | 309 | 14.35 m |
| DEBE07YY900002ol | 532 | 29.20 m |
| DEBE07YY9000088X | 667 | 27.94 m |

Their 5,514 non-ground triangles are rendered without simplification or loss.
Each complete parent uses one rigid vertical translation from its retained NHN
datum to the previous presentation ground at y=3; internal source heights are
unchanged. The source ZIP URLs and hashes are retained in the source record.
The entrance belongs to `DEBE07YY9000088X`, exact wall
`UUID_2760c007-1fc2-41d9-abae-f4e80bd91795`. Its tall lower glazing, two shorter
upper rows and pale frames use bounded procedural subdivisions, not measured
window apertures. Airfield-facing tall hangar glazing and modest window rhythms
on the other long wings remain explicit display estimates.

The cached Geofabrik Berlin snapshot is dated 2026-09-29. Tegel Terminal A
(`relation/13234`) and the inner parking ring (`relation/611684`) retain their
actual holes. Terminals B, C and D, the connecting building, and tower
`way/24378177` use their full mapped footprints. The tower's 50 m height comes
from its OSM tag; the two cabin profiles and intermediate stages are estimated
within that footprint. Other heights are tagged level-count display estimates
or the explicit values in the generator, not surveyed architectural heights.

All five disused/abandoned runway ways retain every mapped vertex and the tagged
46 m width: `4537222`, `216959300`, `537004744`, `510281794`, `510281796`.
They form exactly two connected courses. The northern course measures 3,021.97 m
in the projected source. The southern course totals 2,534.86 m including the
unlabelled 71.93 m continuation; its labelled pieces total 2,462.93 m. The older
nominal length tags (3,023 m and 2,428 m) conflict slightly with these mapped
extents. The model retains the complete source rather than trimming its ends.
Centre dashes are sparse illustrative markings, not a present-day paint survey.

Official context was checked against
[THF roof rehabilitation](https://www.thf-berlin.de/bau-sanierung/dach-und-betondeckensanierung),
[THF steel structure](https://www.thf-berlin.de/bau-sanierung/sanierung-des-stahltragwerks),
and [Terminal A redevelopment](https://urbantechrepublic.de/flaeche/terminal-a/).
The model depicts recognizable former airport architecture; it makes no claim
that either airport currently operates or that planned redevelopment is finished.

Four inspected external Commons photographs inform materials and silhouettes:

- [Hans Knips, Tegel tower and main building](https://commons.wikimedia.org/wiki/File:Flughafen_Tegel_Tower_und_Hauptgebäude.jpg), CC BY-SA 3.0.
- [AlanFord, Tempelhof exterior](https://commons.wikimedia.org/wiki/File:TempelhofExterior.jpg), public domain.
- [Matthias Süßen, Tempelhof hangar frontage](https://commons.wikimedia.org/wiki/File:FlughafenTempelhofBerlin-2026-09-msu--0440.jpg), CC BY-SA 4.0.
- [Avda, Tempelhof aerial](https://commons.wikimedia.org/wiki/File:Berlin_-_Flughafen_Tempelhof_-_2016.jpg), CC BY-SA 3.0.

Their complete metadata and permitted uses are in `airports-v194-credits.json`.
No image, crop, texture, protected plan or photographic mesh is bundled.

## Exact substitution and navigation

`airports-v194-packet-patch.json` records the before/after SHA-256 values,
descriptors, exact old owner footprints, removed face counts and preserved
face-multiset digests. Only eight cells are affected, in both representations:
`1_7`, `1_8`, `2_7`, `2_8`, `3_7`, `ring182-1_8`, `ring182-1_9`, `ring182-2_8`.
The parent that crosses the earlier coverage boundary is removed from both
clipped scopes and reintroduced in full. No district-v188 companion owner
matches these six IDs. All non-owner triangles, ink and other navigation fields
are independently compared to the immutable v1.0.93 baseline.

Thin measured wall/roof collision replaces only those coarse occupied volumes.
`airportsV194SolidAt` uses the source navigation sheets; native collision uses
the final represented block extents. All six Tempelhof courts and the Tegel
central court stay open. The native tower and terminal surfaces do not invent
filled interior volumes. The two site bounds reject unrelated positions before
the native index is built. These helpers load with the existing lazy outline
module rather than adding the geometry payload to initial viewer startup.

The v194 preservation helper additionally verifies Viktoriapark's separately
owned exact monument subtraction and its water-only height correction. Earlier
v176/v187/v188 assertions retain frozen hashes and run through the verified
immutable intermediate checkpoints. Two already oversized old Minecraft
packets (`1_6` and `1_7`) must shrink; no residency or transfer limit is raised.

## Runtime and reproduction

`createAirportsV194(native=false)` is a frozen, texture-free factory. All drawn
devices receive the same full detail. Drawn uses 7,294 source/model triangles
and 3,551 instanced detail boxes in two draws, totaling 1,058,276 buffer bytes.
Minecraft uses 13,550 orthogonal exterior blocks in one draw, totaling 1,030,448
buffer bytes. Each stays below its 1,800,000-byte ceiling. Native runway bands
are shallow bounded strips; terminal bodies use a 2 m exterior lattice with
greedy joins rather than filled volumes. Recognition members stand modestly
proud of that lattice so the coarser surface does not hide them.

World bounds are `[-7070.83,-4907.25,1791.74,4671.61]`; the separate geographic
source mask is `bounds-airports-v194.geojson`. Review cameras (position → target):

- Tegel overview: `[-5600,1100,-3000]` → `[-5520,3,-4550]`, span 3,400 m.
- Tegel terminal: `[-5050,180,-3740]` → `[-5412,14,-4078]`, span 700 m.
- Tempelhof overview: `[2200,600,4900]` → `[1250,20,4200]`, span 1,500 m.
- Tempelhof entrance: `[1020,48,3970]` → `[1097,17,4063]`, span 160 m.

From the repository root, using the retained licensed raw caches:

```sh
uv run python scripts/extract_airports_v194.py
uv run python scripts/build_airports_v194.py
uv run python scripts/integrate_airports_v194.py
uv run pytest tests/test_airports_v194.py
cd src/app
bun test tests/airports-v194.test.ts
```

The packet integrator is idempotent against its exact receipt. It publishes a
descriptor patch; the release integration merges only those named descriptors
against the latest combined manifest, preserving parallel work.
