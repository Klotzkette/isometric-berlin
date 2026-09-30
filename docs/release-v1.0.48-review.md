# v1.0.48 — Schloss corridor and eastern outline preview

Step 10 adds the specifically requested architecture and initial eastern
recognition shapes. The owner explicitly named Alexanderplatz station,
Fernsehturm and Rotes Rathaus, authorizing a narrow **0.308 km²** additive
boundary lobe. All previous area and the **93-stop catalogue** remain.
The archived task-13 overview and full source datasets retain their projection;
the three new places are a preview, not an assertion of complete eastern-city
coverage. See [bounds](bounds.md).

## Architecture and evidence

- Friedrichswerdersche Kirche has both measured towers, Gothic openings,
  belfries, tracery and pinnacles. Auswärtiges Amt has distinct old/new wings,
  retained courtyards, glass atria and open loggias. All **57 source parts** and
  the previous display records remain. [Sources](east-civic-v148.md).
- Russian Embassy renders all **16 original source parts**, including its real
  roofs. Its authored lantern is on the front central risalit, rather than the
  rear chimney. The Altes Museum gains Ionic volutes, corrected entablature
  projection and the separate **bronze** Löwenkämpfer/Amazone groups at their
  exact mapped anchors. [Sources](embassy-altes-v148.md).
- DHM keeps **11 source parts**: Zeughaus, glass-covered Schlüterhof and the
  Pei extension with a transparent cylinder and **108 helical stair treads**.
  Gorki gains referenced griffin/lyre reliefs and capitals.
  [Sources](dhm-gorki-v148.md).
- Alexanderplatz station and Rathaus keep their complete measured envelopes,
  including the station hall and three Rathaus courts. They intentionally have
  no additional facade decoration. The television-tower LoD2 source is visibly
  generalized into a broad cylinder, so its separate outline uses published
  shaft/sphere/antenna dimensions. Original sheets remain as evidence and do
  not create a second visible/collision cylinder.
  [Outline dimensions and offline preparation](east-outline-cache-v148.md).

Nine new external photo credits extend the two corresponding Wikimedia
attribution inventories from **337 to 346**, without modifying previous records.
Photographs remain reference-only; no new runtime textures or remote assets.
The separate five-record Kindertransport attribution manifest is unchanged.

## Streets and preservation

`build_schloss_east_streets.py` extracts current OSM motor roads and pedestrian
ways only inside the requested corridor. Its width precedence is mapped width,
mapped lanes, then the existing road-class estimate. Existing detailed street
triangles retain ownership. The additive supplement contains **56,320.602 m²**
of carriageway and **95,300.376 m²** of mapped pedestrian surface before cm
storage. River and building footprints stay excluded. A neutral backing under
the new outline area is explicitly presentation-only.

The restored-road cache subtracts the exact new surface triangles, keeping its
source-area/ownership/triangulation accounting; it never cuts out a rectangular
neighbourhood. Native streets use disjoint top-cell runs and no hidden fill.

Original v141/v146/v147 appearance fixtures remain. New v148 overrides cover
only the expressly changed models. Independent HEAD comparisons prove the Dom,
granite bowl, four other Unter-den-Linden building families and their fine
layers unchanged. The two Altes bronze groups are delegated exactly once.

## Independently measured native worlds

| Profile | Instances | Draws | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| v147 full | 3,904,547 | 162 | 302,234,241 | `4725f688316f57506e3d269e9531948615545e85e49a4716c2bbb67fd4a42794` |
| v147 mobile | 1,141,809 | 160 | 91,816,697 | `c011fe412b8e91120508643d2e873106c80e8ab2f63dd209a8a839f4f05b6537` |
| v148 full | 3,995,398 | 168 | 309,142,997 | `f738dcae331cd5e1294d8b310357b6bcc2af90e054bd90e1a0d5c18bf97de229` |
| v148 mobile | 1,242,109 | 166 | 99,443,577 | `13ebd55296c35f96118366a2949694062cb9da9c937f4713c8544154ab620b56` |

Both add six draws. Full adds 90,851 instances / 6,908,756 bytes; mobile adds
100,300 / 7,626,880 bytes. Source-complete replacements remove only duplicate
old generic columns/panes. Cooperative construction must match the independent
synchronous baselines exactly. These are buffer measurements, not an iPhone
peak-memory or frame-rate guarantee.

## Validation

- All **486 Python tests pass**.

- Production TypeScript/build, Ruff formatting/lint and whitespace checks pass.
- Package generation, release readiness and a real local-package HTTP smoke pass.
- A broad frontend run executed 2,299 tests: 2,290 passed; seven old expected
  geometry/staging fixtures and two imports cached before the TV correction
  failed. The affected fixtures were updated from independent measurements.
  All affected files subsequently pass: 166 final focused tests, the native
  world/construction checks and the final eight lifecycle tests.
- Navigation adds seven focused tests and retains the existing 108-test
  navigation/recovery/museum integration coverage. AA glass landing, clear
  canopy passages, solid posts, Embassy courts, DHM courtyard and radial TV
  collision are explicitly checked.
- The street supplement and regenerated road cache pass nine source-area,
  scope, disjoint-cell and ownership tests. cm triangulation no longer drops
  pavement polygons accompanied by zero-area seam lines. Offline regional
  overlay pruning changes no represented area.
- Desktop Chrome and iPhone-13-profile WebKit completed all five visual modes
  at three new-area poses: **30 states**, one visible representation each,
  no page exceptions, failed requests or HTTP errors. WebKit's existing
  ignored `interactive-widget` viewport warning remains harmless. Three final
  desktop poses additionally rechecked the rebuilt streets, Embassy and Altes.
  WebKit emulation is not a physical iPhone crash/performance test.
- Final Altes review found depth interference from overlaid flute strips. A
  closed 24-groove shaft replaces those overlapping faces. The final 132
  affected checks pass, including watertight edges and unchanged native
  fingerprints. The same integrated Chrome camera is clean at day and night.
- Independent final review found no source-preservation or metadata blocker.
  The final production build, rebuilt download package, readiness check and
  local-package HTTP smoke pass after the shaft correction.
