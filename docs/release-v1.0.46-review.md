# v1.0.46 — Gendarmenmarkt perimeter and historic Charité

Step 10 details sixteen building groups around Gendarmenmarkt: Dentons,
Einstein Kaffee, Hilton, BBAW, Quartier 205 with Newton Bar, Quartier 206,
Borchardt, Lutter & Wegner, HfM Hanns Eisler, Hotel Luc, Erdinger and the
remaining northern/eastern office fronts. Original official geometry supplies
152 complete parts from 30 parents; 216 exact street fronts receive referenced
materials, window registers, arches, balconies, entrances and lettering.
The 109 former display prisms are preserved verbatim as source records.

The Charité extension covers 146 historical source parts across eleven named
families, plus a corrected Helmut-Ruska-Haus facade on six retained parts.
Building identity follows the campus map and dated photographs. The formerly
misidentified postwar facade is replaced with its historic plaster/brick rhythm.
No source envelope is removed. Four modern link parts retain their existing
modern treatment. See [Gendarmenmarkt sources](gendarmenmarkt-perimeter-sources-v146.md)
and [Charité sources](charite-historic-facades-v146.md) for evidence, addresses,
credits and the distinction between measured geometry and estimated facade detail.

The four drawn modes share full detail on desktop and mobile. Minecraft uses
separate source-bound wall/roof skins and cube-based facade details. Native
Charité windows are tested against actual former voxel columns, preventing
coarse walls from swallowing the new panes. Gendarmenmarkt replacement covers
both previous and official footprints. Three source court rings are open to the
sky; the fourth has an original overhead roof, with walking clearance beneath.
All source rooftops and the 93-stop catalogue are retained. No runtime photo
textures, remote assets or new controls are introduced.

Geometry budgets before the existing static compaction pipeline:

| Added group | Draws | Instances | Buffer bytes |
| --- | ---: | ---: | ---: |
| Drawn Gendarmenmarkt complete source shells | 17 | — | 428,868 |
| Drawn Gendarmenmarkt facades | 41 | 28,799 | 2,245,748 |
| Native Gendarmenmarkt shells | 1 | 20,641 | 1,569,364 |
| Native Gendarmenmarkt facades | 32 | 21,578 | 1,650,296 |
| Drawn historic Charité facade extension | 1 | 39,067 | 2,969,740 |
| Native historic Charité facades and source skins | 3 | 15,184 | 5,515,468 |

Independent synchronous Minecraft measurements, including duplicate removal:

| Profile | Instances | Draws | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,884,892 | 156 | 300,644,149 | `847ccd8f1de5e7a6656cb1e7ddd8339514d55f99d8183401035854b7fd0d0c9f` |
| Mobile | 1,119,756 | 154 | 90,044,357 | `c2e3f3d1ffe912f702668fa045e5c3c658202a6af19b0e7b696b0753129ae942` |

Compared with v1.0.45, full adds 35,228 instances and 7,049,828 bytes; mobile adds
52,956 instances and 8,397,156 bytes. Both add 36 draws. These are constructed
buffer figures, not a claim about physical iPhone peak memory or frame rate.

Validation:

- All 469 Python tests pass. Ruff, TypeScript, production build, release
  readiness, local-package HTTP smoke and whitespace checks pass.
- The broad frontend run executed 2,256 tests. Its nine failures identified
  obsolete appearance/count fixtures and a missing new lazy-module test mock.
  All nine affected tests pass on rerun after the independently measured baseline
  updates and mock completion. In total, 51 focused frontend tests pass on the
  final code, covering the new models, lifecycle, navigation and appearance.
- Drawn and native pane raycasts, finite bounded geometry, complete source
  membership, original roofs/courts, native replacement coverage and covered
  courtyard walking clearance are checked by focused tests.
- Production Chrome and touch WebKit complete all five modes at both
  Gendarmenmarkt and Charité, with exactly one appropriate visible representation,
  no page errors or failed/HTTP requests, and inspected screenshots. WebKit
  reports its existing ignored `interactive-widget` viewport key. Touch WebKit
  emulation is not a physical iPhone test.
- A final optional-source guard keeps generic native panes when a source
  replacement was not supplied. The subsequent TypeScript and four cooperative
  construction tests pass with unchanged independently measured buffers.
- An independent final source/integration/metadata review found no blockers.
