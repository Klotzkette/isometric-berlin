# v1.0.83 — southern city, stations, courts and architectural refinements

## Delivered scope

- 67 bounded drawn/native packet pairs add 4,517 sourced buildings and 7,231
  mapped roads/paths across the remaining Steglitz–Schöneberg–Südkreuz connection
  and the finite Charlottenburg/Treptowers context. Of those buildings, 1,242
  use cached official LoD2 and 3,275 use explicit OSM provenance. Real open
  ground, water, courtyards and railway land remain open.
- Alexa, Haus des Lehrers, Alexanderhaus and Berolinahaus gain individually
  aligned facades. Alexanderplatz and Jannowitzbrücke have open glazed halls,
  tracks and platforms; Friedrichstraße retains its earlier complete halls
  and gains finer recessed framing.
- Littenstraße, Tegeler Weg and Moabit courts gain source-aligned facade and
  roof interpretation. Moabit keeps its measured two tall towers/lower eastern
  dome hierarchy. The demolished Littenstraße towers are not reinstated.
  Charlottenburg palace gains visible drum/copper-cupola recognition geometry.
- Gendarmenmarkt storefronts/window sills and 97 existing Scheunenviertel street
  walls receive shallow articulation. Existing individual source families stay.
- Fritz-Schloß-Park has an independent DGM1 hill profile reaching NHN53.29 m.
  Its source building/tree/path plan coordinates and inventories are retained.
- Molecule Man is three 30 m perforated aluminium silhouettes on the mapped
  radial axes. The Nationalgalerie has a source-centred terrace, 64.8 m black
  roof, eight cross columns, recessed glass and visible entrance framing.

## Fidelity and ownership

This is procedural recognition, not a building survey. Missing OSM heights,
facade subdivisions, several court ridge heights, the palace drum subdivisions
and Molecule Man anatomy/hole spacing are documented estimates. The gallery's
8.4 m hall height and roof size are museum/engineer publications. Source
conflicts and all exact source IDs are recorded in the linked evidence.

The city addition retains the previous 480 packet descriptors except for 13
explicitly audited mode files containing four replaced generic source owners.
Those files are independently replayed from v1.0.82 and compared byte for byte.
Unrelated triangles and navigation remain equal. Original source sheets and
inventories remain retained. Berolinahaus and Moabit keep their existing models.
Only the eight documented Nationalgalerie prisms yield to its open pavilion.

The previous source resolution, view distance and mobile geometry policy do not
change. One family is active at a time, mode changes unregister old residency
owners before disposal, and consumed construction arrays use the established
lossless weak cache. New outer packets share the existing serial loader and
unchanged per-packet/residency guards. The archive ceiling is a download-size
allowance, not a runtime memory allowance.

## Evidence and validation

[Coverage](city-coverage-v183.md), [hill](park-relief-v183.md),
[courts/palace](justice-palace-v183.md),
[stations/Alexanderplatz](alexander-stations-v183.md),
[facade depth](facade-depth-v183.md),
[gallery/sculpture](spree-nationalgalerie-v183.md).

Snapshot tests retain the frozen v169/v174 receipts and add a separate v183
fixture. An independent detached v1.0.82 construction records the exact ground,
window and column deltas: Fritz-Schloß relief and the eight Nationalgalerie
owners. The unchanged Moabit batch retains its old matrix/colour hashes.
Synchronous and cooperative full/mobile constructors match the same v183 bytes.

Validation on 8 October 2026:

- Full Python run: 886 passed, four skipped and one failing historical Alt-Mitte
  receipt. The audit found 50 missing original Alexanderhaus `ClosureSurface`
  sheets; they were restored exactly. The corrected independent source comparison
  and court tests then passed (10 tests), and the historical Alt-Mitte test passed
  separately. No remaining Python failure is known.
- Final model checks: 15 Bun tests / 777,806 assertions passed across stations,
  courts, gallery/sculpture, representation lifecycle and facade depth. Four
  synchronous/cooperative full/mobile construction checks also passed.
- Earlier combined relevant regression checks passed (48 tests / 5,137,851
  assertions). Detached v1.0.82 comparison resolved stale baseline assumptions;
  64 small historical tests and three affected large Isometric tests passed.
- Ruff check/format, TypeScript and production build passed. Release readiness
  and the ZIP's local HTTP launch check passed.
- Desktop Chrome, mobile Chrome (Pixel 5 profile) and WebKit (iPhone 13 profile)
  each passed 20 camera views over all six modes and a walking-mode round trip,
  with no page/console errors or WebGL context loss. Observed WebGL buffer peaks
  were 474,919,160 / 268,464,549 / 273,955,789 bytes respectively. These are
  instrumented graphics-buffer counters, not total process-memory readings.
- The final court/palace check added eight WebKit mobile views (four places in
  Day and Minecraft), with no errors/context loss and a 285,889,615-byte peak.
  Visual review found the upper roof lines needed opaque surfaces. Thin drawn
  surfaces now follow the exact old roof footprints; their union differs by
  less than 0.003 m², including all original court holes. Six Python tests and
  five Bun lifecycle/model tests (572,094 assertions) passed for that repair.
  The native-only seam repair passed seven Python and five Bun tests; over
  60,000 neighboring cells retain at least 10 cm overlap without interior fill.
  Two final native WebKit views of Moabit/Littenstraße passed and visually
  confirmed the gaps are closed.
- Independent final review found no further source-suppression or lifecycle
  regression. The Nationalgalerie change remains visual: its previous interior
  pedestrian collision is retained, as documented in the gallery notes.

Final extracted package: **561,874,058 bytes (535.84 MiB)**. The archive-only
540 MiB allowance leaves 4.16 MiB; live residency limits remain unchanged.

SHA-256:

```text
8a5f29e3ddd2565443ce21fd8ea78f6654e861e09af5ff57bae8707f76cd36ed  isometric-berlin-regierungsviertel-local.zip
6ee4706fc19039e19d33e976319a3cdd045201e08809270026861ead30260be7  isometric-berlin-viewer-v1.0.83.tar.gz
```
Physical iPhone memory limits are not emulated by desktop browser profiles;
these checks cannot establish that every physical device is crash-free.
