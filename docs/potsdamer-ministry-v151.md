# Potsdamer Platz and Bundesumweltministerium — v1.0.51

Step 10 replaces only the generic render owners for **45 complete official
LoD2 parts**, retaining every original wall and roof sheet. The compact source
supplement remains separate from facade interpretation. The covered ministry
atrium is distinguished from open courts. The historical ministry's pitched
roof, Forum Tower's 18-part stepped outline, Haus Huth's six-part roof and
Grand Hyatt's 16-part roof/patio are not replaced by rectangular blocks.

The ministry comprises historical parent `DEBE01YYK00002NC` plus the incorporated
northern/southern additions `DEBE01YYK00006XH` and `DEBE01YYK00008P4` and covered
atrium `DEBE01YYK0001yEo`, intersecting OSM ministry way `145292263`. The western
wedge across Stresemannstraße is deliberately not misidentified as the ministry.

## Evidence and interpretation

[Landesdenkmalamt 09095986](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095986)
identifies the historical sandstone ground arcade and four office floors.
The [ministry](https://www.bundesumweltministerium.de/ministerium/anschriften)
confirms its current address. Inspected freely licensed photographs distinguish
the light historic plaster, sandstone arcade, tan new wing, green/metal roofing,
glazed atrium and the pitched roof's semicircular dormers.

[Haus Huth's operator](https://www.potsdamerplatz.de/de/office-leasing/altepotsdamerstrasse5/)
identifies the 1912 building; its model adds stone piers, arches and its name.
[The Forum Tower's operator](https://www.potsdamerplatz.de/de/office-leasing/potsdamerstrasse11/)
confirms Renzo Piano's building; its facade separates the high glass wedge and
terracotta wing. [Rafael Moneo's project record](https://rafaelmoneo.com/en/projects/hyatt-hotel-and-mercedes-benz-offices-on-potsdamer-platz/)
documents the Grand Hyatt's full block and patio. Its squared window openings,
red stone courses, darker ground glazing and roof letters follow the inspected
reference. The Forum and Hyatt keep the owner-photo panorama wall/roof palette; new
references refine their facade subdivisions. Existing DB Tower, Kollhoff and
Sony/Beisheim recognition detail is
preserved by its existing render owner.

Every new reference was inspected. Per-file authors, license links and use are
in [the source manifest](potsdamer-ministry-v151-sources.json). Photographs are
external visual references only: none is bundled or loaded. Local window,
stone-joint, dormer and lettering dimensions are bounded procedural fits, not
surveyed facade schedules. No interior artwork or protected plan is copied.

The Mandala Hotel, northern/southern Alte Potsdamer Straße residential wings and
Rafael Moneo’s Potsdamer Straße 7 office also receive thin facade relief on 69
verified original wall planes across 68 retained parts. Their existing source
owners, roofs, planted roofs, court openings and owner-panorama palettes remain
untouched. Windows, sills, transparent ground-storey cues and upper metal courses
follow the existing panorama evidence, with bounded procedural subdivisions.
The Mandala is not misattributed to Piano. No unverified lettering is added.

## Rendering and ownership

- `potsdamerMinistrySource.json`: all 45 complete source envelopes, previous
  prism records and source-derived, obstruction-tested facade planes.
- `potsdamerMinistryOwnership.json` plus `potsdamerMinistryProfile.ts`: light
  ownership data and a generated safe-cell lookup. Only 483 completely owned
  native 4 m columns are suppressed. All 183 boundary columns remain unchanged,
  including all 29 cells intersecting an unrelated source part. A cell argument
  is its lower-left x/z plus cell size. Unknown grids retain their source geometry.
- `potsdamerMinistrySourceProfile.ts`: full source parts and exact original
  roof-plane sampling for movement and source-envelope checks.
- `potsdamerStreetWingSource.json`: 69 wall planes for the four facade-only
  street-wing groups, retaining all 68 original owners and their roofs.
- `PotsdamerMinistryArchitecture.ts`: four drawn modes share all static detail;
  Minecraft builds one surface-only roof/wall batch plus two block-facade batches.

Elevation registration is explicit per building: the median existing rendered
ground minus the minimum official ground. Original source coordinates remain
in the JSON. Geometry generation never modifies those source records. The
lower technical roofs remain at their original relative heights.

Measured addition budgets (whole standalone constructed group): drawn
**11 drawables, 20,140 instances, 1,692,640 bytes** including complete source
shells; native Minecraft **3 drawables, 19,624 instances, 1,492,720 bytes**.
Both are texture-free, frozen and deterministic. This replaces the same source
buildings' former generic render contribution; facade-only wings stay additive.
The native renderer conservatively retains original boundary columns instead
of dropping a neighbour’s footprint, material or roof where a 4 m cell is mixed. No additional point lights or
animation are added.

## Validation

Six Bun tests check ownership, unrelated tower/plaza preservation, exact
source bounds, source roof queries, finite/frozen texture-free geometry and
bounded drawn/native memory. Three Python tests check complete per-part source
ownership, retained wall/roof sheets, reproducible native-cell preservation and
facade membership in original source surfaces (including the four street wings). Release-level shared renderer/navigation integration and browser QA
are recorded by the root release audit.
