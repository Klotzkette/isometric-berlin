# TIPI site correction (v1.0.22)

The main eight-peak canvas silhouette was already authored, but its generic
OSM prism remained beneath it. Sixteen mapped ancillary tents and three low
service/connecting structures also appeared as nine-metre concrete boxes.
The height is the retained context export's fallback, not a measured tent height.

The correction replaces exactly twenty display records, listed with unchanged
decimetre rings and ground levels in `tipiSiteSource.json`. The original public
source records stay intact. Both ordinary prism construction and distant
coverage skip only those IDs because the dedicated TIPI model owns their
visible geometry. Minecraft removes columns only within those exact source
rings and substitutes one bounded block batch. The two metal containers and
the neighbouring Carillon remain distinct and unchanged.

The OSM context inventory and [current OSM way identities](https://www.openstreetmap.org/way/174277607)
anchor placement. The official [Berlin DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
confirms the north/south auditorium axis, northern timber entrance, pointed
satellite roofs and low connecting wings. The inspected EPSG:25833 extent is
389160,5819890,389260,5820000 (layer `dop_2025`). This public-domain aerial
is a reference only; no aerial texture is bundled or displayed in the viewer.

The published 32 × 26 m main canvas and eight roof peaks remain. Thirteen small
mapped tent parts plus the pointed connecting part use source-bound pagoda
roofs; the foyer and two front turrets stay distinct. Canvas curvature, wall
heights and peak heights are procedural display estimates, explicitly separated
from the source footprint: 2.5/5.2 m for small pagodas, 3.2/6.2 m for the foyer,
5.6/9 m for the turrets and 3.2/3.45 m for service wings. They are not a survey.
The existing owner-authored marquee and its night bulbs remain.

Tests compare all twenty rings/heights with the unchanged full public payload,
check both ordinary/distant suppression, ray-test pointed roofs and open gaps,
retain real containers/Carillon, and verify the northern entrance and the
unchanged main silhouette in drawn and Minecraft forms.
