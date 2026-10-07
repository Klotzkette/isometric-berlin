# v1.0.82 — bounded Ringbahn infill, Steglitz and recognition details

Step 10 implements the owner's 7 October request as an additive outline stage.
The original city, complete fine landmark geometry and 93-place tour remain.
New ordinary blocks are deliberately source-bound massing, not surveyed facade
reconstructions. No photographic texture or additional rendering engine is used.

## Changes and evidence

- [Ringbahn infill](ring-city-v182.md): the exact mapped ring interior, a 100 m
  exterior buffer and finite Steglitz/rbb/Estrel lobes add 24.437 km² beyond the
  retained city. 17,502 building source records and 24,012 mapped road/path
  records supply the new areas. True parks, water, rail yards and courtyards
  remain open. All source vertices are retained before centimetre encoding.
- [Steglitz](steglitz-v182.md): photographed stepped Kreisel scaffold and crane,
  its three distinct mapped masses, 35 individually measured neighbouring parts
  instead of the previous compound maximum-height annexes, 71 official parts for
  Rathaus, Das Schloss, Gutshaus and Gymnasium, plus the nine-panel Spiegelwand.
  The school, town hall, shopping centre and historic Gutshaus stay distinct.
- [Recognition details](city-recognition-v182.md): Funkturm, Estrel Hotel,
  Rathaus Tiergarten/Mitte, Altes Stadthaus, Schillertheater, Deutsche Oper,
  Staatsoper, rbb/Haus des Rundfunks and the blue Theodor-Heuss-Platz obelisk.
  Existing Deutsches Theater, Gorki, Konzerthaus, Synagogue/Oranien corridors and
  Savignyplatz models were checked and retained. Their detailed source layers
  are not replaced with new generic blocks.
- Official DGM1 terrain for Viktoriapark/Kreuzberg, Humboldthain and Volkspark
  Friedrichshain, sampled on a 10 m grid. All three park height fields retain
  measured NHN minus 30 m, fading into the old flat datum over 80 m *outside*
  their mapped boundaries. Monument/building holes do not flatten the hill.
  Published samples reach scene y=36.58/56.46/48.20 m respectively. This is a
  local relief correction, not a claim of surveyed elevation across Berlin.
- Park source polygons, roads, paths, building footprints and tree identities
  remain. Exact outer triangles are split at terrain boundaries with receipts;
  whole buildings share one rigid altitude across chunk boundaries. Pond
  surfaces keep a level water plane. Core objects follow their rendered ground
  sampler. The Humboldthain backing uses bounded local runs below the smooth
  visible ground, instead of a broad flat slab cutting across the hillside.
  Only this hill receives a 4 m surface tessellation and at most 2 m collinear
  path samples; original plan traces and surfaces outside its apron remain.
  The added path storage is 256,576 bytes without additional draw calls.
- The existing mapped northern Flakturm outline receives an explicit 42 m
  display envelope (scene y=13.4–55.4). The previous generic 9 m envelope is
  documented as a source conflict; no surveyed fine facade is claimed. Native
  blocks quantize the height to 44 m on their existing 4 m courses.

Terrain evidence: `geo_data/regierungsviertel/park-relief-v182*.json`, including
original values, triangle counts and object receipts. DGM source archives and
hashes are recorded there; raw archives remain ignored. Terrain reproduction:
`uv run python scripts/build_park_relief_v182.py --samples --packets --objects`.

## Runtime safeguards

The new 150 tiles use the existing single serial, cancellable surrounding-city
loader. They are external gzip packets, not an eager 51 MB JavaScript import.
Drawn and native landmark representations are mutually exclusive; changing
family disposes old GPU resources before constructing the new family. Read-only
construction lists participate in the existing reclaimable source cache.
The walking envelope includes the new bounded area. Shared old/new chunk boxes
are resolved by actual source ground ownership, avoiding an empty first-match
packet preventing walking in the neighbouring new geometry.
No resolution, source detail, viewing distance or movement speed was reduced.

## Open location question

The reported high edge along Luisenstraße could not be identified from the
street name alone. The real Charité Bettenhochhaus and measured adjoining
buildings were not arbitrarily lowered. A location clarification was requested;
this specific potential correction remains open.

## Validation

- Full Python run: 865 passed and four optional-source checks skipped. Two
  remaining assertions were corrected narrowly for the documented package
  expansion and unchanged navigation geometry with new terrain provenance;
  both then passed in an eight-test focused rerun.
- Bun: 205 focused tests passed with 478,906 assertions; three additional
  hill-path checks passed with 58,149 assertions. Geometry hashes, source
  positions, mode-family disposal and walking bounds are covered.
- TypeScript/production build, full Ruff format/check, whitespace check, release
  readiness and the extracted local-package HTTP smoke passed.
- Static package: 542,897,262 bytes extracted. Its explicit 525 MiB download
  ceiling includes the 50,942,796-byte Ringbahn packet/inventory addition;
  runtime residency and per-packet ceilings are unchanged.
- Final mobile-profile Chrome and WebKit each passed 18 route/mode views and
  actual Steglitz walking with Day–Minecraft–Day position preservation. All
  six modes were exercised. Chrome peaked at 338,004,083 tracked buffer bytes;
  the successful WebKit repeat peaked at 258,353,611 bytes. These counters omit
  textures, JavaScript, driver overhead and total browser memory.
- Final desktop Chrome also passed the same 18-view route, all modes and walking
  continuity without errors or context loss; tracked buffer peak 465,104,475 bytes.
- One preceding final WebKit run suffered a native GPU-process SIGSEGV during
  walking, after its 18 view checks had passed. The native stack points to
  ANGLE buffer-memory accounting (`gl::Buffer::getMemorySize`), with no confirmed
  application disposal defect. The unchanged full repeat passed without context
  loss or console errors. The failed run is not treated as a pass or proof that
  device crashes are solved. Buffer-count pressure remains a follow-up risk.
  The suspected reserved-buffer path in upstream [ANGLE ResourceMap](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/ThirdParty/ANGLE/src/libANGLE/ResourceMap.h)
  and [ResourceManager](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/ThirdParty/ANGLE/src/libANGLE/ResourceManager.h)
  is a hypothesis, not a verified diagnosis of the installed browser binary.

Browser phone profiles exercise browser engines and touch layouts; they do not
certify the RAM limits of a physical iPhone or promise zero crashes on all devices.
