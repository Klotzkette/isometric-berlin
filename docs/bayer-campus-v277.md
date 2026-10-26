# Bayer / former Schering administration — v277

This pass corrects the existing administration at **Müllerstraße178**, OSM
`way/420830351`, within the already retained Bayer campus. The complete original
LoD2 owner is `DEBE01YYK0004qx3`. Its source height of23.988m was rounded to a
24m core prism across the entire administration, podium and bridge. That flat
proxy hid the actual tall building and blocked the open road below its bridge.

The complete old owner, all original surfaces, old prism and complete old facade
tuples remain in `geo_data/regierungsviertel/bayer-campus-v277-source.json.gz`.
The other **82 campus parents** and their existing details remain unchanged;
the original83-parent/214-part/2,357-surface source receipt is hash-checked.
This is a bounded correction, not a claim to have resurveyed every campus facade.
No future Nordhafen development, extra coverage, public stop, interior or security
system is added.

## Identity and primary references

[Bayer's operator page](https://www.bayer.com/de-de/deutschland/standorte/berlin-startseite)
provides the administration photograph used for pale structural ribs, blue-grey
windows, separate stair cores, the lower entrance front and the small Bayer cross.
The [operator's public directions](https://www.bayer.com/sites/default/files/anfahrtsbeschreibung-berlin-wedding.pdf)
identify the main entrance at Müllerstraße178. The actual mapped public entrance
is retained as OSM `node/9658049952`.

The [original structural engineer's project sheet](https://www.gse-berlin.de/wp-content/uploads/projekt_pdfs/GSE-Projekt-Schering-Gebaeude.pdf)
distinguishes administration S101, its external reinforced-concrete cores and
three-storey base, and the six-storey S102 bridge over Fennstraße. Its storey
conventions differ from OSM's individual roofs/cores; neither source is silently
converted into a universal floor-height multiplier.

This corrects the v210 documentation's assignment of the administration photo to
`K00042Xi`. That southern owner's complete measured geometry remains untouched;
its previous documentation is not evidence that it is the pictured S101 building.
The exact new administration identity is established by the operator address,
OSM parent/parts, original engineering account and retained official source.

## Complete parts, heights and uncertainty

All **24 mapped building parts** are retained:22 ways and two multipolygon
relations, with their inner rings. Each is clipped to the complete old LoD2
footprint. The full original OSM rings remain in the immutable receipt. There
is no rectangular approximation of the campus or substituted generic tower.

The old source footprint is8,197.9309335m². The union of serialized new parts is
8,196.525650565m². Its difference from the old polygon is explicit:1.406971775m²
old-only narrow boundary strips, and0.001688840m² new-only four-decimal rounding.
Full difference rings and areas are retained in `contourDiscrepancy` of
`bayer-campus-v277-evidence.json`. Those tiny OSM/LoD2 conflicts are not filled
with invented24m slivers. This is not a claim of mathematically identical active
footprints; the complete conflicting sources remain available for review.

**96 actual Berlin bDOM points**—four per part—are retained with query URL,
world coordinate and NHN result. Each selected roof point lies inside its own
mapped part. All outliers and neighbouring-wall readings remain in the receipt;
selected points are explicitly named per part. The original display datum is
`NHN −30 +0.308m`, giving the same existing5.2m ground. The two tall core samples
112.09/112.13m NHN become82.398/82.438m display heights; the central main roof
sample100.91m becomes71.218m. No generic24m cap remains on the new body.

The bridge has mapped `building:min_level=2`. Its **8.4m clear height** is a
presentation estimate because the precise underside is not measured by roof
bDOM. Both renderers and walking geometry use the same13.6m displayed underside.
The road remains open below it. DOP2025 was inspected for current roof context;
it was not traced into metric geometry or bundled as a texture. Source dates
and present-day completion are kept distinct.

Window bay spacing, opening dimensions, colors, ribs, roof copings and logo size
are reference-guided estimates. They are clipped to source walls and rejected
where neighbouring source parts would conceal them. The mapped entry determines
the real wall; its estimated7.9m frontage is clamped along that adjacent wall so
it fits completely. The public entrance point remains separately auditable.

## Independent native model and retained neighbours

The native model uses the exact occupied union of **8,199 one-metre cells**;
its body and roof geometry is independently axis-aligned. Identical adjoining
cells are merged losslessly into1,496 body/roof runs. No extra volume is filled
under the bridge or inside source holes. The native profile queries the same
cell intervals, including the elevated underside, while the drawn profile uses
all24 polygons and holes directly.

The ownership receipt binds one exact old prism, **498 exclusive4m column
records**, **13 retained shared columns** and45 neighbouring prisms. Missing,
duplicated or changed owners fail closed; changed or new overlapping neighbours
preserve their affected cells. Shared columns remain intact. The old object's
full tuples—not its ID or a site bounding rectangle alone—control retirement.

Old facade retirement is independently bound to **1,673 drawn** and **4,265
native** complete original tuples, including index, all numeric values, site and
role. A changed tuple stays visible. Every remaining v210 instance matrix and
color, including the Erika-Heß site, stays byte-identical. The old data files are
not rewritten.

Ordinary native fittings move outward only within the finite0.25–1.75m range
until their actual Float32 boxes clear every occupied new body cell and retained
foreign4m column. The public entrance must sit in front of shared coarse cells:
its complete native detail uses a coherent **4.5m raster-projection base** plus
individual relief. This is explicitly a native display compromise, not a measured
entrance relocation. Drawn geometry remains at the source facade. The actual
extent of diagonal backing boxes determines foreground frame/glyph depth, so the
Bayer lettering is visible rather than buried behind its backing.

No replacement native fitting intersects its own body, retained foreign columns
or any retained nearby v210 facade box. The same positive-volume comparison also
checks drawn details against retained neighbouring drawn boxes after Float32
matrix construction. No old window is duplicated on the replaced building.

## Integration and measured costs

`createBayerCampusV277(native, {mobileLike})` constructs the complete atomic
required model. `isBayerCampusSourceV277` and
`createBayerCampusColumnTesterV277` protect old drawn/native owners.
`bayerCampusSolidsV277(native)` supplies matching navigation.
`createWeddingSitesV210(native, {bayerCampusV277:true})` removes only exact old
facade tuples; the omitted option preserves the historic factory output.
The root integrator enables ownership only after attaching the required model,
and applies the same option to initial, distant, progressive and worker paths.

| Actual submitted model | Drawn | Native |
| --- | ---: | ---: |
| Draw calls |2|1|
| Source-shell triangles |980|independent boxes|
| Instance count |5,559|20,791|
| Total geometry/index/instance/color buffers |529,260B|1,581,052B|

The runtime JSON is1,396,925B, approximately260KB gzip. All packed renderer
fields (`drawnPositions`, `drawnColors`, `drawnDetails`, `nativeDetails`) are
explicit losslessly packed string fields, each retaining one strongly owned decoded primitive. Legacy receipts `drawn`/`native` use the same strong packed-string contract. No WeakRef is applied to strings. Small
parts/cells/profile/count metadata remains available for navigation. Construction
owns its buffers, stores no decoded source arrays on scene objects, has no
textures/animation, and keeps identical submitted mobile/touch detail. Existing
residency, decode, prefetch and tour limits are unchanged.

## Focused verification

`tests/test_bayer_campus_v277.py` checks complete immutable sources, all24 parts
and96 height readings, exact union/profile/native-run coverage, free bridge,
actual Float32 fitting clearance against own and foreign source cells, visible
layered logo, no duplicated neighbouring old facade boxes, deterministic replay
and bounded buffers.

`src/app/tests/bayer-campus-v277.test.ts` constructs both real models, compares
mobile buffers, tests atomic required attachment, byte-identical old complement,
source mutation/missing/duplicate guards, initial/distant/progressive retirement,
live navigation in both modes, and the actual native world constructor. That
constructor starts with511 source cells/1,528 layered instances and retains
exactly13 shared cells/34 unchanged instances when activated. Changed source
heights restore all old geometry.

The focused seven Python tests and seven new Bun tests pass, together with all
three unchanged v210 Bun regressions. Early development assertions were corrected
after revealing the precise23.988m source versus24m rounded prism and multiple
native material layers per column; their original logs remain in the v277 cache.
No full-city, browser endurance or iPhone performance claim is made here.

The [local model proof](bayer-campus-v277-model.png) is a diagnostic depth-buffer projection of actual
packed geometry, not a browser screenshot or edited reference photograph. It
shows the isolated new model; surrounding old owners are intentionally absent.
See [credits](bayer-campus-v277-credits.json) for source attribution and limits.
