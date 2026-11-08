# Finite U-Bahn ground approaches V326

The published 206 primary packets provide ground for 301 of 458 selected access
points outside the original Core raster. The 157 remaining points are audited
individually; this work does not add district ground or change earlier owners.

Nine Mitte accesses already have actual rendered ground from
`createSchlossEastStreets`. Their separate exact index preserves all nine IDs.
Four complete stair mouths and two external marker points are clear of original
AltMitte bodies and mapped water. Three other marker points lie inside retained
measured buildings or lift bodies and remain explicitly blocked. The caller
borrows actual original meshes scoped to the eastern street root; global name
lookup is insufficient because its Drawn mesh names repeat DistrictStreets names.

The remaining 148 access identities have complete retained source ways and tags,
individual ground decisions and reasons in the new source archive/index. 105
Drawn and 104 Native entrance points have positive new ground support. 43 remain
unsupported: 23 intersect closed source bodies/water, 11 have only indoor/elevated
course evidence, and 9 lose their exact entrance point at a protected boundary.
Native `node/4763792906` additionally lacks a fully contained quarter-metre pixel
at its point. A positive point does not automatically prove a complete stair
mouth or pole footprint; the real main-thread adapter performs those checks.

Only 48 ordinary 512 m descriptors are added, 96 gzip files totaling 969,110 bytes
(3,469,241 decoded bytes). Their combined new Drawn footprint is 3,471.59 m².
They contain 18,358 actual Drawn triangles and 47,783 independent Native ground
cells. Full and touch decode the same new surfaces. No building, water, old
navigation, existing triangle or former source packet is rewritten. The
compiler removes only its own obsolete, unreferenced draft derivatives.

Ground follows original connected OSM access courses, limited to 10 m from the
entrance, plus each complete positively mapped descent. Tagged width/est_width
is retained. Untagged widths (2.4 m paths/2.3 m stairs), round path caps using
half that width, a 20 cm stair perimeter and tiny footings for the actual poles are
explicit display estimates. They are not a survey of paving edges. All former
339 manifest footprints, the original Core, the new 13 NE descriptors and all
1,883 institution body footprints are subtracted. The derivative is clipped to
the actual Berlin boundary. Closed mapped bodies and water are excluded. Only
explicit `building=roof, layer=1` or positive roof minimum-height evidence clears
an overhead mask; an unknown bridge or closed station/retail body stays blocked.

Original official DGM1 XY cell centres/heights are retained, with the existing
world transform NHN−30 m. Drawn geometry and the terrain helper use the same fixed
one-metre source-grid triangle planes. Native independently uses fully contained
quarter-metre top cells and decimetre-quantized original DGM heights. Both have
an explicitly estimated 10 cm pavement lift. No default paper/unknown height is
reported as physical support. The original selected context objects and sparse
DGM checkpoints are retained with complete archive, query and source hashes.

## Integration

`UbahnGroundApproachesV326.ts` exports the ordinary manifest supplement,
`ubahnGroundApproachAtV326(x,z,native=false)` and
`hasUbahnGroundApproachSourceV326(id,native,asset)`. Terrain results must be used
only while the corresponding real packet is resident. The private source gate
checks all five original own data fields (`url`, `sha256`, `bytes`,
`decodedBytes`, `encoding`) against the literal-pinned frozen index. A public
prefix, inherited field or accessor is not ground authority.

The caller passes that gate and the actual terrain getter to
`attachPacketUbahnAccessV326Steps(entry,native,terrainHint,pureGround)`. Existing
mixed packets retain their ordinary geometric ground tests. The exact new
source-ground packets can declare pure ground after the private descriptor
check. Original position/index words, navigation and disposal ordering are
preserved. Existing packet CPU/GPU caps, camera visibility, mode lifetimes and
serial loader scheduling remain authoritative.

## Reproduction and proof

`build_ubahn_authored_ground_v326.py` reproduces the 9-ID ownership index from
the original complete AltMitte body/Native profiles and mapped water.
`build_ubahn_ground_approaches_v326.py --from-source` reproduces only new packets
and their index. A fresh extraction accepts the complete original 157-point audit;
it reads the retained exact U-Bahn PBF, connected access ways, complete selected
context objects and original official DGM tile bytes. The immutable published
206 manifest snapshot is used even after the live manifest gains new entries.

The four finite Python proofs check every new packet's words, bounds, DGM
support, Native containment, all old/new source exclusions and the complete
ledger. The three Bun tests call the real ordinary decoder and current adapter
with the real getter in both families/full/touch; they also prove disposal,
unchanged original bytes/navigation, every private descriptor field and rejection
of inherited/accessor authority. No whole-city build or second scene was used.

## Sources and credit

Geometry and tags: © OpenStreetMap contributors, retained Geofabrik Berlin
2026-09-29, ODbL 1.0. The complete source PBF identity and original connected
polylines remain in `ubahn-access-v326-source.json.gz` and the new source archive.

Heights: Geoportal Berlin, ATKIS DGM1, dl-de/zero-2-0. The official
[specification](https://gdi.berlin.de/data/dgm1/docs/dgm1.pdf) describes the 1 m
raster, two-kilometre source tiles and DHHN2016 height reference. The
[official download metadata](https://gdi.berlin.de/geonetwork/geonetwork/api/records/fa02f9e1-a0df-3be1-b0aa-bc624c0c7ff5)
and each complete retained tile URL/hash are recorded in the source archive.
No photograph, bitmap terrain texture or fabricated underground route is used.
