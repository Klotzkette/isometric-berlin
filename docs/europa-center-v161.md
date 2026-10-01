# Europa-Center refinement, v1.0.61

This step-10 change refines the existing Europa-Center at Breitscheidplatz.
It preserves the OSM-plan anchors, mapped complex, neighbouring City West
ensembles and 93-place tour.

## Evidence and scope

The Europa-Center owner's [star history](https://europa-center-berlin.de/timeline/der-punkt-auf-dem-i/)
states a 10 m outer diameter and two rotations per minute. The
[opening record](https://europa-center-berlin.de/timeline/eroeffnung/)
gives an 86 m office tower. The owner's
[history](https://europa-center-berlin.de/information/historie/) describes
21 office floors and the 103 m overall landmark. These pages were checked on
1 October 2026. The [Berlin monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096462)
independently describes the steel frame, curtain wall, two-storey podium and
raised three-storey west office band. Its count of 22 building storeys and
the owner's 21 office floors describe different inventories; the existing
21-office-row display profile is retained.

The metric plan remains anchored to OSM ways
[`1054276972`](https://www.openstreetmap.org/way/1054276972),
[`26408382`](https://www.openstreetmap.org/way/26408382) and
[`26408381`](https://www.openstreetmap.org/way/26408381).
The shipped central-city prism payload contains the complete low complex
as shortened ID `54276972`, at viewer heights 5.2–14.2 m. It does **not**
contain either higher tower/office-band part. The complex/podium is retained
whole; the new native higher parts do not delete its irregular footprint.
The ground-plane/base conflict is retained as source data rather than
silently flattening or deleting the larger surrounding ensemble.

Two licensed external photographs were inspected:

- [Berlin Europa Center 1.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Europa_Center_1.jpg),
  Manfred Brückels, February 2006,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  It establishes the broad grey spandrels alternating with glass, narrow
  aluminium grid, straight roof edge and tapered three-point star.
- [190829 Europa-Center vom Breitscheidplatz aus gesehen.jpg](https://commons.wikimedia.org/wiki/File:190829_Europa-Center_vom_Breitscheidplatz_aus_gesehen.jpg),
  Ole Neitzel, 29 August 2019,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  It supports the turquoise office-band glazing and thin layered metal
  frames. Dated shop/advertising signs do not override the existing newer
  owner-reference signage.

Both credits are mirrored in the Wikimedia manifests. No photograph, crop,
logo graphic, texture, font or image request is added to the runtime.
Bay counts, 1.5 m spandrels, metal thicknesses and roof-support dimensions
remain procedural recognition proportions, not a new component survey.

## Geometry and animation

The drawn curtain wall now has 22 long-face and eight short-face bays with
all 21 office rows. Wider opaque panels separate the glass rows. The Mercedes
star has a 64-segment, 10 m ring and three tapered arms with physical depth.
Its fixed cradle and adjacent mast remain attached to the stationary roof.
Only the single star pivot turns around the vertical axis, once every 30 s.

The native Minecraft representation is independent: cuboid exterior wall
strips, complete floor/bay rhythm, raised west office band, roof supports and
a block ring with three stepped tapered arms. It retains the broad mapped
podium underneath and uses no curved meshes or smooth overlay.

The animation hook receives cached pivot references and elapsed seconds from
the existing viewer loop. It allocates no geometry, creates no timer and
performs no scene traversal. Explicit `updateMatrix()` preserves motion after
the viewer freezes static transforms. Time is reduced modulo the 30 s period,
so long sessions and mode switches do not accumulate numerical drift.

## Budgets and checks

The complete City West drawn layer, including its unchanged other buildings,
uses 13 renderables, 115,250 stored vertices and 2,469,414 geometry bytes.
Full and mobile models are byte-identical. The separate native Europa-Center
uses two instanced draw calls and 1,608 cuboids, with 123,888 bytes including
both instance matrices and colours; its cap is 1,800 instances.

Focused tests verify the 30 s rotation after static-transform freezing,
fixed pivot placement, unchanged geometry/buffer identity after 1,000 updates,
an independent cuboid-only native model, and full/mobile geometry parity.
Checksums of the Bahnhof Zoo, Gedächtniskirche/Breitscheidplatz and Urania
ensembles remain byte-identical to v1.0.60. Runtime viewer checks and release
results are recorded by the release review.
