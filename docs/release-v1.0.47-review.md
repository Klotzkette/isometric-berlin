# v1.0.47 — Unter den Linden and Museum Island

Step 10 refines the requested avenue and museum sequence without changing the
central-Berlin boundary or the 93-stop catalogue. The release retains the
original source records, complete official building parts, roof surfaces and
courts. Four drawn modes share full detail on pointer and touch devices;
Minecraft has separate bounded native models.

## Scope and evidence

- Russian Embassy, Aeroflot / Russian Trade Mission, Haus Pietzsch / Einstein
  and Komische Oper retain 21 original LoD2 parts and their previous display
  prisms. The embassy and Aeroflot details now face their actual street edges.
  The existing Komische Oper receives all 51 official wall/roof sheets; future
  redevelopment is not presented as built. The ambiguous owner phrase
  “Hoflatt-Gebäude” was provisionally interpreted as Aeroflot, and that
  assumption was communicated before release.
- The avenue surface extends eastward to the western Schlossbrücke approach,
  keeping original western parcels, median polygons and mapped widths. Five
  station-owned patches contain exits A–E, three adjacent escalators and two
  lifts. Shared mouth coordinates, finite barriers and tread heights prevent
  generic ground or road surfaces from sealing the stairs. Native street tops
  retain five material classes in 2,574 runs covering 81,517 one-metre cells.
- Kronprinzenpalais, Prinzessinnenpalais and their connecting architecture keep
  all 17 official parts across three parents. Friedrich II remains at the
  exact existing OSM anchor with a source-referenced 13.5 m silhouette, relief
  registers, rider, enclosure and four lamps; its former generic monument is
  delegated to this one model.
- The Schloss dome, lantern and documented roof figures gain procedural
  recognition detail without replacing the existing complete source envelope.
- Altes Museum, the granite bowl, Alte Nationalgalerie, Pergamonmuseum and
  Bode-Museum gain bounded material and architectural details. Existing Dom,
  Neues Museum and Grill Royal geometry remains. James-Simon-Galerie adds all
  eight official source parts, open colonnades, recessed glazing and three
  stair flights with shared walking/collision geometry.

Measured envelopes and mapped identities remain distinct from estimated
window, ornament and member subdivisions. No new runtime photographs, textures
or remote model requests are introduced. All 328 previous image credits remain;
nine new individually licensed references bring both matching manifests to 337.

Detailed provenance and limitations are recorded in
[avenue architecture](unter-den-linden-v147.md),
[street and station ownership](unter-den-linden-streets-v147.md),
[palais and Schloss](palaces-udl-v147.md), and
[museum sources](museums-v147.md).

## Historical preservation baseline

The independent v1.0.46 synchronous Minecraft baseline is retained here; the
v147 measurements must match cooperative construction byte for byte.

| Profile | Instances | Draws | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| v146 full | 3,884,892 | 156 | 300,644,149 | `847ccd8f1de5e7a6656cb1e7ddd8339514d55f99d8183401035854b7fd0d0c9f` |
| v146 mobile | 1,119,756 | 154 | 90,044,357 | `c2e3f3d1ffe912f702668fa045e5c3c658202a6af19b0e7b696b0753129ae942` |
| v147 full | 3,904,547 | 162 | 302,234,241 | `4725f688316f57506e3d269e9531948615545e85e49a4716c2bbb67fd4a42794` |
| v147 mobile | 1,141,809 | 160 | 91,816,697 | `c011fe412b8e91120508643d2e873106c80e8ab2f63dd209a8a839f4f05b6537` |

The full profile adds 19,655 instances and 1,590,092 bytes; mobile adds 22,053
instances and 1,772,340 bytes. Both add six draws, including one exact terrain
complement for the James-Simon foundation. These are constructed buffer
measurements, not a physical iPhone peak-memory or frame-rate claim.

Historical frozen appearance fixtures remain committed. New v147 overrides
cover only the expressly requested museum refinements. The unchanged canonical
source files and independently measured replacement accounting guard against
using a reduced-detail baseline as a performance shortcut.

## Validation

- All 479 Python tests pass. Ruff formatting/lint, TypeScript, production build,
  release readiness, local-package HTTP smoke and whitespace checks pass.
- The broad frontend run executed 2,282 tests. Its eleven failures were obsolete
  geometry/count baselines, source-obstacle membership and the staged lazy-module
  fixture after the requested additions. All affected tests pass after their
  independently measured fixture updates. A final 129-test geometry/preservation
  pass found one further old ground-run count after the exact foundation clip;
  the corrected test passes separately. A further 33 final architecture,
  navigation and lifecycle tests pass.
- Original source membership, roofs/courts, street ownership areas, all station
  mouth openings, column/passages and exact terrain complements have targeted
  numeric/raycast regression coverage. Historical appearance fixtures remain;
  v147 museum overrides account explicitly for newly requested geometry.
- Production Chrome and touch WebKit initially completed all five modes at five
  poses (50 states), with one appropriate visible representation and no missing
  new groups. The final focused browser rerun checks corrections found during
  that inspection. Touch WebKit emulates an iPhone 13; it is not a physical
  iPhone crash or performance test.

The visual review found and corrected two integration defects: coarse terrain
showing through James-Simon foundations, and old flat metal escalator surfaces
capping the new station stairs. The bounded James table replaces 184 intersecting
cells, preserving all 425.459 m² of exterior land and 44.538 m² of existing water
exclusion. Its separate native wall reading uses a 1.1 m member thickness on the
same exact source centreline to cover exterior terrain slivers; this does not
remove that terrain. The metal triangle cut preserves every outside remainder
and interpolated height, without changing the source records or adding a draw.

A complete-capsule check also caught the James stair void's former low ceiling;
the source-scoped opening and exact stair roof callback now agree. An independent
300-position check across all three flights preserves position and tread height
with no blocked capsules. The final 29 focused frontend tests (including both
independent/cooperative native signatures) pass. The last native wall adjustment
keeps these budgets unchanged; all 14 affected museum/construction tests pass
again against the final signatures above.

The final production bundle `ThreeViewer-B9vYkDzO.js` passes sixteen focused
Chrome/touch-WebKit states: Day and Minecraft at the avenue, museum overview,
James-Simon close view and station close view. All expected groups are present
exactly once, with no opposite-mode duplicate, page errors, failed requests or
HTTP errors. The screenshots confirm open station treads and the corrected
native wall/bank transition. WebKit reports only its existing ignored
`interactive-widget` viewport key. Final release readiness and local-package
HTTP smoke pass again against that exact bundle.
