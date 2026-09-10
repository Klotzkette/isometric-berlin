# v1.0.16 review and verification

Pipeline step 10. Replace the displaced generic Charlottenburger Tor blocks
and add the four missing neoclassical pedestrian-tunnel gatehouses around the
Siegessäule.

## Corrected geometry

The earlier Charlottenburger Tor model placed two 20 m blocks east and west
along the road. The real gate consists of two broad colonnaded wings north and
south of it. The replacement preserves the landmark anchor, uses the published
34 m road opening and adds end pylons, four columns per wing, entablature,
attic relief cues, Friedrich I and Sophie Charlotte figures, and restrained
roof groups.

Four separate OSM civic footprints now own the Großer Stern tunnel entrances:
ways `106952577`, `106952579`, `106953928` and `106953934`. Their projected
centres, two-level identity and hipped-roof tags are retained. Each house has a
visible tunnel mouth, four-column portico, pediment, hipped roof and stair
flight. The local OSM park-path ground replaces the initially reused lower
Siegessäule platform level.

See the [source contract](charlottenburger-tor-tunnelhouses-v116.md) for facts
versus procedural display subdivisions.

## Validation

Orthographic QA used actual Three.js triangles. It caught the ground mismatch
and a transform-order error that over-scaled the hipped roofs; both were fixed
before the final run.

- Complete frontend: all 1,821 tests passed across 230 files, with 7,030,536
  assertions (312.39 seconds).
- All 361 Python tests passed on the final package (35.08 seconds). Ruff
  formatting and lint passed.
- TypeScript, production build, release readiness and the local-package smoke
  test passed.
- Existing street, water, terrain, underground-path and five-mode integration
  tests passed. No source records, catalogue places or bounds were removed.

The downloadable ZIP is 36,301,693 bytes; the viewer archive is 35,721,441
bytes. Their SHA-256 checksums are supplied in `SHA256SUMS-v1.0.16.txt` with
the GitHub release.
