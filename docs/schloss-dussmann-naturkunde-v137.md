# Schloss, Dussmann and Naturkunde — step 10, v1.0.37

The 93-place catalogue and approved polygon remain unchanged. These are
recognition buildings, not new tour stops. All five modes retain the source
geometry; Minecraft uses separate native block batches. No photograph, crop,
font file or image texture is distributed or loaded.

## Source geometry and explicit conflicts

`build_schloss_naturkunde_source.py` retains the 17 complete parts of Schloss
parent `DEBE01AL5N30002e` from official tile `391_5819`, dated 2 March 2026,
and the four Naturkunde parts of `DEBE01YYK00002C5` from tile `389_5821`.
The 213 kB JSON preserves source millimetres, every wall/roof sheet, the two
Schloss court holes, source ZIP hashes and all five previous display records.
The canonical geodata and prism payloads remain unchanged. All original
footprints are checked against the release polygon.

- Schloss retains OSM relation `3007958`. Its old 32 m flat OSM display gives
  way to the complete official source sheets, including varied roofs and
  courts. The source dome `DEBE3DzLpp1avSfB` has a tall extruded perimeter and
  fan roof; those planes remain recorded. The display subdivides only that
  dome into an octagonal drum and rounded copper roof within its measured
  plan and 64.870 m source top. The open lantern and five-metre cross complete
  the institution's published 70 m silhouette at viewer y=75.236. Intermediate
  member dimensions and dome curvature are display estimates. The preserved
  source-based voxel roof sampler uses the same dome subdivision.
- Naturkunde retains exact OSM node `538692583`, Invalidenstraße 43, and all
  four existing LoD2 parts. Its official ground is y=3.034 m; the existing
  delivered street/display base is y=5.2 m. The source sheets remain untouched
  and receive a documented +2.166 m display translation, preserving the street
  relationship. The main source top becomes y=31.250 m. The distinct additional
  eastern annex `DEBE01YYK0000Aqm` is retained in the ordinary city.
- Dussmann retains OSM node `1665158255`, LoD2 parent `DEBE01YYK00002Es`, all
  adjacent source parts and the previous east/south source axes. The northern
  return is taken from the same retained LoD2 outline. Its tall rectangular
  arcade, four regular upper window rows, shallow setback bands and historic
  four-storey returns replace the previous identical six-row grids. The
  unsupported solid rooftop boxes disappear; the source roofs remain. Local
  8.2 m arcade height, bay spacing and panel positions are photo-proportioned
  display estimates, not measured facade data.

## Architectural evidence

The Humboldt Forum's [architectural backgrounder](https://www.humboldtforum.org/wp-content/uploads/2020/12/20201202_HF-Architectural-Backgrounder.pdf)
supplies the 70 m overall height, octagonal tambour, reconstructed portals,
baroque facade programme, modern riverfront and open court/passage structure.
The display now has three baroque fronts with portal column orders, layered
window pediments and balustrades, plus a separate spare modern Spree facade.
Some compass labels in the English dossier describe interior court sides;
external facade orientation follows the official geometry and inspected photos.

[Landesdenkmalamt object 09011177,T,002](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011177%2CT)
establishes August Tiede's 1883–1889 Naturkunde building, the southern
round-arched facade, Brohl tuff, sandstone cornices, raised columned central
section, three scholar portrait fields and the two entrance figures. The
procedural front adds three levels of arches, stone bands, central columns,
attic, portrait cues, two simple figure silhouettes and entrance steps.
The 15-bay subdivision and unmeasured member dimensions remain display fits.
The museum's [building history](https://www.museumfuernaturkunde.berlin/de/museum/heute/das-museum/geschichte-des-museums)
provides institutional context; no future reconstruction proposal is modelled.

[Dussmann's imprint](https://www.kulturkaufhaus.de/de/service/impressum)
confirms the institutional address. The already credited 13 May 2026 photograph
provides the facade distinctions and red window-panel pattern. No change in
present-day tenant or shop programme is inferred from the image.

## Inspected external free-photo references

| File | Author | Licence | Role |
|---|---|---|---|
| [L01 490 Humboldt-Forum.jpg](https://commons.wikimedia.org/wiki/File:L01_490_Humboldt-Forum.jpg) | Falk2 / Falk Arnhold | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Baroque south facade, column orders, pediments and modern eastern boundary; 7 April 2023 |
| [The Dome Of Berlin Palace.jpg](https://commons.wikimedia.org/wiki/File:The_Dome_Of_Berlin_Palace.jpg) | AusleseBeeren | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Brown copper dome, ribs, octagonal drum, figures, open gilded lantern and cross; 8 March 2025 |
| [Berlin, Mitte, Invalidenstrasse 43, Museum für Naturkunde.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Invalidenstrasse_43,_Museum_f%C3%BCr_Naturkunde.jpg) | Jörg Zägel | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Protected facade form and stone tones; 7 April 2010, not a current construction-status survey |
| [Dussmann Das Kulturkaufhaus in Berlin (2026).jpg](https://commons.wikimedia.org/wiki/File:Dussmann_Das_Kulturkaufhaus_in_Berlin_(2026).jpg) | JoachimKohler-HB | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Tall square arcade, modern corner and distinct historic return; existing record reused |

The three new records are mirrored into both credit manifests. Photos remain
external visual evidence only; the procedural forms are labelled subdivisions.

## Measured static GPU budgets

These counts include every instance and shared geometry attribute/index buffer,
with full/mobile geometry identical. Night and the other drawn modes share the
same transforms and use the existing reversible material system.

| Layer | Draws | Instances | Buffer bytes |
|---|---:|---:|---:|
| Schloss + Naturkunde source sheets | 2 | — | 306,612 |
| Schloss + Naturkunde drawn details | 5 | 3,217 | 262,948 |
| Schloss + Naturkunde Minecraft shells | 1 | 10,441 | 794,164 |
| Schloss + Naturkunde Minecraft details | 1 | 2,432 | 185,480 |
| Entire Unter den Linden drawn layer | 10 | 1,669 | 129,268 |
| Entire Unter den Linden Minecraft layer | 1 | 396 | 30,744 |

The Unter den Linden revision adds 20 instances / 1,520 bytes (1.2%) to support
its newly distinguished northern/historic returns while retaining the existing
10-draw/<180 kB and native 1-draw/<50 kB ceilings. The formerly frozen 1,649
instance count is explicitly revised to 1,669 for the owner's requested model
improvement. Native Schloss/Naturkunde shells sample only the uppermost exposed
surfaces on a bounded 2.5 m grid; overlapping source parts create no hidden solid
infill. All GPU geometry is static and eligible for the shared v1.0.36 exact
vertex indexing pass.

Validation: two Python tests check unchanged source records, identities,
retained planes/courts and bounds; six focused frontend tests check the source
contract, common source/native dome roof, 70 m silhouette, batch budgets and
absence of smooth Minecraft doubles. The existing five Unter den Linden tests
pass with the documented new exact instance count.

Browser QA corrected the Naturkunde facade offset against the exact projecting
source risalit (up to 2.75 m); entry and window detail now sits outside its wall.
Long mouldings follow that stepped wall. Native facade cuboids retain their
source orientation instead of expanding to large world-axis bounding boxes.
Raycast and narrow-cornice regressions cover both issues.
