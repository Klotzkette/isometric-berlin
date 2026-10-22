# U6 Naturkundemuseum / Brandenburger Tor — v261

Seven retained OSM stair axes now have source-bound descending treads, side retaining walls, handrails, a finite lower landing, blue signs with ivory U and geometric station lettering. Naturkundemuseum is on **Chausseestraße / Zinnowitzer Straße**, roughly 300 m from the museum, not at its door. Brandenburger Tor has contemporary stainless/glass balustrade interpretation; Naturkundemuseum uses a green metal portal interpretation.

## Evidence and limits

Accessed 22 October 2026:

- [BVG Naturkundemuseum](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-naturkundemuseum), U6 station identity.
- [Museum für Naturkunde visiting information](https://www.museumfuernaturkunde.berlin/besuch-planen/), distance from the museum to the station.
- [Landesdenkmalamt Berlin, object 09011090](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011090), station street location and historical station context.
- [BVG Brandenburger Tor](https://www.bvg.de/de/verbindungen/stationsuebersicht/s-u-brandenburger-tor), U5 and shared S/U station identity.
- [BVG station plan, 9 April 2026](https://www.bvg.de/dam/jcr:fad48f37-4fd1-4c7b-b9ea-619afc5d29e3/brandenburger-tor%20900100025.pdf), four exits A–D.
- [S-Bahn Berlin press gallery](https://sbahn.berlin/en/about-us/press/press-photos/the-s-bahn-in-berlin-1/?cHash=2874d902a0572dab991199a92c2b0ae5&tx_sbbpressgallery_list%5BcurrentPage%5D=4), photo “Brandenburger Tor — Eingang zum Bahnhof, S- und U-Bahnsignet”, © David Ulrich / S-Bahn Berlin GmbH. The inspected small preview shows stainless/glass balustrades and a blue U sign. **Reference only; no image is redistributed or embedded.** No photographic survey of every portal is claimed.
- © OpenStreetMap contributors, ODbL 1.0. Complete selected way versions, WGS84 endpoints, source tags and original acquisition hashes are retained in `geo_data/regierungsviertel/ubahn-entrances-v261-source.json`.

| Station / ref | OSM way | Entrance node | Retained step count |
|---|---:|---:|---:|
| Naturkundemuseum A | 378664942 | 3820796423 | 29 |
| Naturkundemuseum B | 378664945 | 3820796420 | 27 |
| Naturkundemuseum C | 378664941 | 2946490672 | 27 |
| Brandenburger Tor A | 43051201 | 539321761 | 26 |
| Brandenburger Tor B | 373292154 | 3767875666 | 26 |
| Brandenburger Tor C | 43051202 | 539321774 | 23 |
| Brandenburger Tor D | 1169204817 | 5234611317 | 12 |

Positions use EPSG:25833, x=easting−389500, z=5820000−northing. The existing ground context supplies top heights. Source `step_count`, incline direction, IDs and axes are preserved; 2.3/2.5 m widths, 17 cm risers, 40 cm lower landing, portal fittings, sign positions/sizes and glass colour are explicitly **display estimates**, not surveyed dimensions. The user requested the blue/ivory U treatment. Stairs remain stairs even when a station entrance tag also indicates wheelchair access; no ramp or accessible route is invented. Negative-level links are not promoted into streets. No platform or underground continuation is inferred.

## Geometry, memory and navigation

Seven static, final-count instanced batches per active mode; no textures, alpha sorting, animation, network requests, camera-dependent detail or touch-detail reduction. Minecraft independently samples the measured axes into orthogonal short blocks, including cardinal sign boards and pixel lettering; no smooth model is drawn underneath. Geometry is rebuilt from retained source only, with no downloaded imagery required.

`UbahnSurfaceAperturesV261.ts` removes only the seven mapped mouth envelopes from known ground owners. Original source files remain unchanged; unaffected vertex/index data and outside pavement fragments are retained with their attributes and original elevations. Native openings are quarter-metre orthogonal envelopes. Surface descendants arriving later from the worker must pass through the same cutter.

The top approach is open. Only the represented two sidewalls and closed lower landing collide. `ubahnV261FloorAt` supplies descending tread heights and a finite lower floor; walking can return up the same staircase. It does not teleport to a schematic railway shaft.

## Required root integration (shared files intentionally not edited here)

1. `RequiredSiteEnvelopesV209.ts`: import `createUbahnEntrancesV261` and `cutUbahnPresentationV261`. In the required site steps, add `root.add(createUbahnEntrancesV261(native))` once. Near `cutRosenthalerPresentationV228(root,native)`, call `cutUbahnPresentationV261(root,native)` **after the base ground and district/native avenue surfaces exist**. This cutter handles the Tor avenue’s specific replacement mesh names as well as generic ground slabs.
2. `ThreeViewer.tsx`: import `ubahnV261FloorAt`, `ubahnV261SolidAt`, `cutUbahnPresentationV261`. At every existing Rosenthaler solid check, add the U-Bahn solid check with the same x/y/z/radius and native flag. At both Rosenthaler floor sites, evaluate U-Bahn floor before generic terrain, returning non-null results including zero. In worker surface attach, run `cutUbahnPresentationV261(object,false)` alongside the Rosenthaler cutter before materials/interleaving.
3. If required site creation is installed earlier than district surfaces, call the cutter after `createDistrictStreets` and after native `createUnterDenLindenBlockStreets` have been attached. The instanced cutter is idempotent. Do not trim unrelated streets or source features.
4. `UBAHN_BARRIERS_V261` supplies finite sidewall/lower-wall segments if the shared navigation index requires segment obstacles; the per-sample `ubahnV261SolidAt` is sufficient at the existing Rosenthaler collision call sites. Do not add a fourth barrier across the upper approach.
5. Add the small source attribution/reference entry and release/manifest records in root-owned shared files. Existing budgets, tour count and camera settings stay unchanged.

## Validation

- `uv run python scripts/build_ubahn_entrances_v261.py`
- `uv run pytest tests/test_ubahn_entrances_v261.py`
- `uv run ruff check scripts/build_ubahn_entrances_v261.py tests/test_ubahn_entrances_v261.py`
- `bun test ./src/app/tests/ubahn-entrances-v261.test.ts`

Tests cover deterministic retained-source reconstruction, real endpoint IDs/counts, visual tread/walking-floor agreement, return approach, finite end barrier, native orthogonality, precise ground apertures and preservation of unrelated pavement and original vertex attributes. No external browser or browser automation is used.

Measured added static instance buffers (matrix + colour, exclusive of shared unit-box geometry): drawn **1,958 instances / 148,808 bytes**; native **7,488 / 569,088 bytes**. Runtime source JSON: **4,778 bytes**; preserved source evidence: **7,942 bytes**. Existing city residency limits are untouched.

Regression additionally ray-tests both ivory U faces in both modes, and the **actual** `createDistrictStreets` / `createUnterDenLindenBlockStreets` outputs after aperture cutting. All four Tor mouths remain open. The old Unter-den-Linden station regions are x=1140–1284, z=224–356, over 400 m east of these Tor entrances (x≈576–727); its floor helper returns null at all seven new mouths, so none of that existing station geometry is replaced.

Shared-file insertion anchors at authoring time: `ThreeViewer.tsx` solid paths 1764 / 3776 / 4697; floor paths 3853 / 4748; worker surface arrival 3411; `RequiredSiteEnvelopesV209.ts` near the Rosenthaler cutter around line 80. Prefer symbol anchors over line numbers as other v261 changes move lines.

The final visual QA caught mirrored station text. Both face layouts now follow
the viewer's right axis (`view direction × up`) rather than the sign's positive
across-axis. The focused test projects actual stroke/pixel instance centres into
that independent camera basis for both station names, all seven signs, both
faces and both modes. The subsequent plaque-fit check is recorded below; 10 U-Bahn runtime tests pass.

The final plaque-fit correction scales each complete name to its existing
board width with 12 cm horizontal margins, rather than enlarging the board.
Brandenburger Tor now uses a 100.86 mm cap height on its 2.35 m plaque;
Naturkundemuseum uses 118.98 mm on its 2.66 m plaque. Both are vertically
centred. Tests bound all eight corners of every actual text-stroke/pixel
instance on both faces, so reverse-side text cannot protrude. Drawn count
remains 1,958 / 148,808 bytes; the smaller native text uses 7,461 instances /
567,036 bytes.

A native-only stepped crossbeam now follows the original Naturkundemuseum
portal-post axis at base + 2.76 m, joining both posts to the cardinal plaque.
Three nine-block spans add 27 native instances; final totals are **7,488 /
569,088 bytes** native and **1,958 / 148,808 bytes** drawn. The support test
samples each full span including both post centres and the central plaque
attachment. All 11 U-Bahn tests pass. Drawn geometry is unchanged.
