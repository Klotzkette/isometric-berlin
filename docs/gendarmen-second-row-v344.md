# Gendarmenmarkt: eight source-bound second-row elevations (v344)

Step 10, prepared for v1.0.224. The finite scope is the streets east of the already
authored square perimeter: Jägerstraße, Französische Straße, Taubenstraße,
Hausvogteiplatz and the Mohrenstraße return. This is an exterior recognition pass,
not a claim that every building in the neighbourhood is now surveyed or finished.

## Source ownership and architecture

All eight selected families are **active AltMitte-v169 core owners**. The original
metric walls, roof surfaces, courts and navigation remain unchanged. The 31 drawn
fronts are selected actual LoD2 WallSurfaces, with their part and polygon IDs in
`src/app/src/data/gendarmenSecondRowV344.json`. No guessed bounding-box building is
substituted. Thin opaque finishes clear the old generic sill sheets, so an old
regular window raster does not shine through the new facade.

| Place | Active source parent | Bounded exterior recognition |
| --- | --- | --- |
| Jägerstraße 33, Konfektionshaus Manheimer | `DEBE01YYK00005kU` | Arched ground openings, tall fluted pilasters, capitals, intermediate balustrades and the upper entablature on the measured corner faces. |
| Jägerstraße 49–50, Bankhaus Mendelssohn | `DEBE01YYK00002yB` | Two high storeys, muted sandstone courses, ground grilles, restrained classical lintels and the attic balustrade. This is deliberately distinct from the taller neighbouring house. |
| Jägerstraße 51, Wohnhaus Mendelssohn | `DEBE01YYK00002h7` | Pale plaster, four main storeys, light window frames, fine horizontal bands and a timber entrance. Existing upper roof geometry stays intact. |
| Hausvogteiplatz 1 | `DEBE01YYK00004Pi` | Six main facade levels below the retained upper building/roof, five broad window groups, narrow travertine strips and continuous sill bands. No invented classical ornament. |
| Hausvogteiplatz 2, modern Groth building | `DEBE01YYK0000DUa` | Rose-brown stone and blue-green window frames; the measured short faces preserve its shallow projecting window bows. This depicts the Pysall/Stahrenberg building of 1993–96, not its nineteenth-century predecessor. |
| Hausvogteiplatz 8–9 / Mohrenstraße, Zum Hausvoigt | `DEBE01YYK000027N` | Pale plaster, paired windows, the taller lower window level, restrained horizontal bands and the actual long, turning street/platz fronts. The treatment follows the post-war building rather than restoring lost pre-war ornament. |
| Französische Straße 32, Robert Bosch Stiftung | `DEBE01YYK00009AV` | Five-level white facade, eight fitted window axes, light frames, restrained cornices, rusticated/plinth reading and central timber portal. |
| Taubenstraße 26 | `DEBE01YYK0000DlQ` | Three broad glazed bays, subdivided window groups, colossal fluted pilasters, capitals, spandrel panels and the first-floor gallery rail. |

The parent/family mapping was checked against the official monument locations,
retained source footprints, OSM address nodes and existing ownership documents.
The fresh OSM map was used only during the address audit, not as a runtime asset.
Existing Gendarmenmarkt perimeter owners and Jägerstraße 28's v300 reconstruction
are excluded from the new scope.

## Reference photographs and evidence

Inspected 2026-11-14. The official archive photographs explicitly date from
1999/2001 and, for the two Mendelssohn properties, 2013. Their persistent facade
architecture is the reference; they are not presented as newly taken photographs.
Current project/property pages supplement identification where available.

