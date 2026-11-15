# Cemetery routes and religious-site accounting — V347

This pass adds actual mapped routes on retained cemetery ground. It does not
claim that every church, synagogue, mosque or temple in Berlin has received an
individual photographic reconstruction.

The retained Berlin extract dated 13 November 2026 provides 1,227 mapped site
and point records, 235 cemetery grounds and 6,218 associated paths, entrances,
boundaries and grave records. These are source records, not counts of distinct
institutions. The state-boundary-clipped inventory and per-site accounting are
stored in `sacred-places-v347-inventory.json.gz` and
`sacred-places-v347-evidence.json.gz`. A worship point is explicitly distinguished
from a measured building or campus polygon. Missing denomination is not inferred
from a building's appearance.

## Represented routes

1,706 mapped paths contribute additional surface patches at 81 cemeteries,
across 139 existing ground hosts and 275 nonempty mode variants. The rest remain
explicitly unmodified: lack of ground support, already detailed surfaces and
unverified widths are recorded rather than filled with invented paths.

Each new patch lies within both the cemetery boundary and original navigation
ground. The compiler samples only literal horizontal source triangles of the
retained ground/path materials. New routes sit two centimetres above that exact
surface; there is no guessed flat plate across a hill. Existing buildings,
water, bridges and projected finer additions are excluded. Native geometry uses
only fully supported half-metre cardinal cells. Tagged surface materials take
precedence; unknown materials use an explicitly estimated muted gravel colour.
Tagged widths take precedence over documented class-based display estimates.

Every original terrain/building/tree mesh, source route, line and navigation
record remains unchanged. The new recipes use the existing per-tile weak
construction format and are released with their tiles. The already full Native
host `4_-3` uses a normal small companion packet in both families; no existing
detail is displaced to make room. The complete inherited mesh and memory limits
remain fixed. Mobile and desktop request the same Drawn geometry.

The source accounting records prior V326 network recipes that already declined
their hosts before V347. These pre-existing mismatches are not silently counted
as repaired. Existing individually authored cemeteries, including Weißensee,
Schönhauser Allee, Grunewald-Forst and Dorotheenstadt, remain retained.

## Sources and verification

- [OpenStreetMap / Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin.html),
  © OpenStreetMap contributors, ODbL 1.0; exact source SHA-256 in the inventory.
- Official Berlin state boundary, retained source from Geoportal Berlin,
  dl-de/zero-2-0.
- `scripts/sacred-places-v347.test.ts` exercises every actual manifest URL in the
  production predecessor chain, unchanged older geometry/navigation, idempotence,
  altered-host rejection, horizontal patch support and unchanged packet limits.

No photographic image assets, invented grave names, generic crosses or guessed
religious symbols are included in these route additions. The two separately
photo-referenced named graves have their own evidence and ground-support tests.

## Independent emitted-geometry review

`scripts/review_sacred_ground_v347.py` checks every emitted path packet, including
the full-host companion. All 275 packets and 286,307 triangles passed: cemetery
polygons and original navigation ground; the literal original horizontal floor
at the correct height; actual mapped-width path strips within centimetre
quantization; existing obstacle and admitted finer-fitting exclusions; and
cardinal Native outline edges. No original mesh is retired. The compact result
is `geo_data/regierungsviertel/sacred-ground-v347-independent-review.json`.
