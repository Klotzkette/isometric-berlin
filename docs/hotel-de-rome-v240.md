# Hotel de Rome — v240 / Step 10

This pass changes only the existing Hotel de Rome display decoration and its
stone wall tone. It does not change the complete v131 source envelope, roof,
courtyard, collision or other Bebelplatz buildings. The new recipe lives in
`src/app/src/HotelDeRomeV240.ts` and uses the existing four instanced prototypes;
it needs no new runtime loader, packet or manifest entry.

## Source and architecture

The retained LoD2 parent is `DEBE01YYK00002GD`: 10 parts, 103 measured surfaces,
ground Y 3.821 m and maximum roof Y 34.166 m. The projecting middle face of
`DEBE3DnOENcW0iq2` ends at Y 21.369 m; the street eave of the larger main body
is Y 24.288–24.304 m. Its existing sloping roof and every interior ring remain
unchanged. Source positions and normals are checked byte for byte.

The official [Landesdenkmalamt inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080270)
identifies Ludwig Heim's 1887–1889 bank and its articulated sandstone facade.
It also records removal of the three added upper floors at the Bebelplatz front
in 1952. [Kardorff Ingenieure](https://www.kardorff.de/en/projects/grand-hotel-de-rome)
documents the 2006 hotel conversion with AUKETT + HEESE and Studio Ziffer. These
are architectural context, not a new survey or authority to replace the roof.

The inspected external reference is
[GFreihalter's 15 July 2025 facade photograph](https://commons.wikimedia.org/wiki/File:Berlin-Mitte_Bebelplatz_Hotel_de_Rome_178.jpg),
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It was already
listed by the prior Bebelplatz facade documentation. It informs the five-bay
middle order with six columns, two-bay flanks, round ground openings, central
segmental and flank triangular window pediments, balusters and plain central
attic panel. No photograph, derivative texture or new network dependency is
bundled. Kardorff's photographs are not used or redistributed.

All facade subdivisions, window/column dimensions and hues are procedural
estimates. The model represents the historic Hotel de Rome frontage; it does
not anticipate announced later renovation or rebranding.

## Audited correction

The old estimated column top was Y 24.25 m and its balustrade reached Y 27.35 m,
above the measured projecting front and street eave. The old `hotel()` function
is retained verbatim in `geo_data/regierungsviertel/hotel-de-rome-v240-evidence.json`.
`scripts/hotel_de_rome_v240_receipt.py` reverses only its replacement, its import,
the now unused old Hotel tone constant, Hotel wall-tone change and the exact native wall-cell loop. The
historical HU preservation test still checks all other bytes unchanged.

The revised columns span Y 10.58–20.82 m, with the main cornice near the
projected front top and balustrade at Y 22.05–23.24 m. Ground arches receive
shaped glass heads and voussoir/keystone cues; rustication courses stop at the
openings. Middle and upper windows have distinct stone surrounds, sills,
brackets, bronze/olive frames, pane divisions and restrained reflections.
Shallow balusters, modillions, a gold hotel inscription and a smaller entrance
canopy complete the front. Only the Hotel wall hue changes, from `#bebdb3` to
`#c5bdad`; the source roof hue remains `#696b68`.

## Preservation and budget

Before/after generation confirms identical matrix and colour hashes for all
4,312 drawn and 2,494 native HU/library facade instances, plus 6,939 native
HU/library source-envelope blocks. Both neighbour source mesh colour buffers,
all three buildings' position/normal buffers, the source JSON and the source
profile remain identical. The receipt stores the exact hashes and before/after
counts. No neighbouring decoration was removed or regenerated differently.

| Shared facade group | Before | After | Typed bytes after | Draw calls |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 5,241 instances | 5,602 | 431,776 | 4 |
| Native | 2,920 instances | 3,829 | 291,652 | 1 |

The increments are 27,436 and 69,084 typed-array bytes respectively. Live
residency limits, renderer settings and mobile detail remain unchanged. Native
arches, rails and pediments are independently orthogonal, with every instance
bounded on the front; no sloped beam or smooth column is used there.

The isolated native view also exposed coarse 2 m source wall cells projecting
through the measured front plane. Only Hotel native wall cells at these three
axes are clipped inward to their measured front: 36 wall cells change, with
all 2,659 cells retained and all 890 native roof cells identical. The original loop and exact replacement are included in the receipt.
HU/library native blocks retain their original hashes.

Focused checks: 17 Bun tests across `bebelplatz-facades`,
`bebelplatz-building-shells` and `hotel-de-rome-v240`; six Python tests across
`test_hotel_de_rome_v240` and `test_humboldt_main_v168`; Ruff on the touched Python
files. Final integrated all-mode/browser verification belongs to the release
pass. An isolated drawn/native render is stored outside the repository under
`/tmp/hotel-v240/`. Production front camera: position `[1535,44,300]`, target
`[1545,15,403]`; closer front: `[1522,17,299]` toward `[1528,15,375]`.
