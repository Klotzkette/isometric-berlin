# Public memorial accounting and pavement stones V326

The retained strict Berlin OpenStreetMap memorial/monument inventory contains
9,029 separate source records: 7,458 Stolpersteine, 729 plaques, 126 steles,
123 statues, 117 stones, 105 sculptures, 88 busts, 88 war memorials and other
explicitly retained subtypes. The 9,578 current official heritage records form a
different inventory that includes protected buildings and ensembles. They are
not 9,578 public statues. A nearby rendered building is never counted as a
monument. Original tags, heights, materials, supplied directions, inscriptions,
source names and exact point/polygon courses remain in
`public-monuments-v326-source.json.gz`.

The first historic-source ledger accounts for all 9,029 identities. It explicitly
retains eight individually authored exact-source major works, including Goethe,
Lessing, Schiller, Bismarck and Moltke; their modules are hash-pinned and untouched.
Another 1,396 records retain their exact existing `street-details.json` input and
caller. This is evidence of an existing caller record, not a blanket claim that
every existing representation is individually accurate. Code references are
listed as candidates only. The remaining 1,150 nonstandard memorials retain an
explicit unresolved individual-geometry status. This does not assert their
absence: it refuses to infer correct sculpture from a building envelope or a
source string. No new identical people, generic busts or guessed wall plaques
are added for that unresolved group. Existing geometry remains unchanged.

