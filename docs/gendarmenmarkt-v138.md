# Gendarmenmarkt: complete silhouettes and bounded recognition detail

Pipeline step 10. This is a recognition ensemble within the approved polygon;
it does not add stops to the 93-place tour. No source photograph, texture,
sculpture scan or font is bundled or fetched by the viewer.

## Metric source correction

The canonical scene retained only five of the Konzerthaus parts and used OSM
fallback prisms for the two churches and two dome towers. In particular, the
Französische Friedrichstadtkirche had a 3 m fallback, the Deutscher Dom a 6 m
fallback, and the Französischer Dom a 14 m fallback. These are retained as
evidence but are not sufficient architectural heights.

The existing ignored official [LoD2 tile 390_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip)
contains the complete ensemble. `gendarmenmarktSource.json` preserves every
original wall/roof surface and the nine prior scene prisms (160,337 bytes):

| Building | Official parent | Parts | OSM identity |
| --- | --- | ---: | --- |
| Französische Friedrichstadtkirche | `DEBE01YYK000000j` | 2 | way/43346292 |
| Französischer Dom | `DEBE01YYK00000sJ` | 3 | way/28248283 |
| Neue Kirche | `DEBE01YYK00004Lg` | 2 | way/43347597 |
| Deutscher Dom | `DEBE01YYK000085g` | 3 | way/43347270 |
| Konzerthaus | `DEBE01YYK0000ESD` | 7 | way/217512230 |

The original source ground elevations range from 2.436 to 4.359 m in the viewer
frame. Each complete building is translated to the retained 5.2 m street datum;
these translations are explicit in the source subset. French and German tower
tops consequently remain 66.560 and 68.206 m in the scene. Published general
height claims do not override the exact retained source envelopes.

The tower's high circular extrusions and coarse fan roofs are replaced only in
display by curved drums and copper crowns, fitted inside their measured rings
and maximum tops. The source sheets remain intact. The other three buildings
use the original full LoD2 sheets directly. Native Minecraft uses only upper
roof/exposed wall cells, without buried full-building fill. Matching authored
tower roof queries keep the navigation surface consistent with the crown.

Regenerate from retained ignored data using:

```sh
uv run python -m scripts.build_gendarmenmarkt_source
```

## Architectural evidence

The [Landesdenkmalamt Französischer Dom record, 09065017](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065017)
describes both matching Gontard towers: a Greek-cross base, three six-column
Corinthian temple fronts, twelve Corinthian columns around each drum, a
balustraded entablature and a steep copper-covered dome. It also distinguishes
the transverse French church with rounded ends from the southern Neue Kirche.
The [Deutscher Dom record, 09065016](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065016)
identifies the southern complex. The displayed columns, capitals, dark openings,
pediments, roof figures and copper ribs are bounded procedural subdivisions,
not surveyed member dimensions or exact copies of the relief programmes.

The [Konzerthaus exterior account](https://www.konzerthaus.de/en/konzerthaus/architecture/outside)
documents the 29 stair treads, music-making cupids on a lion/panther, modern
building lettering and Apollo's griffin-drawn chariot. The
[Staatliche Museen Schinkel account](https://schinkel.smb.museum/image_orte.php?id=25)
and [Konzerthaus 2021 anniversary account](https://www.konzerthaus.de/en/amplifier)
confirm the six Ionic front columns. The model retains the taller central
building, two lower side wings, source-bound windows, deep portico and stairs.
Window divisions, lettering size and sculptural anatomy are display estimates.
The operator's exterior photographs by Felix Löchner / Sichtkreis were inspected
on that architecture page only (facade photograph `sichtkreis-4897_ret` and
Apollo photograph `sichtkreis-4936`); they are neither copied into the repository
nor used as textures. No new Wikimedia image was used.

The square uses the exact existing OSM way `844740667`, including its four
measured corners, and Schiller's exact OSM node `262457570`. The
[Berlin reopening announcement of 13 March 2025](https://www.berlin.de/sen/web/presse/pressemitteilungen/2025/20250313_pm_eroeffnung-gm.pdf)
documents the renewed natural-stone paving and accessible public space.
The 38,092.072 m² OSM square/POI outline is not equated with the announcement's
14,000 m² construction area. Thin, sparse larger-grid joints are an illustrative
paving reading, not a stone-by-stone survey. Existing mapped trees and streets
remain supplied by their existing layers. No obsolete lawns or new tree pattern
is invented.

The [Landesdenkmalamt Schiller record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09060093)
and [Bildhauerei in Berlin record](https://bildhauerei-in-berlin.de/bildwerk/schillerdenkmal-7834/)
identify Reinhold Begas's marble poet and four seated allegories. The square
adds their bounded five-figure recognition silhouette and bowl/plinth tiers;
its old generic monument is suppressed, and no inscriptions are reproduced.

## Rendering and checks

All drawn modes share the same static, texture-free ensemble. Full and mobile
retain the same detail. Minecraft substitutes cuboid facades, stepped domes
and native surface envelopes; it never layers a smooth tower over a voxel one.
Rotated narrow members keep their actual bearing rather than expanding to
world-aligned bounding plates. Native facade offsets clear their coarse wall
cells so windows remain visible.

| Representation | Draws | Instances | Geometry + instance bytes |
| --- | ---: | ---: | ---: |
| Original church/theatre sheets | 3 | 0 | 128,196 |
| Drawn towers, facades, square | 7 | 5,032 | 420,496 |
| Native church/theatre shells | 1 | 2,110 | 161,008 |
| Native towers, facades, square | 2 | 5,205 | 396,660 |

The complete ensemble is below 600 KB per presentation. Model construction
measured about 35 ms in Bun; this is not a physical-iPhone measurement.
Focused tests verify source preservation, approved bounds, all 17 parts, native
cube geometry, curved roof queries and front-window ray visibility against the
actual shell in both readings. Isolated Chrome visual checks cover the whole
ensemble and close theatre/tower views in drawn and Minecraft modes.
