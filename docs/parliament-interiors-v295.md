# Public parliament interiors (v295)

The Reichstag and Berlin Abgeordnetenhaus have source-admitted public entrances,
recognisable plenary rooms and connected stairs. The complete room group is built
before an exterior aperture is admitted. `parliamentInteriorsV295` is default off
in all reusable factories and travels through the detailed world, distant coverage
and Worker construction. Runtime navigation follows the published world flag.

## Evidence and limits

Primary architectural references checked on 2026-11-02:

- [Bundestag: Reichstag architecture](https://www.bundestag.de/besuche/architektur/reichstag/architektur/): west public entrance, foyer and first upper-floor chamber, east presidium and visitor circulation.
- [Bundestag: dome](https://www.bundestag.de/besuche/architektur/reichstag/kuppel): public lifts, terrace, mirrored daylight cone, separate visitor ramps and observation platform. The existing complete dome retains its published 40 m diameter, 360 mirror panels, two 230 m ramps and 16.7 m platform rise.
- [Bundestag: seating](https://www.kuppelkucker.de/entdecke-den-bundestag/wer-sitzt-wo-im-plenarsaal): the chamber uses 630 blue display chairs, with lateral government benches. This is not a current party seating chart.
- [bpb, APuZ 1999 architecture account](https://www.bpb.de/shop/zeitschriften/apuz/archiv/538999/republikanische-lockerungsuebungen-der-umzug-nach-berlin-und-das-ende-der-angst-vor-der-baugeschichte/): chamber identity, slender supports, light and material reading.
- [Abgeordnetenhaus: architecture](https://www.parlament-berlin.de/das-haus/architektur), [official architecture text](https://www.parlament-berlin.de/media/download/541), [official public book](https://www.parlament-berlin.de/media/download/4784), [Berlin heritage inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004): central entrance, grand stair, Wandelhalle and first-floor plenary hall. The current hall photograph on printed pages 104–105 shows pale wood, dark seating, glazed clerestory/roof and visitor galleries.

No photographs, PDF pages or photo textures are shipped. Interior geometry is a
procedural architectural interpretation. Room extents, levels, desk coordinates,
stair subdivisions, lift fittings and viewing-lectern positions are explicitly
**display estimates**, not an internal measured survey. The Berlin room has a
40 × 36 m estimated bounding envelope; the published approximate floor area does
not establish those exact dimensions. Its estimated glass hip lies wholly inside
the clear central source strip and covers none of the six measured courtyards.
The reported source height of the Berlin house remains 3 m in the original file;
the existing 25/28 m exterior reconstruction remains identified as an estimate.

## Retained geometry and ownership

`ParliamentRetainedEnvelopeV295.ts` pins all four unchanged source records:
`K0002MCN`, `UbQkgNZe`, `ycOYQRVL` and `eaCxS2u2`. A changed or missing record
prevents world admission. Only the three exact Reichstag source records acquire
room, foyer, stair and light-well complements. Their original rings, six source
holes, heights, tones and complete JSON sheets are unchanged. Exterior triangles
and attributes outside the bounded apertures are retained. Unknown owners are
never opened by a landmark-sized bounding box.

The Abgeordnetenhaus keeps its measured outer plan and all six courts. Its old
estimated small glass-roof patch is replaced only when the complete estimated
plenary room is present. The remainder of the source-plan roof is retained. The
central authored public portal is cut independently of side portals. Unaffected
boxes retain the same shared geometry and instance transforms; intersected boxes
become exact complementary cuboids in the same batch. Only affected curved portal
fragments join the existing colour/normal shell batch. No full instance batch is
expanded into a city-sized triangle copy.

The shipped Reichstag dome, mirror panels, ramps, ribs and guard detail remain
unchanged. The estimated annular observation platform receives two bounded
terminal-ramp stair apertures so it cannot cut through a visitor's head. Every
outside platform fragment remains. The thick inner native dome cues keep exact outside complements. Only in the
complete opt-in transaction, the four estimated native platform bars (ten
original render blocks) yield to a continuous independent cardinal ring. Its
160 merged blocks share the represented floor top at 44.295 m and preserve
body-wide terminal-ramp headroom. The default factory is unchanged. All seven
opt-in landmark batches total 5,315 instances, below the unchanged 5,500 cap. The four coarse estimated native
mirror-cone cubes, whose square corners intersected the public ramp, are replaced
only in this opt-in transaction by 30 × 12 independent cardinal mirror facets.
Native visitor treads replace only
the old coarse ramp proxy after the full independent route has been constructed.
The ordinary closed factories and all six other native landmark batches remain
unchanged.

`parliament-native-v295-receipt.json` records 356 original voxel tuples. Each
complete 4 m cell is contained in the three-owner union, and every positively
intersecting source owner over its vertical range belongs to that family. Another
75 edge/foreign-owner cells are explicitly rejected. The runtime checks the entire
original tuple before clipping the displayed plinth/body/cap courses. Air is a
31-box cardinal union proved by polygon subtraction, so joins between rooms cannot
leave a solid raster seam. Full and mobile admit the same source courses. Source
caps and all remaining outside fragments retain their source palette.

## Circulation and collision

The west Reichstag doorway leads to the chamber and an eight-flight switchback
stair, then through a terrace corridor and the lower west dome doorway. The latter
has a bounded exception for the retired analytical native shell collision; the
new room solids and every other shell segment still collide. Both complete dome
routes rise continuously to the platform. The nearest reachable geometric ribbon
wins over a floor below or a neighbouring turn. Panorama lecterns, the daylight
cone, seats, desks, walls and rails have body collision.

The Berlin entrance hall connects to a double grand stair, Wandelhalle, chamber
and visitor-gallery stair. Apertures in the terrace/gallery floors leave actual
headroom over the last flights. Source collision exemptions are source-ID-bound;
the front Berlin wall admits only the represented central portal. The 1.8 m
standing capsule remains blocked at retained frontage beside it.

All public floors are above retained terrain: actual ground samples are 5.0 m at
the Reichstag west stair and approximately 4.89 m at the Berlin front stair. There
is no broad terrain deletion, basement ground cut, new animation timer, texture,
render loop, or mandatory tour stop.

## Memory and validation

The complete room/furniture/stair group uses one texture-free cube batch per
family, with unchanged static touch detail and the fixed native palette. The source-based
chamber reading includes twelve slender supports. Before release, the final counts and
bytes are checked in `parliament-interiors-v295.test.ts`; limits are 6,500 drawn
instances and 15,000 independent cardinal native instances. The exterior Berlin
house also remains within its existing 7/1 renderable, 270 kB drawn and 270/220 kB
native full/mobile allowances. The seven native landmark batches keep the 5,500
instance ceiling.

Validation includes exact original/foreign/changed-owner checks, independent
Shapely cell ownership, the six source courts and outside roof-area complement,
combined LoD2 + authored exterior + new interior mesh rays, every stair tread and
headroom, all 160 samples of both dome ramps, real pedestrian traversal on the
actual terrain and complete source obstacle index, native shell collision, and
full/mobile native-world construction. A further 360-angle ray check covers the
real upper native ring, including its diagonal sectors and shared floor height. A separate preservation check compares all
retained dome geometry/instance buffers except the single estimated platform
owner. Worker/coverage and legacy navigation regression suites remain applicable.

Commands:

```sh
uv run pytest -q tests/test_parliament_interiors_v295.py
cd src/app
bun test tests/parliament-interiors-v295.test.ts
```
