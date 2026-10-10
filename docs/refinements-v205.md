# Wider views and source-bound city refinements — v1.0.105

Step 10 follows the owner's request for a modestly wider zoom, complete Berlin
flooding, and additional recognition at named schools, public places, religious
sites, BER, Ringbahn stations, western motorways and Kurfürstendamm. The 93-place
tour and existing city residency limits remain unchanged.

## Camera and flood

The orbit base distance increases from 2,600 to 3,900 m. The existing field-of-view
compensation is retained, giving the same 50% increase at every orbit FOV. Camera
near precision, movement, building geometry and streaming budgets are unchanged.
The far plane continues to contain the entire permitted navigation envelope.

The previous water covered only the original 81.457 km² detailed-city footprint.
The new additive water covers the official complete Berlin state polygon and the
already approved outer presentation footprints: **921.325 km²** in total. It uses
the retained official ALKIS state boundary, not a broad city rectangle. No new
building-filled territory is inferred. The old water's exact vertex/index bytes
remain unchanged.

`build_flood_extent_v205.py` prepares the extension offline. Full 64 m cells share
one four-vertex shape; exact clipped boundary triangles retain polygon rings and
holes. The result is 199,140 shared cells and 43,822 boundary triangles, with
2,610,248 raw bytes and 794,602 gzip bytes. Its 270 spatial batches are culled
independently in 2 km groups. This avoids submitting the entire state area when
looking at one neighbourhood. Maximum triangle edges remain below 96 m, keeping
the same swell density as the earlier water; flow/foam shaders and 3/6/21 m depths
are shared. The flood is a visual scenario at the existing common datum, not a
hydrological simulation or a claim that every real hill is submerged at 3 m.

The extension loads only on first entry to Flooded Berlin. Fixed-size bounded
reads, native streaming decompression and shared typed-array views avoid a large
JSON/triangulation peak. Teardown aborts pending work; normal scene disposal owns
all water geometry/materials. The extension shares the Pergamon reveal cutaway
uniforms. Normal mode does not request the water asset.

## Architectural and transport changes

See the detailed source/estimate and preservation receipts in:

- [Schools, academy and Rosenthaler/Choriner frontages](schools-places-v205.md).
- [Ringbahn, BER and western motorways](transport-refinements-v205.md).
- [Selected churches, mosques and synagogue](religious-sites-v205.md).

All additions have the same full static detail on touch and pointer devices,
and an independent block-native Minecraft reading. Source geometry takes
precedence over photographic recognition estimates; this is not an architectural
survey of every opening.

## Kurfürstendamm

The official Berlin street-tree WFS was queried on 10 October 2026 within the
already mapped boulevard. The retained clipped source contains **396 additional
tree locations**, all tagged Kurfürstendamm. Points within 3 m of any already
delivered park/street tree were excluded. Exact coordinates, available heights,
crown diameters and trunk circumferences remain traceable to `gisid` records in
`kudamm-trees-v205-source.geojson`. Missing dimensions use explicit 9 m/5 m/75 cm
display defaults. Crown silhouettes are procedural, not surveyed tree meshes.

The small texture-free tree batches are partitioned every 240 m. Existing
buildings, their detailed fronts, pavements, kerbs and all earlier trees remain.
Source: Geoportal Berlin, `baumbestand:strassenbaeume`, dl-de/zero-2-0,
<https://gdi.berlin.de/services/wfs/baumbestand>.

## Validation

The flood regression checks full source-union area, triangle coverage/edge
lengths, fixed binary budgets, zero-copy buffers, shared animation at all three
depths and unchanged previous water. The tree test proves official point identity
and absence of existing-tree duplicates. Browser checks cover Chrome desktop and
WebKit with an iPhone 13 profile; these do not certify physical iPhone RAM limits.
The complete Python and isolated Bun suites were executed. Their initial failures
were confined to outdated preserved-geometry references, the new exact-owner
receipt stage, one credits serialization regression, and construction checks
hitting the old five-second timeout under concurrent CPU load. These were
corrected without weakening the old geometry comparisons: the v204 predecessor
is independently reconstructed, all earlier retained arrays are checked, and the
v205 synchronous result is compared with cooperative construction. Every failed
case was rerun, together with the newly changed modules, with 60-second Bun test
timeouts. Known unrelated Python skips remain documented by pytest.

The final production TypeScript/Vite build, Ruff checks, complete static-package
readiness and local HTTP launcher checks form the release gate. Chrome desktop
and WebKit/iPhone-profile checks verify that normal startup does not fetch the
extension; flood attachment has 271 shared spatial objects and works outside
the former square at BER, Spandau and Kurfürstendamm. The 3/6/21 m controls and
mode switching were exercised without page errors or lost WebGL contexts.
A final mouse-wheel check confirms the larger zoom through the actual UI.

Visual review covered the six religious sites, all named school/place frontages
and a native Minecraft reading. A final color-only correction makes the
Şehitlik dome visible against its same-colored source roof: three baked shades
on the existing 384 dome faces, with every position and native cell unchanged.
No screenshot or reference photograph is part of the runtime assets.

Physical-device memory ceilings and long-duration operation on older iPhones
were not measured; emulation is not presented as a device stability guarantee.