There are 6,475 mapped Stolperstein source points absent from the actual existing
street-monument caller input. These alone receive a new finite supplement. The
[Berlin coordinating initiative](https://www.stolpersteine-berlin.de/de) and
[Tempelhof-Schöneberg museums](https://museen-tempelhof-schoeneberg.de/stolpersteine/)
document the standard ten-centimetre pavement stone with a brass upper plate.
Each new top preserves the exact mapped location and individual source identity.
Names and inscriptions remain exact source metadata; the tiny rendered plate
does not pretend to reproduce an individual inscription or a surveyed text
heading. The displayed top is 10×10cm, with a three-millimetre rendering thickness
and no ink halo, hidden block, invented pedestal or collision obstacle.

The source extract is dated 29 September 2026. This is a complete accounting of
that retained source, not a claim that no later stones have been installed.
Current primary pages were checked on 8 November 2026. The external free-photo
reference [Stolpersteine at Winterfeldtstraße](https://commons.wikimedia.org/wiki/File:Stolpersteine,_Berlin_(LRM_20250228_134639).jpg)
is by Matti Blume, 28 February 2025, under [CC BY-SA4.0](https://creativecommons.org/licenses/by-sa/4.0/)
(selected from the author's multi-license). Its per-file license was checked;
no reference image pixels are distributed or rendered. The underlying source
points retain OpenStreetMap attribution/ODbL provenance.

The complete OSM union was subsequently extracted directly from the original PBF
using `tourism=artwork OR historic=memorial/monument OR an explicit memorial
subtype`, in both the points and multipolygons layers, restricted to Berlin.
It accounts for 11,782 distinct identities: 11,655points and 127multipolygons,
including 2,763 `tourism=artwork` records and 2,753 identities beyond the original
historic subset. The tourism-only Wagner memorial is now correctly accounted
for as an additional individually authored exact-source work. Its older source
identity was not present in the historic-only extraction. The original PBF hash,
query, complete properties/other-tags, geographic courses and projected courses
are retained in `raw/public-fidelity-v326/artwork_union_{points,multipolygons}.json.gz`.
The joined `public-artwork-accounting-v326-source.json.gz` keeps all source
identities, the preserved caller records, the new individually dimensioned work
and explicit unresolved artworks. This union is a complete accounting of those
retained OSM tags, not an exhaustive census of every physical artwork in Berlin.

## Finite runtime contract

`PublicMonumentsV326.ts` has cooperative and synchronous factories. Options must
select at most eight exact 512m keys or 256 exact source IDs; there is no all-city
default. The actual largest source key contains 238 points. The constructor
requires a finite rendered-surface height for every selected point and rejects a
partial/changed source recipe. It preserves full detail on touch. Native uses
independent cardinal pavement squares at the actual supplied Native surface
height. A complete group owns one static instanced batch. Actual geometry words,
membership, poses, material shapes, source identities and authored lifetime are
privately receipted; legitimate interleave, material modes, program retirement
and lossless static parking remain valid.

`PublicMonumentsPacketV326.ts` supplies the actual main-thread adapter:

```
createPublicMonumentsPacketV326Steps(root, id, native, nav, origin,
                                   { hosts, openings })
  -> { root, geometryBytes, bufferCount,
       navigation?, supportedSourceIds, unsupportedSourceIds, complete, dispose }
```

Invoke only for actual primary descriptors, after existing current-packet
ground/opening work. Supply only the original decoded primary mesh hosts saved
before adding stairs or signs, plus actual admitted U-Bahn opening DTOs. Exact
Drawn rings or the exact Native quarter-metre cell union exclude the complete
stone footprint even when a GPU-only hole misses centre/corner sample points.
Select only points wholly inside that actual 512m frame.
The adapter independently requires the full 10cm square to belong to current
Nav ground and have zero positive-area intersection with current buildings or
water, including all holes. A centre-only test is insufficient. The actual
decoded mesh triangles must cover the whole square, with a locally level top;
ground hints alone do not create support. Ground collection splits at 192 query
points, uses the existing cooperative source-carrier collector, and never builds
a second city. Unsupported stones are individually omitted and explicitly
returned; one missing pavement patch does not remove supported neighbors.

The factory constructs local coordinates under the real decoded root, so source
origin is not applied twice. Fresh current ground/nav proofs run before and
after attachment. The same actual root is idempotent; a revoked/retried receipt
removes its previous supplement. Dispose before dropping that actual packet,
and account for the returned bytes/buffers inside its existing caps. The private
`complete()` method is for admission/retry boundaries, not a per-frame polling
loop. No Worker path, residency/prefetch/startup limit, animation or old source
transaction is introduced. No original mesh or navigation record is mutated.

## Individually dimensioned Oberschöneweide memorial

A concrete larger missing work is implemented independently: source
`node/4998450868`, Widerstandskämpfer in Oberschöneweide, Griechische Allee42.
The [district museum](https://www.berlin.de/museum-treptow-koepenick/gedenkorte/artikel.813455.php)
and [Bildhauerei primary catalogue](https://bildhauerei-in-berlin.de/bildwerk/gedenkmal-widerstandskaempfer-oberschoeneweide-8515/)
document a 2.5×0.7×0.63m fired-clinker pillar with four ceramic panels and an
oath-hand/triangle relief. The catalogue credits Susanne Kähler's 2020 photos
under CC BY4.0. The additional [OTFW photo](https://commons.wikimedia.org/wiki/File:Gedenkstele_Griechische_Allee_42_(Oschw)_Widerstandsk%C3%A4mpfer.jpg),
3 September 2010, is CC BY-SA3.0 (selected from its multi-license). Its exact
facing was not supplied by the retained OSM source or photo metadata. The model
therefore explicitly declares its cardinal display orientation as estimated.
Its complete overall envelope is 2.5×0.7×0.63m, with fired-clinker courses, four
stoneware panels and an individually composed oath-hand/triangle relief cue.
Drawn and Native generate their own primitive batches (342/332instances), with
different independent relief steps. This is a reference interpretation, not a
photographic replica or a text facsimile. No invented plinth or adjacent paving
is added. The full0.7×0.63m base must be actually supported by current original
terrain triangles and must clear all current building/water/aperture geometry.
The actual `outer187-19_12` / `east200-19_12` primary complements are tested in
both families, with exactly one source ground owner. A new matching navigation
object appends only this exact2.5m solid/roof; original navigation stays unchanged.
The caller adopts `result.navigation` when present. All geometry and physics
leave with that same packet lifetime. The joined artwork ledger refines this
one previously unresolved historic identity; the earlier raw source ledger is
retained unchanged as provenance.

## Verification

The bounded Bun suite tests the actual factory/private gates and all explicit
selection failures, full/touch/Native equality, source/geometry mutation,
material transitions and cancellation. It also decodes the real delivered
primary `-6_5` in both families and verifies positive whole-triangle-supported
plates, all 238 source records accounted for, unchanged original bytes/Nav and
bounded new buffers. Synthetic exact source positions test stones whose centres
are clear while an edge intersects a building, water or a ground hole; only that
stone is omitted, and its supported neighbor remains. Python checks all 9,029
ledger identities, separate heritage count, exact preserved old sources/authored
modules and the complete 6,475-point partition. No full-city scene was built.
