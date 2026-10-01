# City West cinemas, Savignyplatz and FÜRST — v1.0.66

Step 10 adds complete official walls and roofs for Kant Kino, Zoo Palast,
15 directly facing Savignyplatz buildings, three small mapped pavilions and
the existing FÜRST / former Kudamm-Karree ensemble. The source is **21 parents,
95 parts and 1,751 original boundary polygons** from Berlin LoD2 tiles
`385_5818` and `386_5818` (dl-de/zero-2-0). Source archive hashes, all polygon
IDs and original ring vertices accompany the triangulated display. No roof
plane is flattened, no measured part omitted, and footprint holes stay open.

## Identity and time limits

| Place | OSM identity | Official parent |
|---|---|---|
| Kant Kino, Kantstraße 54 | node `312618622`, building relation `104701` | `DEBE04YY50002Xuw` (7 parts) |
| Zoo Palast, Hardenbergstraße 29a | way `23010077` | `DEBE00YY1EZ0000h` (7 parts) |
| Savignyplatz | place way `492760729`, park relation `5462503`, path relation `5462504` | 18 individually listed parents |
| FÜRST / former Kudamm-Karree | way `623444790` | `DEBE04YY500004MZ` (38 parts) |

The wording “Ku'damm-Tower” is ambiguous. The model identifies the existing
mapped FÜRST ensemble at Kurfürstendamm 206–209; it does not identify that term
as a confirmed user choice and does not introduce a proposed Karstadt tower.
The [operator](https://www.fuerstberlin.com/) reports alterations including the
removed tower plinth, while the [September 2026 municipal account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/aktuelles/city-west-blog/2026/artikel.1715237.php)
still describes active construction. The complete official survey is a measured
snapshot, not a claim to depict the finished 2026 project. Its measured roof
levels are retained, including the maximum 92.883 m part height; published
nominal tower heights and proposed extra floors do not stretch the survey.
The facade's horizontal and vertical divisions are documented display estimates.

## Source ownership and navigation

Exactly 25 complete old core prisms remain in provenance and are replaced by
this owner. Their rings, holes, bases and quantized native heights are used by
`cityWestCinemasV166SourceColumn`; there is no circular suppression area.
Per-parent old-only and official-only footprint areas document conflicts.
Kant Kino lies outside the old core. Only its coarse parent is removed from
packet `-9_2`, in both modes, through isolated candidate packets. All unowned
source triangles and previous detail meshes, and all road/water/ground/bridge
navigation, survive the packet audit. The module owns the complete replacement
shell and roof sampling. Packet publication is performed centrally.

Adjacent Bahnhof Zoo, Amerika Haus, Bikini, Huthmacher, Upper West, Zoofenster,
Kranzler and Europa-Center retain their existing owners. Savigny railway parents
`DEBE04AL36G0001U` and `DEBE04AL36G0001n` are explicitly excluded to preserve the
existing station/viaduct ownership. The 93-place catalogue is unchanged.

The source navigation payload includes every part polygon with holes, all roof
triangles and independently sampled native top cells. Drawn roofs use triangle
barycentric interpolation; native roofs use the actual two-metre block skin.

## Recognition and public space

The [Kant Kino heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096234)
fixes the cinema in the rear building and documents five central colossal
pilasters and flanking balconies. The model retains the complete seven-part
courtyard composition, five fluted pilasters, side balconies, pale plaster,
framed windows and the separate street entrance with `KANT KINO` lettering.
Coloured programme strips are generic; no historical film programme is asserted
as current. Fine member dimensions are authored interpretations.

The [district's Zoo Palast description](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/kultur-und-wissenschaft/kinos/artikel.157853.php)
and [heritage conservation account](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/zoo-palast-641132.php)
identify its pale yellow ceramic skin, trapezoidal main volume and low projecting
shop/foyer corners. The actual curved auditorium planes are preserved, with
small relief studs and procedural lettering following the source curve. Lower
street glazing and slender frames remain source-clipped. No interior plan or
protected image is traced.

The [district's Savignyplatz account](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.156595.php)
explains the two gardens divided by Kantstraße. Eight exact mapped area records
retain the park, lawns and sett paths; thin stone edges follow the actual lawn
boundaries. Existing street surfaces, trees and station geometry stay in place.
Source-bound frontage windows, sills and cornices support the surrounding varied
historic roof profiles. Their bay counts and colours remain illustrative, not
individual facade surveys. The 260 retained nearby mapped road/path courses are
clipped to the bounded selected context; every original feature identity remains.

Three freely licensed Commons photographs were inspected locally:

| File | Photographer / licence | Use |
|---|---|---|
| [CharlottenburgKantKino.JPG](https://commons.wikimedia.org/wiki/File:CharlottenburgKantKino.JPG) | Fridolin freudenfett (Peter Kuley), CC BY-SA 3.0 | Five pilasters, balconies, entrance panel, plaster |
| [Zoo Palast frontal 02-2014.jpg](https://commons.wikimedia.org/wiki/File:Zoo_Palast_frontal_02-2014.jpg) | A.Savin, CC BY-SA 3.0 | Ceramic wall, relief pattern, glazing and lettering |
| [Charlottenburg Savignyplatz 01.jpg](https://commons.wikimedia.org/wiki/File:Charlottenburg_Savignyplatz_01.jpg) | Fridolin freudenfett, CC BY-SA 4.0 | Lawn edges, pale street fronts and garden material cues |

Every per-file credit is recorded in `cityWestCinemasV166Evidence.json` and in
`/tmp/citywest-cinemas-v166-attribution.json` for release integration. No image,
crop, font or photographic texture is bundled or loaded.

## Component verification

Full and touch drawn geometry are identical: **3 submissions / 15,438 detail
instances / 1,514,568 geometry-and-instance bytes**. The independent native
surface model is **1 submission / 23,762 blocks / 1,806,560 bytes**, including
small orthogonal cinema accents and without hidden solid interior fill. All
static transforms freeze after construction.

Three Python tests compare every available official polygon's complete area
against its output triangles, exact ownership, open footprints, five pilasters,
finite data and native uniqueness. Three focused Bun tests (1,018 assertions)
verify GPU budgets, full/touch parity, exact source ownership, roof sampling and
height-aware suppression. Ruff and TypeScript pass. These are component checks;
release browser and device QA belong to centralized integration.

```sh
uv run python scripts/build_citywest_cinemas_v166.py
uv run pytest -q tests/test_citywest_cinemas_v166.py
cd src/app
bun test tests/citywest-cinemas-v166.test.ts
```

Useful focus targets in world metres: Kant Kino `[-4314,12,1245]`, Zoo Palast
`[-2568,17,1378]`, Savignyplatz `[-3360,8,1380]`, FÜRST `[-3294,46,1879]`.
