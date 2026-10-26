# Verkehrskanzel Joachimsthaler Platz / Grünfeld-Ecke — v276

The historic pavilion is at the south-west corner of Kurfürstendamm / Joachimsthaler Straße, opposite Kranzler, not on the rotunda. The operator-independent location is tied to retained OSM ways 709164073 (pavilion) and 588847139 (kiosk). The small cabin projects at the mapped north-eastern step.

## Evidence and limits

- [Landesdenkmalamt, record 09096211](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096211): original pavilion, widely projecting thin roof, slender supports and asymmetric glazed traffic cabin. The entry records 1955 design / 1956 completion and cessation of manual operation in 1962.
- [District U Kurfürstendamm page](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/bahnhoefe/artikel.1116059.php), photograph BACW/Farchmin 2022: open underside, kiosk and outward-leaning window frames. Viewed as a reference in the internal app browser; no photograph or texture is bundled.
- [District Grünfeld-Ecke history](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.156638.php). Its different historical operating end date is not used as geometry evidence.
- Complete original Geoportal LoD2 parents DEBE04YY5000041M and DEBE04YY50002cND, including all 27 wall/roof sheets, retained in `geo_data/regierungsviertel/verkehrskanzel-v276-source.json.gz`. The archive hash and original OSM rings/tags are preserved. LoD2 is dl-de/zero-2-0; OSM attribution/ODbL follows the project NOTICE.

The small kiosk keeps every official wall and roof; the canopy keeps its entire measured roof, edge and thin underside. A shared +0.652 m datum translation meets the existing scene ground. The former fully solid canopy walls are replaced by the photograph-supported open construction. Cabin dimensions, support widths, mullions, inactive desk and heritage plaque are explicit visual estimates. Neither an active policeman nor working traffic control or event projection is invented.

The drawn cabin has sloping glazing. The independent native shell has orthogonal quarter-metre wall/floor/roof cells and an empty interior. Kiosk fittings are fitted outside the actual opaque native columns, with bounded displacement receipts; no detail is culled on touch devices. There are two drawn batches (30,048 GPU bytes) and one native batch (53,620 bytes).

Only two exact old prism records and nine exclusive complete native tuples yield. Source drift, missing/duplicated owners, and changed/new neighbours fail closed. The unchanged source files remain intact. Walking uses the actual thin roof underfaces and separately modelled posts; open pavement below the canopy remains traversable. The complete required group is attached before its construction yield. There is no new tour stop, texture, animation or city coverage.


## Final visual and native fitting check

The first internal-browser inspection found that sloping drawn-frame positions
were hidden by the independent vertical native glass cells. Native frames are
now projected onto the upper cabin ring and fitted outside those actual cells;
20 full-height posts retain the original 200 small native frame rows. All other
native rows and every drawn byte remain identical. Actual Float32 overlap falls
from 167 frame rows (122 completely concealed) to zero; the smallest clearance
is 0.016201 m and largest offset from the upper ring is 0.21875 m. The unchanged
53,620-byte native budget includes this correction. Four Python and three Bun
checks pass, including full reproduction and native frame visibility clearance.
The final internal-browser drawn/native views confirm visible white mullions.
