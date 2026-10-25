# Step 10 v270 — photographed fronts opposite Tacheles

Five exact ordinary building owners replace their five unchanged 15 m OSM
fallback prisms. The complete official LoD2 walls and roofs are retained, with
photo-derived facade colour and bounded architectural relief. The red corner
is Oranienburger Straße / **Auguststraße**, not Johannisstraße. The Auguststraße
92 mural and church owners are separate and excluded here.

| Front | LoD2 owner | Original core ID | Complete parts |
|---|---|---|---:|
| Oranienburger Straße 45 | DEBE01YYK00004fg | -1403271 | 9 |
| 46–47 | DEBE01YYK00006o3 | -1403208 | 8 |
| 48–49 | DEBE01YYK0000EXQ | 97720960 | 3 |
| 50 | DEBE01YYK00006Ft | 97720962 | 2 |
| Red rounded corner | DEBE01YYK00002MI | 97997063 | 1 |

The 23 deepest source parts contain 267 original sheets, including ground and
closure surfaces, preserved verbatim in `tacheles-fronts-v270-source.json.gz`.
All 510 triangulated source wall/roof triangles survive in the drawn model.
The original source footprint union and courtyard holes are unchanged. Ground
is **5.2 m for every owner**, taken from each exact existing core prism. Each
LoD2 family receives one rigid vertical datum translation; no source roof is
flattened, recoloured by an unrelated district palette, or cropped.

Photographs 1–3 establish the red wall, pale lower band, rounded glass corner,
two inset glass rooftop levels and terrace rails. Photos 4–8 establish the pale
ornamented front at 45, weathered buff/brown 46–47, pale yellow 48–49 and ochre 50.
The differentiated source roofs stay in their measured places. The two white
projecting bays are photo-derived additions on the exact measured front line;
their estimated 0.82 m projection is not presented as measured LoD2 detail.
Procedural windows, arches, pediments, sills, cornices and dentils fit the public
source wall planes and are clipped to those walls. The builder rejects walls
whose outward line to the public street crosses their own footprint.

Opening subdivisions, paint RGB, cornice depth, small ornament and rail spacing
are display estimates. The red rooftop levels are explicitly estimated:
1.15/2.35 m insets and 2.63/2.7 m heights above the measured roof, separated by
0.15 m. The measured roof survives underneath as the first terrace. No tenant
names, signage textures, invented passable doors or interior rooms are added.
The original 178 upper opening groups plus four larger bay window groups
represent estimated photo-relative subdivisions,
not surveyed apertures. The user photographs are hashed as evidence only;
no bitmap is bundled or redistributed.

## Runtime and ownership

- `createTachelesFrontsV270(native)` creates five complete required meshes. The
  same full detail is used on mobile. Native construction independently samples
  complete roof surfaces onto a 0.5 m world-aligned grid, emits exterior wall/roof
  skins and fits cardinal details. It does not rotate or recolour the drawn mesh.
- `isTachelesFrontSourceV270` first gates five IDs, then compares the complete
  original core tuple (ring, holes, ground, height, class, roof and tone).
  Changed or unrelated records stay. The native tester additionally requires one
  exact owner record and exact original voxel tuples. Foreign/shared cells stay;
  altered/new neighbouring footprints veto affected removals. Partial source
  lists support bounded QA. The independent small profile stays strongly held. Eleven additional
  photo fittings have separate elevated solids: two bays, two balcony top
  rails, five chimneys and two low rooflights. The bays begin at y=13.25 m,
  preserving clear pavement below. Chimney bases sample every footprint corner
  on the actual measured roofs; native roof quantisation keeps its original cap
  separately from the new overall fitting height.
- `prepareTachelesFrontsV270(chunk,id,native,requiredReady=false)` is the final
  preparer after v269. It retires only exact v166/v167 facade recipes for these
  five owners in existing **2_-2**, using full encoded-mesh fingerprints and
  individual triangle indices: **3,788 drawn / 6,272 native**. Every original
  encoded mesh, position, colour, unrelated triangle, line and nav record stays
  intact. Appended unrelated preparation meshes are accepted. No mesh is added.
- `applyTachelesFrontsV270Triangles` runs after original decode, before publishing
  the chunk; receipted old triangles become degenerate indices. Preparation is
  cooperative and cancellation leaves original payloads unmodified. The default
  ready flag leaves old fronts intact. Root enables it only after the complete
  required world transaction can be published.
