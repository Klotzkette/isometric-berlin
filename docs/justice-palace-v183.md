# Courthouses and Charlottenburg palace — v1.0.83

Step 10 adds bounded source contours, shallow facade members, upper
recognition outlines and a hollow palace cupola skin at the owner's four requested places. All earlier source
owners, courtyards and detailed models remain intact. There is no replacement
city shell, hidden solid fill, texture or additional tour stop.

## Metric anchors and retained ownership

| Place | Retained OSM identity | Exact Berlin LoD2 parent |
|---|---|---|
| Littenstraße courts | relation/304171 | DEBE01YYK000017e |
| Tegeler Weg historic court | relation/1666054 | DEBE04YY500008YZ |
| Schloss Charlottenburg | way/186517395 | DEBE04YY500000nx, DEBE04YY500002jj |
| Kriminalgericht Moabit | relation/7721745 | DEBE01YYK0002Nu1; complete v166 model |

The bounded OSM selections use the retained Geofabrik Berlin extract of
29 September 2026 (ODbL-1.0). Source rings, wall planes and original elevations
are preserved in `justice-palace-v183-evidence.json` (dl-de/zero-2-0), with tile
URLs and SHA-256. No additional LoD2 downloads were necessary. The ground is
aligned to the established local source owner; Moabit retains v166's 5.2 m
translation and the three other places use the outer-city 3 m ground.

Tegeler Weg's separate 1987 north extension, way/274983227, is retained by its
existing generic owner; this architectural overlay applies to the historic
building. All palace wings selected by the palace OSM outline remain present.

## Source conflicts, current forms and estimates

- **Moabit:** [LDA 09050355](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050355)
  describes two approximately 60 m flanking towers and a lower approximately
  48 m eastern corner dome. The existing official parts already give the
  correct hierarchy: `DEBE3DKcoXNN1Az9` reaches **61.634 m viewer Y**,
  `DEBE3DmjpESi9DgG` reaches **63.064 m**, and `DEBE3DSvRrQlvxN0` reaches
  **51.299 m**. These are absolute viewer coordinates, not ground-relative
  published heights. No old tower is removed, duplicated or relocated.
  The LoD2 upper roofs generalize the caps as angular planes; the photographs
  show curved copper caps and the broad corner dome. Added contour ribs and
  pale upper members are estimates within the existing plan/top envelope.
  All source triangles and the v166 facade remain untouched. This is a
  restrained recognition reading, not replacement sculptural roof geometry.
  The separate wide main-wing part `DEBE3DZuPJnvKibt` is only **3 m** high,
  despite the current photograph/DOP showing the tall four-storey court wings.
  Its exact footprint receives a thin upper facade with an estimated **21 m
  eave**, **29 m ordinary ridge** and **34 m central roof ridge**, all relative
  to the established 5.2 m ground. These added lines are clipped to the exact
  source footprint and its courts. They retain the low source body and do not
  replace or duplicate the three tall official parts.
  A thin opaque wall backing closes the floating-window artifact revealed by
  viewer QA: 117 original wall planes of this low part receive an 8 cm skin
  only from their measured top at viewer Y=8.2 to the existing estimated eave
  at Y=26.2. No footprint, measured source height or tower geometry changes.
  The matching upper roof is now a hollow surface over the exact original
  low-part roof footprint. Its estimated profile interpolates between the same
  Y=26.2 eave and existing DOP ridge levels (ordinary Y=34.2, central Y=39.2).
  All original courtyard holes stay open; no interior volume is filled.
