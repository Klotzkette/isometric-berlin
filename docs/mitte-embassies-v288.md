# Chinese and DPRK embassy facade fittings — v288

Candidate release 1.0.187. Production build, final city inspection and publication
are handled by the release owner and remain pending in this component note.

The Chinese embassy is the main Märkisches Ufer 54 building, not the separate
Brückenstraße 10 consular department. Its exact retained owner is
`DEBE01YYK000095y` / OSM way `25073288`, with all 30 parts in source tile
`392_5819`. The DPRK embassy is Glinkastraße 5–7,
`DEBE01YYK00007QN`, with all eight parts in tile `390_5819`. Both complete
original source families, sheets, ground datums, roof slopes, courtyards and
all previous authored detail remain unchanged.

The evidence file retains all 38 source parts verbatim and hashes their source
files. No building, generic owner, previous glazing, roof or navigation solid is
retired. This is a finite additive facade treatment rather than a replacement
building model.

## Photographic interpretation

Roy Zuo's own 4 June 2026 China exterior photograph supports pale silver panel
divisions, paired narrow dark rails, reflective blue glazing and the central
chamfered glass stack. The original mansard/sloped roofs remain authoritative.
People, demonstrations, political lettering, signs and photographs are not
reproduced. The inspected downloaded reference JPEG is identified by its own
SHA-256; it is not represented as the full original archival JPEG.

Ankermast's own 9 April 2024 DPRK photograph supports pale rectangular frame
grids with sloping reveals, a dark low plinth and dark glazing. The 2019
Daniel Michael Perry photograph supplies additional public exterior context.
The older sources do not establish a new survey of the 2026 facade.

The corrected photographic front is northeast of the complete source family.
The photograph's geotag converts to scene XZ `[3211.429, 514.308]`; this supports
an approach bearing, not a surveyed camera pose. The initial northwest-only
selection was insufficient and its unsupported 21-pane rear glass estimate on
`DEBE3DkRsB3FL4B4` is removed entirely.

The actual source front includes the faceted wing `DEBE3DK3aPPX5UVQ`, the
raised front stack `DEBE3DDkWe53IE8v` and the projecting low portal
`DEBE3DsXAMuD6zDV`. Eighty-two exact camera-facing source-wall planes now
receive thin silver/portal-blue skins at 0.025 m, behind the existing generic
window layers at 0.055–0.125 m. Triangulation preserves every full plane and
hole. The 39 short faceted planes were below the legacy 2.4 m window cutoff;
they receive 273 estimated panes in seven rows. Three measured front-stack
planes receive 49 estimated panes. Their four-column central face and two-/one-
column flanks are explicitly photo-guided rather than surveyed opening grids.

Across 95 fitting runs, 414 previously accepted aperture axes remain separate
from the 322 new photo-estimated front panes. New DPRK reveals remain larger
than the retained original glazing. Small sections, material tones, subdivisions
and glazing proportions remain display estimates. No roof or building anchor is
moved and no opening is excavated through a source body.

## Independent native construction

Native fittings use short independent orthogonal boxes. They do not reuse
sloped drawn reveals or rotated facade meshes. A frozen component-local outward
fit, in 0.1 m display increments and bounded to 3.5 m, places them beyond the
actual retained coarse exterior. This fitting distance is an adaptation to the
existing native representation, not a measured facade displacement.

The proof reconstructs filled two-metre solid intervals from paired original
horizontal faces in streamed `5_1`/`6_1` and resident Alt-Mitte packets
`045`–`048`. Every reconstructed column has a paired lower and upper surface;
there are no unclosed intervals. The 13,657 filled cells are represented by
vertically merged intervals, supplemented by all 90 exact original DPRK
four-metre core columns, giving 2,336 blocker boxes. No broad building bounding
rectangle is used to fill a courtyard. The original packet hashes and complete
proof arrays remain in the evidence file, outside the renderer import.

All 3,829 China and 2,474 DPRK native fitting boxes clear every blocker. Of the
new China recipe, 1,295 proposed components have no exposed fit within the
finite bound and are omitted in native only. The initial five incorrectly
oriented unpublished v288 native back-fitting runs also yield to this bounded
main-front interpretation; their drawn fittings remain. All original source
geometry and all previously published detail remain. Native omits no DPRK
component, and its complete baked recipe keeps SHA-256
`139b150b1eefaed0e2df776f5039ebb628636e5ec18e85f3d847ac32611d9d2e`. No new wall,
pillar, opening, navigation obstacle or architectural envelope is invented.

