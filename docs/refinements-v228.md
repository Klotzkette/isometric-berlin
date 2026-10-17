# Hospitals, schools and Rosenthaler Platz — v1.0.128

Step 10 follows the owner's named-site request. This pass covers Charité Mitte,
Charité Benjamin Franklin, Vivantes Friedrichshain, DRK Kliniken Berlin Mitte,
Jüdisches Krankenhaus and the former Klinikum Prenzlauer Berg. It also refines
the Jewish gymnasium, Otto Weidt's workshop, Sophienkirche, Gymnasium Steglitz,
Gymnasium Tiergarten, and the identified Rosenthaler Platz shopfronts and U8 exits.

The spoken Osloer Straße hospital is resolved to DRK Kliniken Berlin Mitte,
Drontheimer Straße 39–40, close to Osloer Straße. The Fröbelstraße site is labelled
as the former Prenzlauer Berg hospital, not a currently operating Vivantes clinic.
Vivantes Friedrichshain supplies the named active Vivantes campus in this pass.

Retained official Berlin geometry remains authoritative. Where official LoD2
retrieval returned HTTP 503, mapped OSM building parts and their tagged levels
provide explicitly estimated heights. Benjamin Franklin's missing upper wings
are added above the existing retained podium; no source body is silently erased.
DRK Mitte and the Jewish hospital receive their mapped building-part envelopes.
The Sophienkirche's documented tall tower receives a bounded recognition model;
its detailed profile is an estimate, not a newly measured LoD2 reconstruction.

See the individual source, scope and estimate records:

- [Hospital campuses](hospitals-v228.md).
- [Schools and culture](school-culture-v228.md).
- [Rosenthaler Platz](rosenthaler-v228.md).

## Stair openings and walking

Four retained OSM axes and step counts place the U8 entrances. Their clear width,
riser heights and finite lower landings are explicit display estimates. Surface
cuts apply only to established terrain/paving owners at these four mouths.
Outside complements preserve source height and paint; old vertex attributes and
unaffected index triples remain exact. Native openings use independent
quarter-metre orthogonal boundaries. No broad replacement pavement is added.
Walking follows the same stair treads, leaves the upper approach open and
collides with the represented side and back walls.

## Resource lifetime and compatibility

New details use small, independently culled static batches, shared window
primitives and separate native construction. Constructor-only JSON arrays are
weakly held and are not retained on scene metadata. Required building bodies
attach before navigation publication. Existing live CPU/GPU residency budgets,
resolution, draw distance, mobile detail and the 93-stop tour stay unchanged.
No photographic textures, extra lights or animation loops are added.

The old v226 sidewalk constructor remains available unchanged for historical
preservation checks; production explicitly applies the new four-mouth cuts.
All unrelated source datasets and earlier architectural detail remain retained.

## Verification

- Full Python run: 1,331 passed, four skipped. The two initial failures were the
  deliberately unfinished version/package update; all 84 release/smoke checks
  passed after the synchronized v1.0.128 package was produced.
- Twelve additional v228 Python source/preservation tests passed. Ruff formatting
  and lint passed; frontend TypeScript and the production build passed.
- The focused viewer regression set passed 68 tests. The final v228 geometry,
  navigation, previous sidewalk and weak-JSON set passed 27 tests
  (1,273,305 assertions), including the native-tread raycast regression.
- Desktop production tour: 34 views, all twelve sites in drawn/native modes,
  plus night/snow/Schwellenraum/flood and return-to-day checks. Each new site was
  confirmed by actual render callbacks; no page errors or context losses occurred.
- The visual review caught mirrored school/workshop lettering, which was corrected
  and given an orientation regression. Native hospital walls/support now use
  actual block bounds rather than a smooth-footprint approximation.
- Late `restored-paving`/`restored-asphalt` source roots are also eligible for the
  same bounded four-mouth cut. An initial browser assertion wrongly required a
  changed late batch: inspection of the real NDJSON proves those triangles lie
  outside these mouths, so no-op is correct. A regression executes the actual
  restored-road constructor and checks preservation. Visible openings and walking
  are checked independently of modification metadata.

- WebKit iPhone 13 emulation: all 34 views passed, with no unprovoked context
  losses, and two deliberately forced GPU resets recovered. The later bounded
  native-tread correction received its own final checks.
  Tracked GL-buffer maxima were 160.67 MiB in this mobile run and 384.92 MiB in
  the desktop run; these are buffer counters, not total operating-system memory.
  Tests do not constitute a guarantee for every physical handset.
- The complete extracted local package is 876,219,393 bytes (835.628 MiB), within
  the unchanged 836 MiB archive limit. Local package smoke and release readiness
  checks passed; all 84 release/smoke tests passed on the final package.

The final stair ray checks exposed overly wide native tread bounding boxes at
oblique entrances. Transverse subdivision limits the cells to 0.32 m, retaining
six batches and the unchanged drawn model. Native instance/color data increases
by only 70,756 bytes to 231,344 bytes. 168 direct raycasts across all four stairs
and both modes agree with walking support within one 0.17 m step.

The final browser probe also identified real overlapping pavement from the
mixed outer-city packets `3_-3` and `4_-3` (`city` and `scheunenviertel-v168`).
A source receipt selects only the known low ground triangles; their four exact
openings are cut before buffer accounting, parking and publication. All old
vertex/color bytes and unaffected index triples remain unchanged. Superseded
exclusive scratch buffers are immediately released. Persistent growth is only
5,940–13,860 bytes per affected packet, without changing residency limits.

The focused existing surrounding-city, streaming, storage, attachment and walking
set passed 73 tests; 37 affected tests passed again after immediate scratch
release. Independent review checked 720 rays through constructed, parked and
restored packets: no covering pavement. All 557 new native boundary segments
were orthogonal, and 768 walking assertions passed across all four entrances.

The final production Chrome run explicitly waited for both affected surrounding
packets before testing. All four stairs descended and returned successfully in
both drawn and native modes, with 24 desktop rays and additional native touch
rays. There were no page errors, crashes or context losses. The browser was
closed after verification. Report: `/tmp/v228-rosenthaler-browser/report.json`.