- **Littenstraße:** the official parent is only **3.081 m** high and flat,
  conflicting with the retained OSM five-level description and current
  photographs. Its source edges remain present. Thin upper walls/window frames
  reach an explicitly estimated **24 m eave** and DOP-aligned ridge lines
  reach **28 m above the 3 m viewer ground**. This is not a measured vertical
  correction or a new solid building. [The court's history](https://www.berlin.de/gerichte/landgericht-zivil/das-gericht/wir-ueber-uns/historisches/littenstrasse/artikel.1310862.php)
  establishes that the old Grunerstraße wing and its two nearly 60 m corner
  towers were demolished in 1968/69. They are **not reconstructed**.
  [LDA 09011278](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011278)
  establishes the surviving baroque facade and simplified postwar frontage.
  The same bounded correction applies to 77 original wall planes: 8 cm opaque
  backing behind the frames from source top Y=6.081 to the already estimated
  eave Y=27. The exact source-wall courses retain the open courtyard layout.
  A matching thin roof skin joins that eave to the already estimated Y=31
  ridges, confined to the original source roof polygons and their holes.
- **Tegeler Weg:** the measured parent is a flat **21.409 m** envelope, while
  [LDA 09096467](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096467)
  and [the district account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/gebaeude-und-anlagen/verwaltungs-und-gerichtsgebaeude/artikel.1348528.php)
  establish the Romanesque windows, elevated central projection, high triangle
  gable and pitched roof. Paired arch cues stay on the source walls. Added
  ridge/gable hairlines at **30/37 m above ground** are photo/DOP-aligned
  estimates. The source parent is preserved. No speculative castle tower is
  added.
- **Schloss Charlottenburg:** the main measured parent reaches only **19.184 m**;
  the second selected parent reaches **24.982 m**. Neither includes the central
  tower. [LDA 09040610](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040610)
  publishes a **45 m cupola tower**, which supplies the supplement's overall
  vertical scale. Its centre at **[-5133, -338] world X/Z** is an approximate
  DOP alignment to the exact source frontage. Drum radii, cornices, cupola
  divisions, lantern, clocks and the small gilded finial are estimates.
  [The district account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/kultur-und-wissenschaft/museen/artikel.156575.php)
  identifies Richard Scheibe's 1954 Fortuna recreation. The tiny gilded
  finial indicates its presence without reproducing the sculpture. Source
  buildings and their open Ehrenhof remain unchanged.
  Visual QA showed that contour ribs alone disappeared against the garden.
  The existing estimated drum/cupola profile therefore receives a thin opaque
  faceted skin: pale drum, dark window fields and green copper dome. The lantern
  between viewer Y=41 and 44.3 remains open. No radius or elevation is enlarged,
  no new source footprint is substituted and the body stays hollow. Minecraft
  uses 5,629 independently generated orthogonal surface blocks, wholly inside
  the same radial profile, without a smooth duplicate or interior fill.

All facade rhythms, window counts, pale frames and paired arches are procedural
recognition estimates, not a facade survey. For the source-height conflict in
Littenstraße and the low Moabit main-wing part, the upper skin explicitly extends above the low source wall.
DOP roof ridge readings are clipped to the current OSM building footprint,
including its holes, so these lines do not roof over courts.

## Inspected visual evidence

`justice-palace-v183-references.json` contains per-file credits for the following
external Commons references, all inspected at 960 px on 7 October 2026. The
existing Moabit corner photograph is reused; the other records can be appended
to the shared attribution manifests by the release integrator.

| File | Author / licence | Observation |
|---|---|---|
| [Landgericht Berlin Tegeler Weg.jpg](https://commons.wikimedia.org/wiki/File:Landgericht_Berlin_Tegeler_Weg.jpg) | Gerd Fahrenhorst, CC BY-SA 3.0 | Pale masonry, paired round-headed openings, steep central gable, long red roof |
| [Littenstraße Amtsgericht rechte Seite 0516.jpg](https://commons.wikimedia.org/wiki/File:Littenstra%C3%9Fe_Amtsgericht_rechte_Seite_0516.jpg) | Dosseman, CC BY-SA 4.0 | Pale frames, divided windows, textured masonry and existing baroque upper ornament |
| [Berlin Schloss Charlottenburg Gartenseite.JPG](https://commons.wikimedia.org/wiki/File:Berlin_Schloss_Charlottenburg_Gartenseite.JPG) | Times, CC BY-SA 3.0 | Long pale facade, tall piano nobile, small mezzanine windows, green drum/cupola/lantern hierarchy |
| [MoabitTurmstraße Kriminalgericht-1.jpg](https://commons.wikimedia.org/wiki/File:MoabitTurmstra%C3%9Fe_Kriminalgericht-1.jpg) | Fridolin freudenfett (Peter Kuley), CC BY-SA 3.0 | Broad east corner dome, pale piers and surrounds |
| [Turmstr B-Moabit Kriminalgericht 07-2014.jpg](https://commons.wikimedia.org/wiki/File:Turmstr_B-Moabit_Kriminalgericht_07-2014.jpg) | A.Savin, CC BY-SA 3.0 | Two slender flanking towers with tall upper openings and curved green copper caps |

Official **DOP spring 2025** was inspected through
`https://gdi.berlin.de/services/wms/dop_2025_fruehjahr`, layer `dop_2025`,
EPSG:25833 bounding boxes `[384080,5820240,384610,5820400]` (palace),
`[392295,5819810,392470,5820030]` (Littenstraße), and
`[384485,5820955,384610,5821115]` (Tegeler Weg), and
`[388200,5820760,388480,5820900]` (Moabit). These reference images remain
in the ignored raw cache. No photographic pixels, crops or textures ship.

## Runtime integration and verification

Lazy-load `JusticePalaceV183.createJusticePalaceV183()` for drawn modes and
`MinecraftJusticePalaceV183.createMinecraftJusticePalaceV183()` for Minecraft.
Their JSON payloads are independent: loading the drawn module does not load
the native array and vice versa. Keep all existing owners, masks and v166
Moabit factories. **No new suppression predicate is required.**

The smooth addition has **24,913 segments and 15,407 shallow instances**, plus
the hollow palace skin and **4,559 courthouse roof triangles**, in **four draw
calls**, below **2.80 MB source JSON / 3.08 MB GPU buffers**.
Pointer and touch use identical detail. Minecraft has **51,588 independent
orthogonal strips/contour blocks** plus **5,629 cupola surface blocks** in **two
draw calls**, below **2.35 MB JSON / 4.36 MB GPU buffers**, with no smooth-line
double and no solid voxel fill.
Existing complete native source buildings remain their owners.
The added 5,457 native wall strips follow only the 194 source wall courses;
overlapping narrow orthogonal steps avoid diagonal gaps without filling any
interior or courtyard. `estimatedWallSkins` records each original wall index,
drawn box index, retained source top and estimated eave for independent tests.
Native roof cells span only the minimum/maximum local roof height sampled at
their corners, edge midpoints and centre, plus 9 cm overlap above/below. This
connects adjacent block steps without the see-through gaps of isolated thin
tiles, and retains the same X/Z cells and roof profile. They never extend down
to the source roof or ground; tests check over 60,000 neighbouring height bands.
The separate drawn triangles reconstruct the original roof footprint union
within 0.003 m², including the source courtyard voids. All roof interpolation
is explicitly a display estimate, not newly measured geometry.

Run `uv run python scripts/build_justice_palace_v183.py`, then the focused
`uv run pytest tests/test_justice_palace_v183.py -q` and
`bun test src/app/tests/justice-palace-v183.test.ts`. Python checks complete
source edge submission, retained owner identities, the two-tower/one-dome
hierarchy, absent demolished Littenstraße towers, bounded surface-only payloads,
and deterministic output from the committed evidence. Bun checks final-count
GPU buffers, frozen transforms, separate representations and orthogonal native
matrices. The release integrator owns whole-viewer build and browser mode QA.
