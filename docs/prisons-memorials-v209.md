# JVA Tegel and two distinct Stasi sites, v1.0.109

Step 10 adds the missing Tegel site and completes the bounded architecture of
the former Stasi headquarters on Normannenstraße and the separate former prison
memorial in Hohenschönhausen. The existing JVA Moabit model
`DEBE01YYK0002Sgs` and former Lehrter Straße memorial `DEBE01AL2yz00000`
remain intact. No district-wide bounds expansion or city residency budget change
is part of this family.

## Exact scope and identity

The retained 29 September 2026 Berlin OSM extract supplies the original named
site polygons, mapped barriers, gates, roads and building associations. Each
finite scope is that exact polygon with a 12 m immediate context. The committed
`bounds-prisons-memorials-v209.geojson` records those three scopes. Complete
LoD2 parents are selected when more than half their footprint lies inside the
named site; all selected full parents lie within its immediate context.

| Site | OSM identity | Old site coverage | Full parents / parts | Context area | New ground area |
|---|---|---:|---:|---:|---:|
| JVA Tegel | `way/7249400` | 0% | 54 / 168 | 158,807.228 m² | 158,807.228 m² |
| Former Stasi HQ, Lichtenberg | `way/46839070` | 21.817% | 53 / 99 | 92,075.559 m² | 70,163.116 m² |
| Hohenschönhausen memorial | `way/367216314` | 100% | 11 / 31 | 25,530.355 m² | 0 m² |

