# Eastern neighbourhood fronts v301

Thirty-four retained official LoD2 owners receive bounded architectural fittings
in sixteen existing streamed packet groups. There is no additional city coverage,
resident group, tour stop, timer, navigation feature or raised decoding budget.
The complete original body, roof sheets, vertex coordinates, source colours and
other fittings remain present. This is a code interpretation of referenced
architecture, not photography or a survey of every present-day opening.

## Selection and references

The individual owner/address/node bindings are in
`geo_data/regierungsviertel/ost-housing-v301-profiles.json`. References, exact
media URLs, temporary-file content hashes, photographers where stated, observation
limits and excluded proposals are in `ost-housing-v301-references.json`.
No reference image, PDF page, texture or media-fetch dependency is delivered.

| Group | Retained individual owners | Represented distinctions |
| --- | ---: | --- |
| Karl-Marx-Allee II | 5 | QP street slabs; grouped glazing, selected turquoise balcony fields, narrow horizontal/vertical panel joints |
| Kraut/Lichtenberger/Koppen | 5 | Different QP61 height/bay layouts, parapet strips and asymmetric window divisions |
| Andreasstraße 22 | 1 | Eighteen-storey metal-clad house; triple glazing groups, metal ribs and central end loggia fields |
| Kleine Andreas / Kleine Markus | 5 | Five-storey large-block rows, five-section rhythm and displaced stair windows |
| Strausberger Straße | 7 | Five-storey rear-area plaster blocks, restrained floor bands and differentiated ground zone |
| Dieffenbachstraße | 3 | Individually different tall windows, surrounds, balcony stacks and cornices on nos.11/12/13 |
| Wrangelstraße | 5 | Individual 1875–80 heritage houses; varied small estimated window/surround divisions, no tenant claim |
| Samariterstraße 38 | 1 | Seven-axis Jugendstil front with paired balcony stacks and upper surrounds |
| Mariannenstraße 50 | 1 | Corner-house pilaster/pediment and storey division recognition |
| Frankfurter Allee 13/15 owner | 1 | Tall narrow windows, differentiated ground zone, balcony/cornice rhythm |

The BA Mitte aerial photograph supports the KMA-II street-slab recognition;
the 2021 Friedrichshain-Kreuzberg architectural study distinguishes the later
QP61 slabs from the earlier five-storey rear-area and large-block rows. That
study establishes building types, not surveyed dimensions for each individual
window. The profile's bay count, exact opening positions, balcony dimensions,
small projections, parapets and ornament sections remain display estimates.
The Wrangelstraße43–46 entries use individual primary heritage identities and
typological recognition; an individual photographic window survey is explicitly
not claimed for those four fronts. Original source paint is preserved throughout.

The labelled LDA photograph of Dieffenbachstraße11–13 is credited to
**LDA-Archiv, Bittner2012**. The Samariterstraße38 image is monochrome archival
reference; no current tenant or colour is inferred. Andreas22 follows
**Giorgio Gullotta Architekten**; the Esser images follow the operator's own house
portfolio. The Frankfurter-Allee restoration reference is credited to **SG+
Architekten**. Exact links and omitted individual photographer/date fields stay
in the reference ledger.

Boxhagener Straße70/71/72 and Bänschstraße74 have useful primary photographs,
but their actually delivered outer packets still have OSM height-fallback
bodies. This fitting pass does not present those bodies as measured photographic
reconstructions. Likewise the proposed WBM Lange-/Andreasstraße infill is
excluded; its 2026–29 planning is not an existing completed building.

## Source-bound geometry

`build_ost_housing_v301.py` reads immutable source packets. It identifies the
actual street-facing owner boundary using retained street centrelines and
requires actual coplanar wall triangles behind every generated front. Artificial
packet clipping faces with no represented wall are rejected. Source wall coverage
sets facade eaves independently from roof-inclusive navigation height.

Native nav can contain the smooth original LoD2 leaf rings. Native fittings
therefore derive their independent cardinal carriers from the delivered native
vertical triangle planes, not from rotated smooth/nav outlines. Full source wall
coverage is checked in that plane. All native triangles lie on x/y/z planes;
small drawn pitched caps become stepped rectangular caps in native mode.
The u16-centimetre export admits at most one centimetre of wall-plane rounding.
Estimated edge fittings outside an original packet's encodable extent are omitted;
source coordinates and packet extents are never shifted to accommodate them.

There are32 family plans with append kind `ost-housing-v301`. The geometry contains
no photographic textures. Balcony members have thin rigid front/return sheets,
finite parapets and rail caps; they do not cut imaginary apartments or navigation
holes through the retained body.

## Exact fitting replacement and lifetime

Where an admitted front coincides with old v188 pane axes, the new complete front
is appended inside that same `district188-…` companion. Exactly262 old pane quads
(524 triangle ordinals) have independently replayed coordinate/colour/topology
receipts. Old cornices, plinths, doors, roof details and the complete remaining
index complement are retained. Source arrays are never edited by the builder.
Other fronts append to their existing primary packets.

Every plan pins every raw mesh, origin, navigation and ink. It pins the full new
append too. The common two-phase `NeighbourhoodPacketV300` captures raw admission
before older preparers, appends after their completion, and retires only exact
old triangle ordinals after the complete append is present. It remains disabled
by default. Missing/corrupt/changed inputs leave original fittings visible.

Full older-preparer replay found nine drawn StreetCurves navigation additions and
one further native `6_0` EastStadtbahn addition. Drawn `6_0` includes both. The ten
optional prepared-navigation hashes match the actual entire old decoder chain;
all32 prepared ink guards remain equal to their original guards. These are exact
old additive navigation receipts, not permission for a new navigation change.

## Validation

The offline tests verify all34 source owners, references and original decoded
source hashes, every new topology and fixed400,000-vertex/2,400,000-index/16-part
limit, exact262 old quad receipts and their entire untouched triangle complement.
They project every appended vertex back onto its actual source plane and check
native cardinal geometry and source height bounds. The complete actual decoder
also admits every one of the32 final primary/companion plans in both families.

Rebuild only this bounded data with:

```sh
uv run python -m scripts.build_ost_housing_v301
uv run pytest -q tests/test_ost_housing_v301.py
bun test src/app/tests/ost-housing-v301.test.ts
```

The runtime JSON is6,608,963 bytes before the existing per-plan lossless build
transform. The compact provenance evidence is48,618 bytes. The largest append is
96,336 native vertices in `6_-1`; source plus append stays below the unchanged
packet ceiling. Full drawn touch detail is identical to drawn desktop detail.