## Construction and streaming

`createDprkEmbassyV288({ native, payload })` returns the additive group. Drawn
construction accepts no native payload. Native construction requires the exact
original schema, classes, grid and finite source-column window; changed,
missing, sparse, hidden or accessor data returns `null` without source retirement.

China remains in its original serial outer-city streaming lifecycle.
`prepareChinaEmbassyV288(chunk, id, native)` validates the exact original
Alt-Mitte encoded-stream fingerprints, original tile origin and complete China
navigation bindings before appending one new mesh. Original meshes, encoded
streams, indices, lines, origins and navigation objects remain unchanged by
reference. The fittings are clipped to their original 512 m tile; the existing
16-mesh, 400,000-vertex and 2,400,000-index limits remain. Missing or changed
contracts return the unchanged chunk. Repeated preparation does not append
again. Preparation yields during source fingerprinting and cancellation before
completion has no publication or allocation to dispose.

No detached resident China facade is created. The streamed owner and its
fittings load/unload together. No new timers, animation, images, textures,
network requests, decoded cache or residency allowance is added.

## Component validation

The focused DDR plus embassy tests pass: 17 tests, 243,442 assertions. Embassy
checks cover all source receipts, actual wall endpoints, estimated versus old
aperture axes, orthogonal bounds, complete blocker clearance, descriptor-safe
negative admission, both actual China tile/family contracts, unchanged originals,
changed/missing fallback, repeated preparation, cancellation and fixed budgets.

DPRK drawn construction uses two renderables and 164,736 buffer bytes; native
uses one renderable and 188,672 bytes. China appends one mesh per tile, with
11,146 / 19,011 drawn vertices and 9,064 / 16,506 native vertices in `5_1` / `6_1`.
The combined new encoded geometry decodes to 808,581 drawn / 787,746 native
bytes, below the unchanged 850,000-byte allowance. Exact indexed corner sharing
applies only to new fittings and retains every triangle and colour under the
existing flat-shaded decoder. New packet tint bytes explicitly convert authored hexadecimal sRGB to the shared
decoder's linear RGB convention. The main silver tint `#b9c3c5`, for example,
encodes as linear bytes `[124,139,142]`. This colour-only correction retains
the exact new position/index streams, counts and byte allowances. Original
packet strings remain unchanged. These are
additions inside the existing packet caps. Full drawn detail is shared
with touch mode and existing day/night material selection remains available.

The new northeast-front test checks all 82 skin triangulation areas, the 39
source facet planes, three real stack planes, correct geotag bearing, absence of
the unsupported rear glazing and the unchanged DPRK recipe. This note does not
claim an integrated TypeScript/build pass or publication. No attribution licence
or source credit changed during the front-orientation correction.

## References and credits

- [China embassy contacts](https://de.china-embassy.gov.cn/det/sgjj/lxwm/202409/t20240909_11487671.htm), embassy publication dated 8 January 2026.
- [DPRK embassy address](https://www.auswaertiges-amt.de/de/reiseundsicherheit/vertretungen-anderer-staaten/216194-216194), Auswärtiges Amt.
- [China exterior photograph](https://commons.wikimedia.org/wiki/File:(20260604)_China_embassy_demo_2653.jpg), Roy Zuo, 4 June 2026, CC BY-SA 4.0.
- [DPRK exterior photograph](https://commons.wikimedia.org/wiki/File:Nordkoreanische_Botschaft,_Berlin.jpg), Ankermast, 9 April 2024, CC BY 4.0.
- [DPRK exterior context](https://commons.wikimedia.org/wiki/File:DPRK_Embassy_Berlin.jpg), Daniel Michael Perry, 16 April 2019, CC0-1.0.

All photographs are reference-only; no photographic pixels ship. The combined
13-record DDR/embassy credit list is
`geo_data/regierungsviertel/v288-reference-records-ddr-embassies.json` for the
release owner's atomic public-ledger append. This component has not edited the
public ledger, NOTICE, shared integration files, version or publication.