The [official Tegel account](https://www.berlin.de/justizvollzug/anstalten/jva-tegel/die-anstalt/)
identifies the current prison. The [Stasimuseum contact page](https://www.stasimuseum.de/kontakt.htm)
locates the museum at Normannenstraße 20, Haus 1, on the former headquarters
campus; its retained LoD2 parent is `DEBE11YYI00001A0` and OSM building is
`way/41275625`. The [Hohenschönhausen memorial operator](https://www.stiftung-hsh.de/themen/inklusive-angebote)
describes the separate preserved former detention site. These identities must
never be conflated merely because all three involve prison or Stasi history.

## Complete source bodies and datum

`prisons-memorials-v209-source.json` retains 118 complete parents, 298 parts and
all 2,751 original wall/roof sheets, including original rings and holes. The
drawn model submits their 6,996 constrained triangles without removing any
source vertex. Four small official Geoportal archives were checked on
10 October 2026; each owner's URL and SHA-256 are retained with its full profile.
The archives use Berlin's `dl-de/zero-2-0` building data license.

| Official archive | Bytes | SHA-256 |
|---|---:|---|
| `LoD2_384_5825.zip` | 959,012 | `a8793348203a70bba6f6c9257ce6a1f19d80f3ac46221f98c0fc17db7895f9ae` |
| `LoD2_384_5826.zip` | 2,163,901 | `ce72d238e2b490c41e7c15825443e779bb1090c556db965c5f916a7b866c53a5` |
| `LoD2_397_5819.zip` | 3,378,118 | `747764399f0f1b1fa085ef61e89fea9ae4cdf4ee01326bc478527afe25b74e01` |
| `LoD2_398_5822.zip` | 2,612,135 | `70c09237f3f74eac6b11634a7409ec9727ec2654a1ba139a0686a79c709c8a90` |

URLs have prefix `https://gdi.berlin.de/data/a_lod2/atom/`. OSM source is
`berlin-260929.osm.pbf`, SHA-256
`9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9`,
under ODbL-1.0. The final committed source receipt SHA-256 is
`7e3827928bcfb24b6d8260e697944a045f6892c62a1c692fb4daa7db3f358205`.

World X is EPSG:25833 easting minus 389,500; world Z is 5,820,000 minus
northing. Retained source Y is NHN minus 30 m. Each parent has one explicit
rigid `displayOffsetY = 3 − minimum source ground Y` to meet the existing
outer-city cartographic ground at Y=3. Source minimum Y is therefore not
mistaken for the display datum. X/Z, relative roof heights and all measured
wall shapes remain unchanged. Ground and road fills occur only in context
minus the pre-v209 coverage; the existing ground and path layers stay intact.

The independent Minecraft representation samples the complete wall and roof
surfaces into 284,396 one-metre surface cells. Lossless equal-colour run packing
reduces them to 14,069 boxes, with no filled building interiors or courtyards.
All native fittings are separately axis-aligned. This is a separate native
silhouette, not a rotated copy of the drawn model.

## Public exterior detail and estimates

The retained source has 37 mapped barrier ways: 17 around Tegel, 10 at the
headquarters, and 10 at Hohenschönhausen. Tegel selection follows its public
outer boundary, requiring over 90% of a barrier trace to lie within 14 m of
that boundary. No internal operational layout is added. All barrier coordinates
are retained unchanged. Hohenschönhausen walls `way/367216300` and
`way/367216308` retain their explicit OSM 4 m heights. Untagged wall height
(4 m), fence height (2.5 m), post spacing and member widths are display estimates.

Mapped gates close to those barrier traces produce finite 4.2 m passages and
open leaves. Gate dimensions and the shown open state are an architectural
display convention, not a statement of current access. Source roads retain
their original linework and use tagged widths where present; untagged paths
use 2 m and other roads 4.5 m, clipped to new ground only.

Window frames, panes, sills and historical bars use repeated instancing. Each
opening rectangle is checked against the actual retained wall polygon; adjoining
buildings suppress concealed faces. Tegel facade interpretation is limited to
the exterior zone within 62 m of its outer boundary. Headquarters recognition
detail is limited to Haus 1, Haus 2 (`DEBE11YYI00001PT`), Haus 7
(`DEBE11YYI0000MqA`) and Haus 16 (`DEBE11YYI0000O2G`); the other buildings
still retain their entire measured envelope. Window spacing, small fittings and
material colours are interpretations, not new surveys.

Three inspected freely licensed Commons photographs supply visual material
references. Their exact titles, authors, dates, selected licenses and observations
are in `docs/prisons-memorials-v209-sources.json`, with credits also appended to
both common Wikimedia manifests. Photographs remain external references; no
photo pixels, crops, textures, protected lettering or internal room layouts are
bundled. Historical photo dates are explicit and are not a current colour survey.

## Replacement and construction ownership

`createPrisonsMemorialsEnvelopesV209(native=false)` builds the complete bodies
and new ground as required city construction before publication.
`createPrisonsMemorialsV209(native=false)` adds optional exterior detail.
`prisonsMemorialsV209GroundAt` supplies only finite context ground, while
`prisonsMemorialsV209SolidAt` uses source building footprints, heights, holes,
barrier traces and represented gate gaps. Building collision follows the existing
outer-city envelope convention; it is not a roof-triangle walking simulation.

`prisonsMemorialsOwnershipV209.json` records exactly 3,368 old triangles in
44 owner/mode records and 22 drawn ink segment records. They belong only to
`outer187-15_1` (11 mapped headquarters owners) and `east200-17_-5`
(11 Hohenschönhausen parents). Tegel has no old owner to replace. The generator
reconstructs the old owner recipe from retained source records and matches exact
quantized positions plus linear colours. It fails on any missing primitive.
Original metadata and full footprint WKB remain in the receipt.

Each triangle receipt binds tile, mode, part kind, owner, original packet SHA-256,
and FNV-1a of encoded positions, colours and indices. Ink receipts bind the
corresponding position/colour fingerprint and exact segment indices. Runtime
transfer gates may remove only those listed primitives after fingerprints match;
they must not mutate the retained packet or use an area-wide exclusion. Required
complete replacement envelopes must exist before the city can become visible.
Old Moabit, Lehrter memorial and unrelated source owners never enter this list.

Navigation independently retains all 44 original rows (22 source owners in
each mode), including tile, mode, origin, ground datum, packet SHA-256, complete
original fields and the corresponding required replacement owner IDs.
`transferPrisonsNavigationV209(tile, nav)` removes an old row only when every
field and value matches and the exact replacement owners exist in the prepared
inventory. Drawn and native rings/heights are compared against their own original
records. Changed identities, rings, holes, heights, ground offsets, metadata or
datum retain the old record. This avoids invisible old roof collision slabs:
at `[8782.364,8.2,-2336.388]`, Hohenschönhausen owner `DEBE11YYH0000Ffi`
formerly collided up to Y=8.650 although the replacement roof stops at Y=7.231.
The corrected point is free while the new source building remains solid below.

## Measured storage and checks

| Runtime family | Draw calls | Buffer bytes | Instances |
|---|---:|---:|---:|
| Required drawn bodies and new ground | 3 | 850,284 | 0 |
| Optional drawn detail | 3 | 2,560,360 | 33,652 |
| Required native bodies and new ground | 5 | 1,166,768 | 14,069 |
| Optional native detail | 3 | 3,421,136 | 44,978 |

All meshes are static, texture-free, separately frustum-cullable by site and
owned by their world transaction. Day and night materials use the same complete
geometry. Touch devices retain the same detail. Required JSON is 1,528,119 bytes;
detail JSON is 4,973,084 bytes; navigation is 101,311 bytes; exact old ownership
receipt is 76,785 bytes. Large constructor-only arrays use the existing lossless
weak lazy decode mechanism. These are measured geometry buffer counts, not a
claim of total browser or physical iPhone memory.

Focused verification passed: nine Python checks (the eight complete generation
checks plus direct comparison of every retained part against all four original
official archives), five model Bun checks, three exact-navigation Bun checks,
and Ruff. Checks cover complete source
vertices and sheets, finite scope, exact mapped barriers, source-clipped windows,
deterministic generation, hollow native surface-cell preservation, exact old
triangle/ink receipts, strict finite JSON, native orthogonality, resource ownership,
material contracts, finite ground and an open memorial courtyard.

Reproduction from committed source needs no downloads:

```sh
PYTHONPATH=. uv run python scripts/build_prisons_memorials_v209.py
PYTHONPATH=. uv run python scripts/build_prisons_memorials_ownership_v209.py
uv run pytest tests/test_prisons_memorials_v209.py -q
cd src/app
bun test tests/prisons-memorials-v209.test.ts
bun test tests/prisons-navigation-transfer-v209.test.ts
```

The ownership generator requires the existing ignored `resolved-outlines.gpkg`
for v187/v200 and unchanged published packets. The direct archive check skips
explicitly if optional ignored raw archives are absent; all committed-source
generation checks remain independent of those archives. Browser screenshots and
physical-device validation belong to release integration and are not claimed by
these source/model tests.

Review cameras (world metres) are exported as `PRISONS_MEMORIALS_V209_CAMERAS`:

| View | Position | Target | Span |
|---|---|---|---:|
| JVA Tegel | `[-4680,340,-5870]` | `[-5165,8,-6112]` | 730 m |
| Former Stasi HQ | `[7460,220,930]` | `[7810,8,690]` | 460 m |
| Hohenschönhausen | `[8620,160,-2180]` | `[8867,7,-2350]` | 310 m |
