# Musikinstrumenten-Museum: datum, roof and public entrance correction

Step 10, v1.0.11. This corrects the museum section of the
[v1.0.5 recognition pass](museum-lenne-refinement.md). The Lennéstraße
3/5/7/9/11 buildings are unchanged, and no tour stop is added.

## Why the earlier model was wrong

The fourteen LoD2 parts under `DEBE01YYK0002Kgr` use a common basement
GroundSurface of **28.848 m NHN**, while the delivered street terrain around
the museum is approximately 34 m NHN. The old generic prism added the full
basement-to-roof height to that street terrain. Its exhibition hall therefore
reached viewer y=19.4 instead of the official roof y=13.914; the other parts
were inflated by approximately 4.85–5.5 m as well. This was an elevation error,
not evidence that the entire museum needed moving horizontally.

A second problem affected its public entrance: the separate LoD2 structure
`DEBE01YYK0003U6g` was missing from the fourteen-part museum selection. Its
canopy remained a generic closed, overly tall extrusion alongside a substitute
canopy authored too far north. The [Scharoun Gesellschaft's building account](https://scharoun-gesellschaft.de/institut-fuer-musikforschung-berlin/)
identifies the 2007 move of the public entrance to Ben-Gurion-Straße and the
small Wisniewski extension. The [museum's current visitor information](https://www.simpk.de/museum/besuch-des-musikinstrumenten-museums/oeffnungszeiten-anfahrt.html)
confirms Ben-Gurion-Straße 1 as the visitor address. This is distinct from
the institute's garden-side access.

## Preserved source geometry

`musicMuseumSource.json` contains all **15 source parts / 158 polygons**,
including GroundSurfaces; 143 polygons are WallSurfaces or RoofSurfaces.
The fourteen principal parts come from
[LoD2 tile 389_5818](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip),
and the separate entrance canopy comes from
[tile 389_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip).
Both source creations are dated 2 March 2026. Each archive SHA-256 and the
EPSG:25833 origin `[389500, 5820000, 30]` are recorded. Licensing remains
Geoportal Berlin, dl-de/zero-2-0.

Every original v1.0.5 prism remains unchanged, in its original order, in
`museumLennePrisms.json`; the exact already-delivered `K0003U6g` record is
appended as record 37. The raw city payloads are not rewritten. The source
roof polygons now use their absolute NHN heights. Source basement walls remain
in the evidence JSON; the visible wall mesh begins at the delivered street
ground. No horizontal relocation or source scale change is applied.

The source extraction preserves each GML Polygon independently. In particular,
one HUDk4q9R WallSurface contains two disconnected exterior polygons, which
must not be misread as an exterior plus an invalid interior hole.

## Roof and entrance

The [official DOP 2025 spring orthophoto](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was actually inspected in EPSG:25833 bounds
`[389390, 5818930, 389510, 5819120]`. It shows **fourteen parallel rooflight
bands** spanning the main hall, while the previous model supplied eight short
8 m-deep teeth. The new bands span the hall width and are clipped to the
source footprint and the orthophoto-observed eastern setback; they do not
continue onto the gold entrance return. Their 2.4 m rise fits within the
retained 13.914 m hall roof maximum. The count and alignment come from DOP
interpretation, not a facade or roof survey. Seam width and local rise remain
explicit display estimates. Other pitched roofs use the actual LoD2 planes
instead of a generic roof code and a fitted rectangle.

The separate canopy uses its exact source roof at **38.053 m NHN / viewer
8.053 m**. Its coarse vertical envelope is presented as the photographed open
canopy; it does not become an occupied wall enclosing the pavement. The glass
door and three small sloping rooflets follow the actual main-hall edge
`[-38.9, 940.3] → [-37.1, 953.0]`, behind that source canopy. The superseded
northern substitute is removed. Rooflet dimensions and the procedural
MUSIKINSTRUMENTEN-MUSEUM lettering are display details; the rooflets reach
viewer y=10.4 without changing the source canopy record.

The gold corner field, low round opening, two upper oval openings, narrow
staggered facade panels and institute glazing retain the reference vocabulary
at the corrected heights. The two already-credited photographs were inspected
again: Andreas Praefcke's
[Berlin Musikinstrumentenmuseum 01.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Musikinstrumentenmuseum_01.jpg)
(CC BY 3.0) and Magnus Manske's
[State Institute for Music Research.jpg](https://commons.wikimedia.org/wiki/File:State_Institute_for_Music_Research.jpg)
(CC BY-SA 3.0). They remain reference-only. No photograph, poster, orthophoto,
crop or texture is included in the viewer, and no duplicate Commons credit is
needed.

## Runtime and verification

All fifteen generic drawn bodies and corresponding Minecraft columns are
replaced by the museum reading. Minecraft uses surface-only native blocks.
Its replacement predicate requires positive cell/footprint overlap **and an
exact match to the old quantized source height**. A less-than-maximum test
incorrectly claimed the adjacent low Philharmonie wing `K0003VMd`; independent
review caught this and regression tests preserve those cells.

Pedestrian roof support follows the actual roof plane or one-metre Minecraft
roof grid. The open canopy has an explicit walkable void below y=7.80 and
retains roof landing support; its supplemental rooflet maximum is 10.4.
The institute courtyard and the five Lenné tower gaps remain open.

| Complete museum + Lenné detail layer | Draw calls | Instances | Retained geometry and instance bytes |
|---|---:|---:|---:|
| Drawn full | 2 | 11,249 | 895,844 |
| Drawn mobile | 2 | 5,551 | 462,040 |
| Minecraft full | 1 | 12,267 | 932,940 |
| Minecraft mobile | 1 | 12,227 | 929,900 |

The full/mobile roof structure is identical; mobile reduces facade detail.
The Lenné-only instance records were compared against v1.0.10 and are
byte-for-byte unchanged in all four combinations (6,922 / 4,225 drawn and
4,031 / 4,410 Minecraft instances).

Thirteen focused tests cover the 37 original-source records, all fourteen
basement datum corrections, the fifteenth entrance, outward facade placement,
actual downward rays across every roof, visible entry/CMS glazing in front of
retained source geometry, native-cell ownership and neighboring mass retention.
Actual Three.js triangles and instance matrices were also rendered as software
orthographic QA plates for the museum exterior, entrance and Minecraft reading.
These are geometry checks, not browser screenshots or direct-device tests.