- The required owner replaces exact core, distant and worker fallback geometry;
  native removes only exclusive old columns. `tachelesFrontSolidsV270` uses every
  complete measured/additional roof and identical native quantisation. Street
  geometry, coverage, 93 tour stops and live tile/decode/prefetch limits stay fixed.
- Source construction `sites` are opted into existing lossless weak storage;
  meshes own decoded typed buffers, never encoded recipes. Small independent
  navigation/source-identity profiles remain strongly retained. Normal scene
  disposal owns both day/night materials and buffers.

Final payload: **9,454 drawn / 21,572 native triangles**, five meshes in either
mode, **398,082 / 902,556 geometry bytes** including normals. Runtime JSON is
1,028,371 bytes (312,053 bytes gzip); the independent strong profile is small.
All 510 original source triangles and the 3,788/6,272 removal receipts stay
unchanged through the photographic refinement.

## Validation and QA

`uv run --no-sync pytest -q tests/test_tacheles_fronts_v270.py`: 6 passed. These
compare the archive parts and every original sheet, all delivered source
triangles, untouched inputs, exact native tuple/foreign-column retention,
orthogonal native faces, complete bounds and visible native roof navigation.
The added test checks all 11 detail bodies, five source-seated chimney bases
and two rooflight bases against actual retained roof heights.

`bun test ./tests/tacheles-fronts-v270.test.ts --timeout 60000`: 6 passed. These
check exact/changed/duplicate/partial owners, no texture/UV, the required ready
flag, every decoded old triangle, untouched meshes/lines/nav, fingerprint
failure, append compatibility, cancellation, production preparation and real
street walks across drawn/native/day changes. No respawn, jump or >0.35 m step, including the pavement directly under
the two elevated bays.

All three QA camera positions were checked against every retained core prism;
none starts inside a building. Include surrounding packet **2_-2**, nearby
ordinary core buildings and the complete required factory. Enable
`tachelesFrontsV270:true` for packet preparation; otherwise the deliberate
fallback-preservation default leaves old estimates visible.

| View | Camera | Target |
|---|---|---|
| Photographed row overview | [1210,42,-725] | [1230,17,-770] |
| Rounded red corner | [1248,34,-713] | [1316,20,-733] |
| Front 45 at street scale | [1229,15,-739] | [1238,15,-762] |

No other old profile factory is needed for these five owners. Existing Tacheles,
Auguststraße 92 and the separate church context should be included for the
complete photographic sightline. Root performed internal-browser visual QA of old/new complete owners and packet
2_-2; the correct 3,788 drawn transfers were confirmed. The initial visual
review led to a second pass: rectangular 46–47 windows, only photographed
blind/lintel arches, 209 finite irregular masonry/plaster patches and 140
discontinuous pale mortar fragments; stronger white pilasters/capitals, two
projecting bays, open upper balustrades, five chimneys and two rooflights. The
final pass is again reviewed internally by Root.

## Sources and credits

Primary references, exact verified assertions and uncertainty are in
`tacheles-fronts-v270-references.json`. Official Berlin monument records verify
45, 46–47, 48–49 and 50; current colour/form evidence is the user's photographs.
The corner's identity is its exact mapped/source footprint, without inventing a
house number. Original archive, input assets, photo and runtime SHA-256 hashes
are retained in the source/evidence files. Immutable original packet SHA-256 and
full encoded-mesh fingerprints accompany the finite removal receipts.

Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen,
LoD2: **Datenlizenz Deutschland – Zero – Version 2.0 (dl-de/zero-2-0)**.
© OpenStreetMap contributors, ODbL 1.0, for existing mapped core footprints and
streets. User photographs are reference only and are not redistributed.

## Native red-corner projection correction

Internal-browser review exposed a concrete native-only defect: the inherited
wall painter selected only the dominant cardinal axis and, on inset upper
walls, clipped glazing against an outer lower roof edge. The red corner now
clips its existing artwork against every actually exposed native X/Z face and
that face’s own lower/upper roof tier. All 2,224 artwork panels carry explicit
axis, outward offset, vertical bounds, colour and triangle evidence. Of these,
161 panels form penthouse glazing; both roof tiers and both axes are tested.
The face-level test checks actual delivered RGB values and confirms every panel
lies outside its own wall with no truncation against a different height tier.

Before/after verification preserved every drawn mesh, the other four native
meshes, full original source, triangle-removal receipts and complete
footprint/roof/navigation profiles byte-for-byte or value-for-value. Only the
red corner’s native artwork changed; no redraw, silhouette, budget or navigation
change was needed.