- [Landesdenkmalamt: Manheimer, 09030037](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030037), official architectural account and LDA 2001 photograph.
- [Landesdenkmalamt: Bankhaus Mendelssohn, 09080277](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080277), material/storey distinction and LDA/Bittner 2013 photograph.
- [Landesdenkmalamt: Wohnhaus Mendelssohn, 09065005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065005), post-war height changes and LDA/Bittner 2013 photograph; [Mendelssohn-Palais](https://www.mendelssohn-palais.de/) provides the property context.
- [Landesdenkmalamt: Hausvogteiplatz 1, 09035327](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035327), travertine, horizontal window grouping and LDA 2001 photograph.
- [Groth Gruppe: Hausvogteiplatz 2](https://www.grothgruppe.de/Projekte/Hausvogteiplatz/), owner/developer's colour photograph and attribution to Pysall, Stahrenberg + Partner, construction 1993–96. This is the relevant present building; the old ensemble listing alone would misidentify the street facade.
- [Landesdenkmalamt: Zum Hausvoigt, 09030005](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030005), 1953–55 reconstruction context and LDA 1999 photograph. The retained OSM material tag also specifies pale plaster.
- [Robert Bosch Stiftung: contact/locations](https://bosch-stiftung.de/stiftung/kontakt), confirms Französische Straße 32. The foundation's facade photograph is credited to **Robert Bosch Stiftung**, reproduced in [Tagesspiegel, 22 June 2014](https://www.tagesspiegel.de/berlin/ein-haus-voller-geschichten-6915544.html). The photo, not a fictional office template, supplies the white elevation, window rhythm and stone portal.
- [Landesdenkmalamt: Taubenstraße 26, 09065007](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065007), three-axis shell-limestone facade, bowed glazing, colossal pilasters and LDA 1999 photograph.

References were read/visually inspected only. No external photograph, downloaded
image, raster texture, logo texture or online request is added to the viewer.
Colours under neutral daylight, bay fitting, moulding sizes, grilles and the
depth of minor details remain **display estimates**. There is no facade survey
or claim of exact sculptural reproduction.

## Actual-host contract and independent Native geometry

Call `createGendarmenSecondRowV344(world, native)` only after the resident
AltMitte source envelopes have been decoded and before static compaction/parking.
It always returns a `Group`, which can be empty.

`sourceWallHostV344.ts` checks the real source subtree, packet, indexed triangle
coordinates and complete world transform. A declaration of source parent IDs is
insufficient. Removed, moved or changed hosts admit no new facade. Every selected
drawn plane has exact packet receipts; no old prism is used as a stand-in for its
replacement LoD2 wall.

Native uses **130 actual cardinal support columns** extracted from the separate
resident Native packets. Continuous exposed y-runs are computed from those
triangles. The material/opening recipe is fitted and clipped to these real
axis-aligned rectangles, with Native-specific stepped arch segments. It does not
rotate a smooth facade, voxelise the drawn boxes, offset a guessed wall by one
metre or place detail over absent source support. No new Native body/envelope is
introduced. All resulting Native instance matrices have zero off-axis terms.

The same eight families and full static details are available on touch/mobile.
No view-distance, mobile, tour, flooded-mode or quality reduction is introduced.
Geometry is locally bundled and built once; no runtime fetch is added.

## Explicitly unresolved audit findings

These are **not silently claimed as fixed** by this facade-only pass:

- Bullenwinkel, Hausvogteiplatz 3–4: official family `DEBE01YYK00002LK` is marked
  `retained/source-conflict`; the active legacy prism `05610346` is only 9 m tall.
  Attaching the official 21 m facade to that legacy mass would float above it.
- Haus zur Berolina, Hausvogteiplatz 12: official family `DEBE01YYK0000AjP` is also
  retained because of a footprint conflict. Active legacy IDs are `24481330` and
  `24481331`. The distinctive clock/roof requires a separate complete ownership
  correction; it is not pasted onto an unrelated simplified wall here.
- Taubenstraße 23: family `DEBE01YYK00005B8` is active, but its retained source's
  street-front part is only 3 m tall despite the documented multistorey facade.
  This needs an audited source-height/body correction, not compressed windows.
- Jägerstraße 28 already belongs to the v300 refinement and is preserved.

## Size and validation

| Representation | Admitted families | Front records | Host columns | Instances | Instance buffer bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Drawn | 8 | 31 | — | 2,891 | 219,716 |
| Native | 8 | 18 | 130 | 4,937 | 375,212 |

Eight small spatially separate static batches in either mode. The JSON source
receipt file is 98,556 bytes, 13,903 bytes with deterministic gzip. Existing
metric source/roof/navigation buffers and city coverage budgets are unchanged.

Focused Bun tests pass: five tests / 41,213 assertions. They validate receipt
SHA-256s, the real decoded packet hosts with current ownership enabled, all eight
families in both modes, bounded facade dimensions, zero off-axis Native matrices,
empty-host rejection, moved-host rejection and bounded instance storage. Python
Ruff check/format and `git diff --check` pass. The root release task performs the
shared typecheck, build and public-viewer inspection; this module does not claim
those checks independently.
