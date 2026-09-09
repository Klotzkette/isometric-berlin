# Pergamonmuseum, Neues Museum and Alte Nationalgalerie

Pipeline step 10, v1.0.10. The three recognition buildings remain inside the
committed release polygon. They do not change the 93-place tour catalogue.
The existing Bode-Museum supplement and every canonical source record remain.

## Metric source and additive replacement

`museumTriadSource.json` retains 26 complete building parts from official
[Berlin LoD2 tile 391_5820](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip),
created 2 March 2026, under dl-de/zero-2-0. Its download SHA-256 is
`ed927ae9ab86d06815eaa9e95e4a7abf328a876e7e680986192314155e203a08`.
Raw CityGML/ZIP and reference photographs stay outside the release.
The existing `build_spree_recognition_source.py` extraction helpers were reused
for original millimetre wall/roof surfaces and source rings; each parent footprint
was checked with `bounds.covers(...)` in EPSG:25833 before extraction.

| Building | Official parent | Parts | Viewer ground / maximum roof y | Previous OSM display |
| --- | --- | ---: | --- | --- |
| Pergamonmuseum | `DEBE01YYK0000AdR` | 12 | 1.214 / 44.876 m | way 313659704, 15 m height |
| Neues Museum | `DEBE01YYK00001VG` | 13 | 4.439 / 34.959 m | way 18578139, 12 m storey estimate |
| Alte Nationalgalerie | `DEBE01YYK00000rL` | 1 | 4.140 / 35.995 m | way 313670733, 9 m fallback |

The viewer coordinate system is x = easting − 389500, y = source height − 30,
z = 5820000 − northing. Ground and roof coordinates must not be confused with
above-ground building height. The source file preserves each prior OSM display
record verbatim. Only runtime coarse representations `13659704`, `18578139`
and `13670733` are suppressed. Minecraft exclusion tests exact old or official
footprints, not a neighbourhood radius. The museums' adjacent streets, Spree,
Bode-Museum and James-Simon-Galerie are not erased by the replacement.

## Architectural evidence and representation

