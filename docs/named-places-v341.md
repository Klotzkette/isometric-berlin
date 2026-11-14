# Named places: fine-detail continuation v341

This pass covers the requested government-quarter surroundings, Europacity,
Gymnasium Steglitz and Gymnasium Tiergarten, Alexanderplatz, Savignyplatz,
Karl-Marx-Straße, Karl-Marx-Allee, Kurfürstendamm/Tauentzienstraße, Zoo Berlin,
Tierpark Berlin and Gärten der Welt. Existing measured buildings, detailed
recognition models, roads, ground, trees and navigation remain authoritative.
It adds finite local refinements; it is not a new survey of these whole districts.

## Government-quarter lawns

The ten Ehrenhof lawn islands use the same quadratic curves as the retained
Chancellery lawn plates, themselves traced from Berlin's DOP 2025 spring
orthophoto. Small tufts remain inset from their curved edges. The Native recipe
places independent cardinal short cubes on the existing 2 m lawn cells.
The Chancellery's entrance canopy, thin fence, green climbers and Chillida
sculpture stay unchanged; lawn detail does not create a walking obstruction.

The two Pariser Platz formal gardens gain short green texture within the
existing lawn plates, outside the fountain basins, flower borders and topiary.
The [Berlin heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010204)
describes the two formal garden beds, lawn, flower borders and clipped yews.
No monumental stone colour, column, relief or Quadriga is replaced.

Platz der Republik gains a complementary, fine grass pattern on the existing
terrain. The earlier v318 lawn ring and road exclusion continue to govern every
placement. All original grass and paths remain. Summer greens follow the
owner's requested season; 6–13 cm grass heights and tuft spacing are display
estimates, not measured planting data. No photographic texture is distributed.
Each view family adds one static batch without animation or per-frame work;
touch devices receive the same detail as desktops.

## Architecture and parks

The detailed regional reports contain the primary references, admitted source
owners, estimated dimensions and preservation checks:

- [Zoo, Tierpark and Gärten der Welt](zoo-garden-details-v341.md).
- [Schools, Savignyplatz and City West storefronts](west-schools-v341.md).
- [Alexanderplatz, Karl-Marx-Allee, Neukölln and Europacity](eastern-sites-v341.md).

The two zoos and the Korean Garden use six existing surrounding-city packets.
Their unchanged meshes and navigation remain byte-for-byte equal after decode.
There are no new coverage descriptors, runtime imagery requests or external
GitHub packet fallbacks. All six visual styles, including Versunken, remain.

## Validation and delivery

Release v1.0.221 was built on 14 November 2026. Type checking and the full Vite
production build pass. Executed focused checks include 30 eastern/Europacity
tests, 27 western/school tests, five actual lawn-support tests, nine historical
source reconstruction tests, 28 retained government/civic tests and four Python
source/packet tests. Ruff and `git diff --check` pass. The full historical
reconstruction retains every byte comparison with a 120 s test timeout because
this host needs approximately 43 s; runtime limits are unaffected.

The complete extracted local package is **1,169,957,692 bytes**, just **372,317
bytes** above v1.0.220 and within the unchanged 1116 MiB offline allowance.
Standard release readiness and the local HTTP package smoke check pass. The
prepared Pages tree contains all **5,754** same-origin packets, all six styles
and the complete current asset closure, totalling **940,465,151 bytes**. Only
six existing packet descriptors change; the full remaining manifest is exact.

The initial concurrent type/build attempt exhausted local resources. The final
type check and build ran separately and completed successfully. Only local
published v219/v220 archive duplicates with independently matching GitHub
SHA-256 digests were removed; the complete extracted v220 site remains for
rollback, and all GitHub releases/source history remain intact.

Browser visual review remains unverified: the permitted internal browser
reported a locked host Mac at both attempts. No external browser was launched
and no browser endurance or speed benchmark is claimed.
