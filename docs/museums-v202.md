# James-Simon-Galerie and Pergamon Panorama — v1.0.102

Pipeline step 10. This is a bounded refinement of two existing Museum Island
owners. The detailed-city footprint, surrounding streets and 93-place tour
remain unchanged. Both representations have identical static detail on pointer
and touch devices. Minecraft uses an independent surface-only block batch.

## James-Simon-Galerie

All eight official source parts and the previous OSM prism remain byte-for-byte
unchanged in `jamesSimonSource.json`. The earlier canal stair, plinth joints,
windows, low colonnades, source-ground complement and all source heights remain.
The isolated 26.661 m source part is still retained, without interpreting it as
a measured architectural fitting.

The old flat main LoD2 sheet covered the actual broad Bodestraße staircase.
The new representation articulates only the bounded local rectangle
u=70…103.7, v=−21.5…−7.85 into an open stair aperture. Three flights and three
landings span u=70…103.1 and v=−21.05…−7.95. Their source-base foundations close
the existing terrain exclusion underneath. Original wall planes below the
rise remain, while the coarse upper wall and roof infill over this rectangle
is omitted. The untouched source sheets are preserved as evidence. The exact
aperture, 36 treads and member placement are photo-guided display estimates.

The [architect's completed-building description](https://davidchipperfield.com/projects/james-simon-galerie)
supports the raised canal terrace, slender colonnades, small courtyard and
three broad flights. [Dyckerhoff, the material supplier](https://www.dyckerhoff.com/en/w/james-simon-galerie)
reports 92 square high-colonnade pillars and the slender flat roof.
[Westag's supplier account](https://www.westag.de/de/presse/pressemitteilungen/detailseite/architekt-chipperfield-kroent-die-museumsinsel/)
reports 28 × 28 cm column sections. The model preserves the old 41 canal
positions, adds their 40 midpoint posts and eleven short-return posts, and
uses that published square section. The distribution is a display fit, not a
survey of all 92 pillar centres. Thin source-edge fasciae and the recessed
foyer doors preserve the open intervals. Their fitting sizes are estimates.

Navigation and rendering share the same columns, stair heights and upper
landing. The existing full pedestrian index admits the complete capsule at
eight sampled main-stair locations. Source-roof support now returns the
exposed tread heights through the aperture, rather than the removed high roof.

## Pergamonmuseum. Das Panorama

This is the current 2018 building at Am Kupfergraben 2 opposite the Bode-Museum,
not the different 2011 temporary drum in the Pergamonmuseum courtyard. Its
exact retained OSM owner is [way 235493631](https://www.openstreetmap.org/way/235493631),
runtime prism `35493631`. The complete 38-vertex source ring and old decimetre
prism are retained in `pergamonPanoramaV202Source.json`. The source footprint
supplies placement; the former generic nine-metre height does not describe the
real cylindrical building.

The [asisi/SMB architectural fact sheet](https://www.asisi.de/fileadmin/Medien/4_Presse/3_Basisinformationen/Pergamonmuseum_Panorama_Fact-Sheet_2021.pdf)
publishes the rotunda's **36 m diameter and 32.5 m height**, and the adjoining
hall's **108 × 14.5 × 9.5 m** dimensions. The
[SMB building profile](https://www.smb.museum/en/museums-institutions/pergamonmuseum-das-panorama/about-us/profile/)
credits Yadegar Asisi's initial concept and spreeformat architekten's design.
The model uses these published heights above the existing 4.9 m display datum;
this is not a new ground survey. Rotunda top is y=37.4 m and hall top y=14.4 m.

Twenty-one original mapped arc vertices remain in the drum. Its obscured
continuation is a least-squares circle fit to the first twenty; residuals are
below 2 cm. The hall follows the complete remaining outline. A flat roof, pale
panelled drum, dark hall, large glazed east end, recessed entrance, four posts
and seven entry treads follow the inspected exterior photographs. Panel seams,
glass colour, entrance recess and stairs are unsurveyed display subdivisions.
No artwork, lettering composition, photograph or photographic texture is
reproduced. The lower drum wall has one owner, avoiding coincident dark/white
wall copies.

The source audit found only one substantially overlapping official object in
tiles 390_5820 and 391_5820: entrance `DEBE00YY2O700027`, with ground y=4.124 m,
top y=13.402 m and all its original wall/roof sheets preserved in the new source
record. It is absent from the currently delivered prism inventory, so no
independent official runtime owner is removed. Its small facade envelope
supports entry placement; the published whole-building heights remain separate
from this lower measured source envelope. Neighbours `DEBE01YYK00008tx` and
`DEBE01YYK0000EC2` overlap by only 0.198 and 0.032 m² and remain untouched.

Native replacement uses **161 exact x/z/bottom/top column signatures** from
the retained four-metre packet. Their twelve-metre heights are the voxel
quantization of the old nine-metre source fallback. Three adjacent exterior
eight-metre columns are deliberately retained. Neither a rectangle nor a
generic footprint/top-threshold test controls replacement. Original public
packets remain unchanged. `pergamonPanoramaV202RoofAt` provides the two actual
roof levels; granular collision allows the represented front portico while
keeping the museum body closed.

## Inspected freely licensed references

All six photographs were inspected locally on 9 October 2026. They are external
visual references only. Per-file records are in
`geo_data/regierungsviertel/museums-v202-credits.json` for addition to the two
packaged Wikimedia credit manifests. No photographic pixels are distributed.

| File | Author / licence | Features checked |
| --- | --- | --- |
| [James-Simon-Galerie Berlin 2021-03-13 01.jpg](https://commons.wikimedia.org/wiki/File:James-Simon-Galerie_Berlin_2021-03-13_01.jpg) | Leonhard Lenz, CC0 | Canal plinth, stairs, glass setback |
| [James-Simon-Galerie Berlin 2021-03-13 02.jpg](https://commons.wikimedia.org/wiki/File:James-Simon-Galerie_Berlin_2021-03-13_02.jpg) | Leonhard Lenz, CC0 | Slender square pillars, glass, parapet |
| [James-Simon-Galerie Kolonnaden.jpg](https://commons.wikimedia.org/wiki/File:James-Simon-Galerie_Kolonnaden.jpg) | Fridolin freudenfett, CC BY-SA 4.0 | Open low-colonnade intervals and thin fascia |
| [James-Simon-Galerie Treppe.jpg](https://commons.wikimedia.org/wiki/File:James-Simon-Galerie_Treppe.jpg) | Fridolin freudenfett, CC BY-SA 4.0 | Broad three-flight entrance, open sky, high-column return |
| [(20260607) Berlin 121712.jpg](https://commons.wikimedia.org/wiki/File:(20260607)_Berlin_121712.jpg) | Roy Zuo, CC BY-SA 4.0 | Pale drum, dark hall and glazed end |
| [Pergamonmuseum Das Panorama at nightnacht-2026-02-msu--3028.jpg](https://commons.wikimedia.org/wiki/File:Pergamonmuseum_Das_Panorama_at_nightnacht-2026-02-msu--3028.jpg) | Matthias Süßen, CC BY-SA 4.0 | Open entry undercroft, four supports and steps |

## Static buffer freeze

The earlier v147 museum budget remains in its original profile. Its historical
test explicitly applies the new v202 fixture for James-Simon only.

| Group | Draws | Buffer bytes | Instances | Rendered vertices |
| --- | ---: | ---: | ---: | ---: |
| James-Simon, drawn | 2 | 59,392 | 466 | 11,832 |
| James-Simon, native, pointer and touch | 1 | 199,008 | 2,610 | 62,640 |
| Panorama, drawn | 2 | 47,992 | 343 | 8,823 |
| Panorama, native, pointer and touch | 1 | 111,456 | 1,458 | 34,992 |

These are measured geometry/index/instance attribute bytes, not browser-process
memory. No animation, new residency budget or runtime image request is added.

Focused validation covers source reproducibility, unchanged source parts,
exact native signatures, retained neighbours, ray hits through column gaps,
main and canal stair surfaces, full-capsule clearance, entrance headroom,
texture-free static buffers and identical touch detail. Reproduce with:

```
uv run python scripts/build_museum_v202.py
uv run pytest -q tests/test_museum_v202.py tests/test_museums_v147.py tests/test_james_simon_terrain.py
cd src/app
bun test --isolate tests/museums-v202.test.ts tests/museums-v147.test.ts
```

The separately streamed v169 facade also contained the Panorama's former generic
window recipe. A retained-source recipe replay matches exactly 1,384 drawn and
1,381 native coloured triangles in cells 2_-1 and 3_-1. The runtime substitutes
only these recorded triangle indices after validating the unchanged payload
fingerprint. All positions, colours, packet bytes and unrelated indices remain
intact; this is not a footprint cull. The receipt and reproducible matcher are
`panoramaFacadeV202.json` and `scripts/build_panorama_facade_v202.py`.