The [Landesdenkmalamt Pergamonmuseum account](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/pergamonmuseum-654567.php)
supports the three-wing composition, largely windowless central hall, colossal
pilasters, projecting end pavilions and classical architectural orders. The model
keeps the exact twelve-part source roofs and adds two differentiated pavilion
fronts, six Ionic half-columns at each western front, shallow pediments,
window frames and long-wing pilasters. The low entrance volume is retained from
the source. It is not a reconstruction of the planned future fourth wing.
The [museum's current renovation account](https://www.smb.museum/museen-einrichtungen/pergamonmuseum/sanierung/)
and [4 May 2026 reopening announcement](https://www.smb.museum/nachrichten/detail/das-pergamonmuseum-kehrt-zurueck-eroeffnung-am-4-juni-2027/)
distinguish the retained architecture from ongoing works and future proposals.
Transient scaffold, cranes and anticipated completed extensions are not inferred
from older photographs or future masterplan renders.

[David Chipperfield Architects](https://davidchipperfield.com/projects/neues-museum)
identifies the restored historic fabric, reconstructed northwest wing and south
volume, and two glazed courtyard roofs of the Neues Museum. The
[Museumsinsel building account](https://www.museumsinsel-berlin.de/gebaeude/neues-museum/)
confirms the classical exterior and conservative restoration. Both long fronts
receive individual three-bay cross-hall risalits with tall windows and shallow
pediment articulation, while the remaining source wings retain their own
heights and roof shapes. Window framing, pale plaster, small repair patches and
courtyard roof subdivisions are procedural estimates. The museum's original
wall and roof coordinates are unchanged.

The [Landesdenkmalamt Alte Nationalgalerie account](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/alte-nationalgalerie-654560.php)
supports the high rusticated base, Corinthian order, open portico and equestrian
Friedrich Wilhelm IV monument on the stair landing. The model retains its
surveyed apsis, long side walls and roof envelope. Eight open front columns,
engaged side/apsis columns, red portico fields, glazed roof rhythm, pediment,
small sculptural silhouettes and code-built gilded inscription provide its
recognition features. Twin stair flights and intermediate landings follow the
space occupied by the retained OSM stair wings. Calandrelli's equestrian monument
and four base figures are simplified procedural silhouettes, not sculpture scans.

## Explicit source conflicts and display limits

1. OSM's previous low prisms omit all three roof silhouettes and greatly
   understate overall height. The complete official parts are the runtime
   geometry authority; the OSM identity, previous geometry and original height
   derivation remain recorded.
2. LoD2 closes the Nationalgalerie's elevated portico. The renderer clips only
   that upper infill into retained base, inner wall and entablature, leaving
   the space between its eight columns open. Its 13.54 m floor, 25.2 m local
   inner-wall boundary and detailed column sections are photograph-proportioned
   display dimensions, not independent surveys. Collision grants a bounded
   capsule void below the canopy while keeping roof landings and column solids.
3. The source Nationalgalerie roof is a coarse hipped envelope. Its photographed
   pediment, rooflight members and small crown figures are procedural additions;
   the principal roof maximum stays 35.995 m. The small source-absent crown
   figures extend locally above that roof, up to approximately 38.65 m.
4. The Neues Museum's source footprints preserve two courtyard voids, while the
   architectural record confirms contemporary glazing. Thin rooflight plates
   at the estimated 26.9 m viewer level supplement those voids. These rooflight
   subdivisions are not presented as measured LoD2 surfaces.
5. Pergamon's primary source pages include future schemes and old construction
   imagery. The viewer represents retained source-bound fabric and does not
   present a planned fourth wing as already built.

## Licensed visual checks

All seven files were downloaded to an ignored/local QA directory, their metadata
was checked, and their actual images were inspected. All are CC BY-SA 4.0.
No photograph, crop, atlas or photo texture is bundled or loaded by the viewer.

| Photograph | Author | Use |
| --- | --- | --- |
| [Berlin, Pergamonmuseum 2014-07.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Pergamonmuseum_2014-07.jpg) | HerrAdams | Pavilion columns, pediment and stone detail |
| [Pergamonmuseum Front.jpg](https://commons.wikimedia.org/wiki/File:Pergamonmuseum_Front.jpg) | Raimond Spekking | Courtyard wings, pilasters, windowless centre |
| [(20260607) Neues Museum Berlin 131455.jpg](https://commons.wikimedia.org/wiki/File:(20260607)_Neues_Museum_Berlin_131455.jpg) | Roy Zuo | Restored plaster, framing and relief scale |
| [Berlin, Neues Museum 2014-07 (1).jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Neues_Museum_2014-07_(1).jpg) | HerrAdams | Cross-hall facade hierarchy and pediment |
| [Berlin Neues Museum from Berliner Dom 02.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Neues_Museum_from_Berliner_Dom_02.jpg) | Ad Meskens | Actual subject is Alte Nationalgalerie: rooflight and stairs |
| [Alte Nationalgalerie, 2024 (01).jpg](https://commons.wikimedia.org/wiki/File:Alte_Nationalgalerie,_2024_(01).jpg) | Bahnfrend | Front columns, inscription, red wall and monument |
| [Alte Nationalgalerie, 2024 (02).jpg](https://commons.wikimedia.org/wiki/File:Alte_Nationalgalerie,_2024_(02).jpg) | Bahnfrend | Side order and twin stair flights |

The misleading `Berlin Neues Museum from Berliner Dom 02.jpg` filename is
retained verbatim for attribution, but its subject was corrected after inspection;
it is never used as Neues Museum identity or metric evidence.

## Construction cost and validation

All smooth modes share one original-surface mesh and two instanced detail
batches. Minecraft uses one independently built, surface-only box batch.
There is no hidden whole-building voxel fill and no per-window mesh. Mobile
reduces microdetail, roof seams, stair subdivision and roof-cell density while
retaining every building, portico column and source wing.

| Profile | Draw calls | Instances | Retained geometry/instance bytes | Rendered vertices |
| --- | ---: | ---: | ---: | ---: |
| Smooth full | 3 | 6,332 | 585,836 | 160,413 |
| Smooth mobile | 3 | 4,850 | 472,532 | 122,253 |
| Minecraft full | 1 | 19,255 | 1,464,028 | 462,120 |
| Minecraft mobile | 1 | 10,551 | 802,524 | 253,224 |

Focused tests cover retained source records, all parts and maximum heights,
sloped roof sampling with nearly collinear source vertices, neighbouring feature
preservation, eight-column portico clearance and real mesh-ray visibility of the
inset red wall in all four build profiles. Software orthographic plates are
rendered from actual Three.js triangles and instance matrices. These inspect
geometry and do not claim a browser or physical iPhone rendering test.
