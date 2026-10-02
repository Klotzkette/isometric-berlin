# Scheunenviertel source refinement, v1.0.68

Pipeline step 10 adds bounded, offline-prepared building and street detail inside
an explicit Scheunenviertel working polygon. The versioned Berlin release bounds
are unchanged. Four drawn modes, pointer and touch consume the same prepared
geometry; Minecraft has its own block-native surface mesh.

## Finite scope and sources

[Berlin's official description](https://www.berlin.de/en/attractions-and-sights/3560423-3104052-scheunenviertel.en.html)
places the Scheunenviertel between Hackescher Markt and Rosa-Luxemburg-Platz in
the eastern Spandauer Vorstadt. The name is a historical neighbourhood name,
not a precise administrative polygon. The working boundary follows Rosenthaler
Straße/Hackescher Markt in the west and south, Torstraße in the north and
Karl-Liebknecht-Straße in the east, with frontage room at the perimeter.
Its exact world-coordinate ring is committed in `scheunenviertel-v168.json`:

```text
[2020,-450], [2130,-740], [2015,-1185], [2240,-1180], [2460,-1110],
[2770,-1020], [3060,-850], [2920,-650], [2720,-400], [2570,-250], [2260,-360]
```

This is a finite authoring boundary, not a newly claimed official boundary.
Only complete new source families contained by it are selected. The underlying
source search retains boundary-parent identities rather than clipping families
into fictitious building fragments. Existing families intersecting the boundary
may receive extra detail only where a wall centre and its exterior approach are
inside it. No source shell is truncated.

The 214 retained OSM road ways cover 22 named streets, including Weinmeister-,
Münz-, Almstadt-, Stein-, Gips-, Hirten-, Kleine Alexander-, Weydinger-, Zola-,
Schendelgasse and the perimeter streets. The short in-polygon ends of
Sophienstraße and Straßburger Straße are retained. The western Spandauer
Vorstadt is not silently absorbed into this task.

- **Berlin LoD2**, dl-de/zero-2-0: four cached official kilometre ZIPs provide
  all 331 newly refined parents and their 715 original leaf parts. Every wall,
  roof, ground sheet, hole and original part ID is retained at the established
  millimetre source precision, with the existing outer display datum `y=3`.
  The source file records each archive URL and SHA-256.
- **OpenStreetMap**, ODbL 1.0: the cached Geofabrik extract through
  2026-09-29 supplies mapped street courses, width tags and building semantics.
  Matching building tags and original OSM polygons remain distinct from the
  authoritative LoD2 dimensions.
- **Earlier releases**: 58 previously plain core prisms retain their exact
  delivered outlines/heights. Another 326 already detailed LoD2 families and
  seven previously detailed core prisms are retained verbatim from the frozen
  v1.0.67 source packages. Their old shells and facades are not regenerated.

[visitBerlin's Hackesche Höfe account](https://www.visitberlin.de/en/hackesche-hofe)
provides the courtyard context. It does not grant permission to copy a courtyard
plan or substitute a photograph for the existing source geometry. The already
modelled Hackesche Höfe, Babylon, Volksbühne, Alexander north ensemble, Neue
Synagoge and Tacheles remain under their existing ownership. Runtime suppression,
all Source/Navigation contracts, manifest source IDs, and every existing leaf-part
navigation owner are consulted before selecting new generic owners. In
particular, prisms `24054915`, `40754304` and `19283679` stay excluded; their
removed v166 generic facades are never rebuilt.

## New detail and its limits

The new outer parents use every actual LoD2 roof and wall triangle. They gain
thin window surrounds, glazing, mullions, sills and shallow cornice/lintel/pier
subdivisions. Existing generic street facades keep their previous panes intact:
the previous facade rule is evaluated against its original roads before a new
window is emitted. A face that already had windows gets only previously absent
shallow ornament; existing v167 ornament is also excluded.

Source-mapped exterior and courtyard walls gain restrained window indications
when their outward approach is clear at 1, 3 and 5 metres. Occupied neighbouring
footprints and narrow party-wall seams reject this addition. Court faces do not
receive invented commercial shopfronts. Interior source holes remain open; no
new doorway, business label or access permission is inferred. The added drawn
mesh contains 21,988 courtyard-glazing triangles, besides the matching surrounds,
sills and frames.

Window bay and floor spacing, material swatches and fine ornament are explicitly
procedural display estimates, not a per-window survey. New generic facade detail
does not claim an exact restoration of every building. Road and sidewalk detail
uses the existing mapped asphalt boundaries, source footprints and water mask.
The previous street-detail zones are subtracted before adding pavement or curbs,
so old intersections and v166/v167 curbs remain unchanged. The new drawn pass
covers approximately 49,205 m² of sidewalk with 17,826 m of source-aligned curb
edge; untagged sidewalk width and curb section remain estimates.

## Inspected freely licensed visual references

Both photographs were inspected at their Commons-provided thumbnail sizes.
Jörg Zägel's 23 April 2010 views provide restrained warm plaster, pale surrounds,
base-course and cornice cues for the neighbourhood's generic facade reading.
They are not claims about every facade's current colour or renovation state.
No photograph, crop, sampled texture, font or photographic pixel is bundled.

| File | Author / selected licence | Use |
|---|---|---|
| [Berlin, Mitte, Almstadtstrasse 25, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Almstadtstrasse_25,_Mietshaus.jpg) | Jörg Zägel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Plain plaster, narrow window surrounds and restrained base-course rhythm |
| [Berlin, Mitte, Almstadtstrasse 35, Mietshaus.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Almstadtstrasse_35,_Mietshaus.jpg) | Jörg Zägel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Warm plaster, pale frames, sills and shallow spandrel/cornice cues |

The exact per-file records are supplied in
`/tmp/scheunen-v168-attribution.json` for the shared source/public manifests.
CC BY-SA 3.0 is selected from the files' offered dual licences. Image files
remain temporary external QA evidence.

## Bounded packet and preservation contract

`build_scheunenviertel_v168.py` always reads the immutable **v1.0.67 Git tag**,
never a possibly modified current packet. It writes isolated candidates to
`/tmp/v168-scheunen-packets`, with mesh kind `scheunenviertel-v168`. Nine primary
512 m chunk pairs receive additions. One companion,
`4_-2-scheunen-v168`, has the same bounds and `detailCompanionOf: "4_-2"`.
All navigation stays in the primary. Both new geometry families are in the
companion: drawn has 7,744,758 decoded bytes and 382,481 vertices; native has
4,856,502 decoded bytes and 157,165 vertices. The primary retains all earlier
meshes, with 148,227 drawn vertices before central coarse-owner subtraction.

The old 4_-2 native packet alone was already 10,497,604 decoded bytes. Splitting
only the additional meshes preserves the existing **12 MiB per-response
ceiling**, **400,000 aggregate vertices**, **2,400,000 indices**, 400,000 ink
vertices and 16 meshes per packet, with no change to live residency budgets or
quality. The maximum staged decoded payload is 10,514,626 bytes. The original
combined drawn payload fit the byte ceiling but exceeded the aggregate vertex
ceiling; the generator now considers every runtime geometry limit before
selecting a companion, and the publisher independently rejects any violation. The scheduler retains unique chunk
IDs even at equal bounds; companion navigation is excluded from primary lookup.
A failed primary followed by a successful companion and later primary retry is
covered by a regression test.

Native generation remains an independent two-metre, surface-only block reading.
It keeps original source envelopes and open courts, without invisible solid
voxel fill. Exact union of equal-colour, coplanar, equally oriented faces and
zero-tolerance removal of collinear seam vertices reduces the new native mesh
from 803,132 to 384,499 triangles before tile clipping. This changes neither
visible planar coverage nor colour and never fills a hole. After clipping,
the prepared additions contain **422,828 drawn** and **386,299 native** triangles.
No old mesh is reindexed or simplified by this operation.

The staging preservation report hashes every old mesh list and every unowned
navigation record against the tagged packets. The central integrator may remove
only the exact coarse triangle/colour and line contributions of
`source.buildings[*].id`, then publish their full part navigation. No older
facade-kind removal plan is needed. All 331 owner IDs are explicit in the source
and manifest patch; there are no additional OSM owners.

Reproduce without modifying public assets:

```bash
uv run python scripts/build_scheunenviertel_v168.py --refresh-source
uv run pytest tests/test_scheunenviertel_v168.py
cd src/app && bun test tests/scheunen-streaming-v168.test.ts
```

Source regression tests independently reconstruct all 331 parent families from
the original CityGML archives; check finite scope, exact old records, court/party
wall rejection, non-duplication of previous windows, exact native-plane union,
all aggregate packet limits and all new leaf navigation. The bounded Bun test
serially decodes, constructs and disposes every affected published packet with
the actual runtime geometry loader, including both companion families. This
checks rendered eligibility in addition to preservation of stored source data.
The separate
`test_scheunenviertel_release_v168.py` validates the **published** result against
v1.0.67: old special meshes and unowned triangle/colour/line/nav multisets remain
exact, every measured wall/roof sheet is actually drawn, and every original leaf
footprint survives chunk clipping. Central publication and viewer QA remain the
release integrator's responsibility.

The publication audit identified two centimetre-encoded navigation rings with
self-touching edges after rounding (`DEBE01YYK00008op` / `DEBE3DXjhtsJjpl9` and
`DEBE01YYK0000EfC` / `DEBE3DIqybRnmu1m`). Their original millimetre source rings
are valid. The independent area comparison uses `make_valid` on **all** resulting
components, retaining every lobe and any collapsed linear component. Their
source-versus-navigation symmetric differences are 0.0842 m² and 0.0730 m²,
respectively, within the existing centimetre encoding tolerance. A separate
check requires every original courtyard interior beyond a 2 cm edge allowance
to remain open. This test normalization does not alter any published source,
mesh, navigation ring or rendered geometry.
