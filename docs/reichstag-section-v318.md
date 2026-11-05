# Reichstag longitudinal section and short grass

Step 10, v1.0.198. Click or tap the Reichstag exterior to open the reversible
longitudinal section, parallel to its long north/south axis. The view moves to
the western cut. Click again or use **Schnitt schließen / Close section** to
restore the complete exterior. Entering walking mode closes the exhibit; normal
source-admitted public entrance, chamber, stairs and both dome ramps remain.
Drag, pinch, cancelled/long presses and the browser's second double-click do
not cause repeated section toggles. The state survives a mobile family remount.

Six intersected world clipping planes remove only the finite west display volume
(local x -69 to -8, z -74 to 74, y 5.45 to 90). All original source arrays,
indices, instance matrices, wall/roof detail and collision data remain intact.
Closing restores exact original material clipping values. Materials discarded by
streaming release their section receipts; disposal removes both possible small
section-room families. New lighting variants inherit the clean source state and
acquire the cut only while it is open. Shadow clipping shares the same planes.
No extra scene timer, render target, photographic pixels or source fetch exists.

## Public architectural evidence

Checked 5 November 2026:

- [Bundestag architecture](https://www.bundestag.de/besuche/architektur/reichstag/architektur/)
  establishes the central full-height chamber, west foyer, visitor steel bridges,
  and blue plenary, green visitor, burgundy presidial and grey group-level codes.
  Public reference photographs are credited there to DBT/Erfurt, DBT/Huthmacher,
  DBT/Simone M. Neumann and DBT/Jörg F. Müller. No image is redistributed.
- [Bundestag building use](https://www.bundestag.de/besuche/architektur/reichstag/nutzung)
  distinguishes the presidential and parliamentary-group levels and visitor
  circulation. This is not an internal measured room plan.
- [Bundestag seating reference](https://www.kuppelkucker.de/entdecke-den-bundestag/wer-sitzt-wo-im-plenarsaal)
  and the [Bundestag's public parliamentary booklet](https://webarchiv.bundestag.de/archive/2007/0307/interakt/infomat/grundlegende_informationen/downloads/einblicke_pdf.pdf)
  establish the raised central president/secretaries, lectern, stenographers,
  distinct government/Bundesrat desks, blue seating, interior flags and clock
  displays. Historical booklet images do not establish current party positions.

The existing 630 illustrative member chairs and visitor seats remain. New chair
backs at the presidium, continuous government/Bundesrat desks, microphones,
internal flags, clock cues, foyer ribs and lift landing frames refine the public
room. Rib geometry clears the complete existing eight-flight stair in both
families. Internal flags are distinct from the erroneous detached external
basement-window fittings removed in v289; none of those fittings is restored.

Five exhibit floor levels retain the complete measured main source ring and all
six original courtyard holes. Public-room/stair/dome light-well air is subtracted
at every level. Drawn slabs use those complete polygons; native slabs use an
independent cardinal contained-cell construction. Colour-coded reveals and a few
tables convey level use. Level heights, furniture, small fittings and subdivisions
are **display estimates**, not a surveyed or complete inventory of private rooms.
These closed functional wings gain no invented walk-through collision exemption.
The existing dome, all 360 mirrors and both complete 230 m visitor routes remain.

## Lawn

The exact existing Platz der Republik lawn and overlapping road polygons come
from retained `surface-polygons.json` (© OpenStreetMap contributors, ODbL).
Only their exact intersection with the padded lawn bounds is stored for compact
path exclusion. The terrain sampler and every original park/road surface remain.
Deterministic short mown-grass tufts sit just above the represented ground, with
half-metre edge clearance. No new hills or surveyed blade positions are claimed.
Drawn touch/desktop detail is identical: 7,142 clumps / one texture-free mesh.
The independent native reading has 2,964 small cardinal clumps / one cube batch.
There is no animation, terrain replacement, geographic expansion or new tour stop.

## Checks

`reichstag-section-v318.test.ts` checks finite clipping, exact material restore,
newly attached families, clone/mode lifetime, disposal, source-buffer identity,
all six courtyard openings, cardinal blocks, null terrain and grass bounds.
The existing v295 suites additionally traverse the actual public entrances,
every stair, both dome routes and full native world. The Python check proves
complete equality of the retained lawn and bounded road exclusion union.

## Lossless package storage

Six finite eager fields in the existing court/park, legacy-fitting and canopy
modules and the new Treptow receipt use the established gzip/base85 reader for
source literals. All values, full published197 source files, ordinary writable
data descriptors, eager timing and strong named-export identity are preserved.
No lazy/weak reclassification or new codec is introduced. The focused production
transform proof saves152,984minifiedliteralbytes and checks full decoded equality,
negative zero and exact path scope. This offsets new detail inside the unchanged
894MiB offline ceiling. Final package bytes are measured separately.
