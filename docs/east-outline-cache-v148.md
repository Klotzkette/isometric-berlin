# Eastern recognition outlines and native preparation — v1.0.48

Pipeline step 10. Alexanderplatz station and Rotes Rathaus keep their complete
source silhouettes without facade embellishment. The Fernsehturm keeps its
original LoD2 records and source-centred identity, but resolves a documented
source generalisation so the requested initial outline is recognizable.

## Fernsehturm source conflict

The two official parts `DEBE3DTptoJUMc8e` and `DEBE3DhqsGtrFsGv` describe a
36 m-wide annulus extruded from ground through 229 m and an inner 18 m-wide
cylinder through 253 m. Directly rendering them creates a broad pillar with
no ball. That is a source generalisation, not the real tower silhouette.
All original rings and sheets remain unchanged in `schlossEastSource.json`.
These two generalized shapes are not displayed alongside their correction.

`FernsehturmOutlineGeometry.ts` instead creates one bounded vector mesh with
a flared foot, narrow tapering concrete shaft and a distinct spherical head.
There are no windows, antenna dishes, advertising or facade embellishments.
The centre is calculated from the original source circle's bounds, and the
source ground y=4.63 m is retained. The [Berlin heritage account](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558558.php)
confirms the 368 m height and 32 m ball. The operator's
[published building facts](https://convention.visitberlin.de/sites/default/files/2021-10/BANKETTMAPPE-2021-BERLINER-FERNSEHTURM_7.pdf)
confirm those dimensions, a 32 m foot and public levels at 203/207 m.
The [Bundeszentrale für politische Bildung technical sheet](https://www.bpb.de/system/files/dokument_pdf/MuM_10_Berliner%20Fernsehturm.pdf)
gives the 16→9 m shaft diameter, 118 m antenna and a mean ball height of 212 m.
Thus **207 m is the restaurant level, not the ball centre**.

The silhouette uses a 32 m sphere centred at 212 m above the source ground,
a shaft tapering from 16 to 9 m, and an antenna ending at exactly 368 m above
that datum. The 250 m shaft/mast transition follows from 368−118 m. The
20 m high foot flare, straight taper interpolation, sphere subdivision and
mast colour courses are procedural display approximations, not surveyed
construction details. Simple vertex tones make the vector ball legible without
adding a photograph or texture. Native Minecraft samples this same illustrated
shape into bounded exterior cells.

Navigation excludes the two broad generalized tower prisms and uses
`fernsehturmOutlineSolidAt(x,z,y,radius)`, which follows the varying foot,
shaft, sphere and mast radii. The original source parts remain available for
provenance. The correction neither closes the entire 36 m cylinder for walkers
nor introduces an opaque duplicate around the new shaft.

## Lossless offline native preparation

Run from `src/app`:

```sh
bun scripts/build-east-outline-voxels.ts
```

The generator uses the original `sourceMesh` triangulation for the Rathaus and
both station parts, and the shared procedural tower mesh above. It applies
unchanged 2 m surface sampling with triangle subdivisions at maximum 1.25 m
spacing. First-source colour ownership and insertion order are deterministic.
Explicit keys (`rathaus`, `stationBase`, `stationHall`, `fernsehturm`) bind source
to colour rather than relying on a JSON object's enumeration order.

`eastOutlineVoxelData.json` records source and display-profile SHA-256,
contributing part IDs, profile ranges, a 67-colour lossless palette and integer
grid coordinates. Its **294,657 bytes** contain **21,010 surface cells**; the
59 antenna courses retain fractional source-centred coordinates and exact
published-height termination. Full and mobile worlds use the same constructor:
**21,069 instances**, **1,601,244 bytes** of instance transforms/colours.
There is no hidden solid volume infill. Source station roofs and Rathaus courts
are unchanged; all **16,386 station/Rathaus cells** before the TV correction
remain byte-for-byte identical, with prefix SHA-256:

`acb29d82db61681884ec6e36fe0f24194b031ccacda4de90425ef5f42a028417`

Native construction does not create source meshes, triangulate, sample triangles
or allocate a string-keyed cell map. Prepared coordinates go directly into the
final instance buffers. The isolated local constructor measures about **20 ms**.
Before preparation, the original generalized-cylinder model required about
480 ms on this development machine; that is not a physical-phone benchmark.
The final corrected model's transform/colour SHA-256 is:

`a952a714d2b317e0447c3f1609834a0fd0cb715d76888c7045feda6ac73312ce`

`schlossEastProfile.ts` contains lightweight source, naming, tone, collision and
antenna contracts without rendering constructors or the native cache. Navigation
imports that profile. The renderer retains compatible exports for old callers.

Seven focused frontend tests verify cache regeneration, source/display hashes,
keyed source ownership, unique exposed cells, retained station/Rathaus bytes,
identical full/mobile output and drawn/native raycasts proving the sphere is
wider than the shaft. TypeScript checks pass. No new photographic reference,
geographic input or licence is introduced by the correction or preparation.
