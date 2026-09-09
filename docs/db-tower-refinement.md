# BahnTower at Potsdamer Platz — v1.0.11

Pipeline step 10 replaces the old twelve narrow facade belts with a complete
source-bound glass-and-steel tower. Its position is unchanged. Berlin LoD2
parent `DEBE01YYK0002KhX` remains the metric anchor at Potsdamer Platz 2;
the three delivered prism IDs are `NKE26iHe`, `xpXBjoqL`, `VHDXBTJj`.
The 93-place catalogue and release polygon are unchanged.

## Retained source geometry

`src/app/src/dbTowerSource.json` preserves all three original prism records
verbatim, plus all 99 original wall/roof polygons from the official 2026-03-02
LoD2 tile. `scripts/build_db_tower_source.py` reproduces this 19,830-byte file,
checks the parent footprint against the release polygon, and never exports
other buildings from the raw archive.

- Archive: <https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip>
- Archive SHA-256: `827a94eda224f55ec638b1b4de8c440c80405ea6797068efe7558c83a4fd30c1`
- Licence: Geoportal Berlin, dl-de/zero-2-0.
- Viewer frame: easting minus 389,500 m; up minus 30 m;
  south equals 5,820,000 m minus northing.

The original ground is 4.923 m in this frame. The delivered prisms are grounded
at 5.3 m, so all exact surfaces receive the same **+0.377 m** display translation.
Their measured plan coordinates and relative heights do not change.

| Source part | Roof top, original | Roof top, viewer |
|---|---:|---:|
| `DEBE3DlYxpXBjoqL` — main curved body | 98.952 m | 99.329 m |
| `DEBE3DSUVHDXBTJj` — set-back upper body | 107.701 m | 108.078 m |
| `DEBE3DalNKE26iHe` — slightly inclined roof strip | 108.116 m | 108.493 m |

The last roof is a retained shallow inclined plane. It is not made into a
single flat 103 m tower cap. Pedestrian roof callbacks sample these same
planes. Minecraft substitutes only cells supported by an original footprint
and matching its ground-relative four-metre raster height; unrelated low
canopies and taller neighbours are not removed by a broad rectangle.

## Architectural evidence and display decisions

[AUKETT + HEESE's completed 2020–2024 refurbishment account](https://www.aukett-heese.de/de/projects/sony-center-bahntower/)
identifies the 103 m, 26-storey tower, Helmut Jahn / JAHN Architects and PWP,
and Deutsche Bahn's return in summer 2024.
[Berlin's official visitor account](https://www.berlin.de/en/attractions-and-sights/3560868-3104052-sony-center.en.html)
places the glass skyscraper at the eastern end of the Center am Potsdamer Platz.
[Deutsche Bahn's access document](https://ir.deutschebahn.com/fileadmin/Anhaenge/Wegbeschreibungen_Deutsche_Bahn_Potsdamer_Platz_en.pdf)
confirms Potsdamer Platz 2. These sources provide facts, not copied imagery.

Four separately credited, freely licensed photographs were inspected for the
curved curtain wall, slender steel rails, green-blue glazing, projecting upper
glass screen, recessed crown, and red-and-white DB sign:

- [Lusitana — Berlin BahnTower 3.jpg](https://commons.wikimedia.org/wiki/File:Berlin_BahnTower_3.jpg), CC BY 2.5.
- [MaryG90 — BahnTower0196.JPG](https://commons.wikimedia.org/wiki/File:BahnTower0196.JPG), CC BY-SA 3.0.
- [janine pohl — Berlin potsdamer platz db haus atnight.jpg](https://commons.wikimedia.org/wiki/File:Berlin_potsdamer_platz_db_haus_atnight.jpg), CC BY-SA 3.0.
- [Ansgar Koreng — Bahntower, Potsdamer Platz, Berlin, 141027, ako.jpg](https://commons.wikimedia.org/wiki/File:Bahntower,_Potsdamer_Platz,_Berlin,_141027,_ako.jpg), CC BY-SA 3.0 DE; attribution “Ansgar Koreng / CC BY-SA 3.0 (DE)”.

No photograph, downloaded logo, crop, texture or font file is packaged or
loaded at runtime. The DB letters and border are procedural geometric strokes.
Their reading direction is checked against the outward facade normal, avoiding
a mirrored sign on the clockwise source ring. Sign size, individual bay widths,
blind strips, local storey subdivisions and the glass wind-screen dimensions
are display estimates, not surveyed components. The wind screen follows the
existing main curved footprint and stays below the retained maximum height.

## Night and presentation modes

The facade has one taller lobby and 25 office bands: all **26 storeys** keep
visible glazing in full and mobile profiles. Every office band has a continuous
ceiling-light cue. The two set-back crown bands also retain lit glazing.
The user's requested fully illuminated night is an explicit presentation choice;
it does not assert that every real room is occupied or lit at a particular time.
Photographs support the strong continuous cool-white night signature, while
the numeric emissive intensity of 1.8 is a renderer setting, not a measured lux
value. No random dark-floor selection is used.

Day, Night, lights-off, Snowstorm and Schwellenraum share the same source-bound
architecture. Glass and both sign colours have explicit night-emissive metadata
and separate moonlit materials. The actual production sequence
`applyLightingToRoot` then `setIsoNightPresentation` is tested through night,
lights-off and day restoration, both before and after worker serialization.
Minecraft uses its own all-box source walls, roof courses and facade grid;
no smooth source mesh is retained in that group. Mobile coarsens lateral bays
and removes blind/spandrel microdetail while retaining every storey and the sign.

## Conflicts retained explicitly

1. **`bahntower-flat-prism-roofs-v111`:** the previous decimetre prisms retain
   only maximum heights and a generic roof type, and the old recognition pass
   added twelve facade belts. The original three prism records stay in the
   source supplement. Display uses the 99 original planes, detailed 26-storey
   facade and source-bounded glass screen. No tower is moved or enlarged.
2. **`bahntower-source-ground-v111`:** 4.923 m source ground differs from the
   delivered 5.3 m local ground. Keep both values, translating the full original
   surface stack by +0.377 m; no per-part height or footprint rescaling.
3. **`bahntower-night-presentation-v111`:** reference photographs show variable
   room occupation, whereas the owner explicitly requests bright illumination
   on every floor. Keep all 26 rendered storeys lit as a reversible visual mode,
   without calling the emission a current measured occupancy or lighting survey.

## Verification and budgets

Six focused tests, 501 assertions: original source-record equality and 99-plane
inventory; all 26 storeys in all four detail profiles; 300 exterior window rays;
three actual roof-plane rays; raster-height ownership; correctly oriented DB
glyphs; real material transitions and worker-transfer restoration.

| Profile | Draw calls | Instances | Geometry + instance arrays |
|---|---:|---:|---:|
| Drawn full | 6 | 12,549 | 986,340 B |
| Drawn mobile | 6 | 6,165 | 501,156 B |
| Minecraft full | 5 | 11,353 | 863,476 B |
| Minecraft mobile | 5 | 6,012 | 457,560 B |

A local Bun construction observation was about 13/4 ms for drawn full/mobile
and 8/3 ms for Minecraft full/mobile; these are not browser frame-time claims.
Actual Three.js geometry/instance matrices were inspected with orthographic
software QA in day, night, lights-off and Minecraft, including transparency
and emissive material values. Browser tone mapping, GPU rendering and direct
phone interaction require a device/browser check; software plates do not claim
that validation.
