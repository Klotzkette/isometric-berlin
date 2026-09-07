# Abgeordnetenhaus refinement — step 10

The Berlin parliament now has a dedicated source-plan model in all five visual
modes. It replaces the former 96 × 82 m recognition box with its exact delivered
main outline, six open courtyards, a projected central facade, six colossal
columns, seven upper arches, three entrance portals, individual side-window
pediments, a flat balustraded crown and a low hipped glass plenary roof.

## Evidence and limits

The [parliament architecture record](https://www.parlament-berlin.de/das-haus/architektur),
[official building brochure](https://www.parlament-berlin.de/media/download/541)
and [Landesdenkmalamt object 09096004](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096004)
document the rusticated sandstone front, Corinthian colossal order, projecting
cornice and six-storey plastered rear. The current facade view in the
[official press photographs](https://www.parlament-berlin.de/aktuelles-presse/pressebilder-zum-download)
by Peter Thieme supports seven large central arches, six columns, three portals,
four pedimented side bays per wing and the flat crown. No central triangular
pediment was invented. Photographs are reference-only; none is bundled, traced
or loaded as a runtime texture.

The delivered main prism `eaCxS2u2` (`DEBE3DEXeaCxS2u2`, parent
`DEBE01YYK00003f4`) has a valid 51-point exterior ring and six courtyard holes,
but records only **3 m height**. An independent check of the official
[LoD2_390_5818 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5818.zip)
confirmed the same faulty main envelope; there is no hidden tall main part to
recover. The tile was created 2026-03-02 and retrieved 2026-09-07, has 4,339,514
bytes and SHA-256
`42af73193652b7506736cf1f833db00ebbc0a882d285fae264b7881d04a208b3`.
Its source ground/top are 2.346/5.598 m in this world frame; the existing delivered
4.8 m runtime ground remains the display datum. The raw archive stays ignored.

Only the faulty main prism is replaced. Six valid rear annex IDs `ASuXBpgY`,
`ltmlmF6Q`, `HT7phwoi`, `XpFKEmWh`, `NIZyBCeG` and `iPl7a3aT` retain their
source envelopes, positions and approximately 5.4–17.2 m heights. No source
payload or GeoPackage was rewritten.

The **25 m main wall and 28 m central facade are photo-proportioned display
estimates, not measured heights**. Mouldings, carving, window dimensions and
roof profile are likewise bounded procedural reconstruction. The glass ridge
is at world y = 33.0 m and the highest balustrade cap at y = 34.06 m.
The footprint and courtyard geometry are exact source coordinates.

## Modes, movement and cost

Day, Night, Snowstorm and Schwellenraum share the same aligned geometry and use
the existing reversible material presentation. Minecraft uses only cuboids,
stepped arches/pediments and a coarser balustrade. It replaces exactly 476 faulty
source columns; conservative roof-cell clipping leaves every court open.
Mobile keeps all principal facade cues while reducing carving and subdivisions.

Pedestrian collision uses the same main polygon and six holes. Its height now
follows the reconstructed wall, hip and central crown envelope instead of the
old 3 m shell. The variable hip admits small uphill movement steps; ordinary
source roofs retain their existing tolerance. Court boundaries keep capsule
clearance without inheriting the taller central crown. Other source obstacles,
including all six annexes, remain unchanged.

| Representation | Instances | Draw calls | Geometry + instance bytes |
|---|---:|---:|---:|
| Drawn full | 2,558 | 7 | 240,920 |
| Drawn mobile | 1,550 | 7 | 148,568 |
| Minecraft full | 3,301 | 1 | 251,524 |
| Minecraft mobile | 2,627 | 1 | 200,300 |

Geometry tests verify source-plan equality, roof area minus all courts,
courtyard ray clearance, contained roof tiles, principal facade cues, materials
and bounded memory. Movement tests cover exact annex retention, wall blocking,
vertical arrival, walking up/down the hip and courtyard-edge clearance. The
integration test exercises actual city material switching and source exclusions.
