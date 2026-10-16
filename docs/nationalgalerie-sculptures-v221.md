# Neue Nationalgalerie terrace sculptures — v1.0.121

Step 10 adds two bounded, photo-informed recognitions at retained OpenStreetMap
artwork nodes. It changes neither the city footprint, 93-place tour, streaming
residency limits nor mobile detail. The v220 walking arrival and Cattelan
exhibition remain intact. Owner photographs are reference material only; no
photograph, scan or museum reproduction is shipped as a texture.

| Work | Retained OSM node | World X, Z | Interpretation |
| --- | --- | --- | --- |
| Alexander Calder, *Têtes et Queue*, 1965 | 1881346242 | −341.5806234625634, 1344.9708629120141 | Black painted steel plates, seven feet, six raised rounded heads and curved tail |
| Henry Moore, *Three Way Piece No. 2: Archer* / *Bogenschütze*, 1964–1966 | 1881346251 | −241.7248615444405, 1290.5216721436009 | Interlocking curved bronze forms and two rounded crosspiece ends on a dark cylindrical steel pedestal |

Coordinates use EPSG:25833 `[E−389500,5820000−N]`. Both bases rest at the
existing terrace top Y=9.8. Calder's museum-published envelope is 5.5 m high,
4.7 m wide and 3.3 m deep. For Moore the Berlin-specific Bildhauerei inventory
gives a 2.25 m sculpture and 0.8 m pedestal; other cast/catalogue dimensions
differ. This model uses that Berlin-specific 3.05 m total rather than treating
other cast dimensions as measurements of this installation. Orientation,
thickness, curvature, patina and small contact footprints are display estimates
from the supplied views, not surveyed geometry. Each model has one static batch;
Minecraft uses native blocks, with the same identities and positions.

## Evidence and terrace support

- [Calder Foundation: Têtes et Queue](https://calder.org/works/monumental-sculpture/tetes-et-queue-1965-2/)
- [Neue Nationalgalerie: Calder conservation](https://www.smb.museum/museen-einrichtungen/neue-nationalgalerie/sammeln-forschen/restaurierung/tetes-et-queue-alexander-calder-1965/)
- [Bildhauerei in Berlin: Köpfe und Schwanz](https://bildhauerei-in-berlin.de/bildwerk/koepfe-und-schwanz-tetes-et-queue-4686/)
- [Bildhauerei in Berlin: Bogenschütze](https://bildhauerei-in-berlin.de/bildwerk/bogenschuetze-archer-5052/)

The old LoD2 terrace owner `MSMgX8rD` ends 6.642 m before Moore's mapped point.
Moving the artwork would conceal the actual problem: missing supporting terrace.
Retained `osm.gpkg`, roads `relation/21583`, contains the complete paved terrace
with a pavilion hole; Moore lies 6.606 m inside its exterior boundary. Berlin's
official DOP 2025 confirms the northeastern terrace corner and sculpture location.

`nationalgalerieApronV221Source.json` retains the full source exterior/hole,
original LoD2 subtraction ring, exact selected difference, source-file hash and
orthophoto request/hash. Only the connected difference component containing Moore
is added (2,792.130814 m²). Two unrelated sub-square-metre slivers are left alone.
The original terrace, pavilion and stairs are retained byte-for-byte. This apron
stays 20.379 m clear of the original main stair envelope. Its vertical extent
5.2–9.8 follows the existing terrace, not newly surveyed altitudes. Walking uses
the same footprint at 9.82 with solid sides. Native rows are inscribed in the
source polygon, avoiding adjacent pavement. Sculpture contact tests preserve
Calder's open spaces rather than blocking its entire bounding rectangle.

## Exact proxy replacement and preservation

Only these obsolete renditions transfer to the dedicated artwork owner:

1. `ExpandedCityDetails.addKulturforum`'s oversized torus for the exact existing
   `Der Bogenschütze (Henry Moore)` anchor.
2. `TiergartenMonuments`' generic `node/1881346242` rendition.
3. `TiergartenMonuments`' generic `node/1881346251` rendition.

All source records remain. The Tiergarten factory's established
`externallyModelledSourceKeys` mechanism records the two transfers. Unrelated
same-name artwork nodes remain eligible. The immutable v120 baseline commit
is `d7b7a3a7a452fc330950f2cfbc5034e441c59915`. Compact receipts independently
compare the historical factories with only these exact inputs excluded against
the current full remaining outputs, including buffers, materials and order.
The old gallery preservation tests detach exactly one named v221 addition,
retain their untouched v220 fixtures, then restore that identical object/index.
New sculpture shapes have separate fixtures and aperture/material/placement
tests. Apron support, walking contacts, draw calls and native block budgets are
checked independently; no previous geometry fixture is replaced by today's
output.

The two artworks use 608,892 buffer bytes in drawn modes and 93,300 bytes / 1,203
instances in Minecraft. The supporting apron adds one static batch. No extra
animation loop, fetched artwork asset, texture, dynamic shadow rebuild or
different touch-device rendition is introduced.

Together with the apron the addition uses 611,772 drawn buffer bytes or 130,200
native buffer bytes / 1,680 instances, in three draws. Verification passed:
127 focused Bun tests (663,380 assertions), the independent GeoPackage/source
subtraction test, the full existing Python suite (1,303 passed, four skipped),
Ruff, production build and downloadable-package checks. Chromium and WebKit
iPhone emulation passed the default grounded arrival, held-input podium
collision, walking up the stairs through the doors and six-mode continuity.
The Chromium runtime additionally verified exactly two artwork owners and one
supporting apron in every mode and provided day/night/native visual checks.
Browser emulation does not certify performance on physical devices.
