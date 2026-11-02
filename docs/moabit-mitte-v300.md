# Moabit and Mitte street houses v300

This bounded pass improves 29 address references on Waldstraße, Turmstraße,
Alt-Moabit, Lehrter Straße and Tucholskystraße. Its source inventory contains 27 complete Berlin LoD2
parent buildings, including all 93 measured leaf parts and their wall/roof
sheets. The 22 fallback families receive complete new drawn source sheets;
five correct Lehrter families retain their existing drawn bodies and roofs.
The independent native model uses all 27 complete source profiles. There are 43 qualifying public-street-facing source planes. These are
not 43 independently photographed house addresses.

The main correction is geometric. For example, the retained OSM fallback at
Waldstraße 53 is 10 m high, while the complete official parent is 23.22 m high;
54 is 23.79 m and 55 is 25.64 m. Those old records remain in the repository.
The actual viewer may replace only the 24 exact old fallback prisms after all
source records match and the complete new model is attached. The 13 correct
Lehrter source prisms keep their drawn envelopes and roofs. Their selected old
estimated street-front fittings have separate actual-constructor receipts.

## Inputs and limits

- `geo_data/regierungsviertel/moabit-mitte-v300-source.json.gz` retains the
  resolved address nodes, all original prism fields, complete official parent
  sheets, source archive URLs and SHA-256 receipts, reference page receipts and
  conservative omissions.
- Berlin LoD2 / Geoportal Berlin (`dl-de/zero-2-0`) supplies all geometric wall,
  roof, courtyard and source-height evidence. The nine retained original GML
  archives are not copied into a new runtime asset.
- The retained 29 September 2026 OpenStreetMap extract (ODbL-1.0) supplies address
  and mapped street identity. A POI alone does not invent a new building.
- Only the global source-ground alignment changes vertically: each complete
  parent receives one rigid offset to its retained display ground. Every
  source X/Z and every relative wall/roof elevation stays unchanged.
- Individual opening positions, storey subdivisions, profile dimensions,
  materials and colors are display estimates constrained to the measured
  source planes. They are not surveyed window coordinates. No shop name or
  current tenant is invented.
- The independent native construction uses cardinal 0.5 m source-footprint
  columns, stepped measured roof heights and cardinal facade members. It does
  not voxelize the drawn mesh. All 681 retired native columns are actual RLE
  source cells with complete five-field tuple receipts and exclusively proven
  source ownership under the original rasterizer’s cell-center membership rule.
  Full affected rows, grid and classes must match first.
- Touch and desktop construct the same full static detail. Residency, workers,
  tour stops, geometry admission limits and the 894 MiB package cap are unchanged.

The 94 additional free source back/court planes receive an explicitly estimated
continuation of the former ordinary-house window rhythm. It prevents the full
native source-body transfer from leaving formerly detailed backs blank. Correct
drawn Lehrter backs keep their original details instead. No foreign party wall
or internal source-part seam is opened. These are not new photographic claims.

## Reference credits

All pages were checked on 2 November 2026. They are architectural reference
material; none of their photographs are embedded, cropped into textures or
redistributed in the viewer.

| Fronts | Primary architectural references |
| --- | --- |
| Waldstraße 53–55 | [LDA Waldstraße 54](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050357), [LDA Waldstraße 55](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050293). The first photographed street context is explicitly dated **LDA 2004**. Bay/loggia and balcony interpretation is an estimate; historic monochrome evidence does not establish current paint. |
| Turmstraße 4, 38, 76 | LDA [4](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050349), [38](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050352), [76/76A](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050354). |
| Alt-Moabit 87–93 | LDA [ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050420), [87](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050421), [89/90](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050423), [92](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050223), [93](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050224). |
| Lehrter Straße 6–10 | [LDA railway workers' houses](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050389). The three addresses 8–10 share one complete LoD2 parent, rather than receiving three duplicate bodies. |
| Lehrter Straße 21/22 | [Sauerbruch Hutton, Quartier Lehrter Straße, 2013–2020](https://www.sauerbruchhutton.de/de/project/ler) documents six/eight-storey buildings in the wider courtyard project. It does not identify these exact retained street-front parents. Their original mapped **five-storey** register is preserved; no orange facade or new glass balcony is inferred from that contextual photograph. |
| Tucholskystraße 26/28/30/32 | LDA [26](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035061), [28](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035062), [30](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035063), [32](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035064). |
| Tucholskystraße 37/39/41/42/43/44 | LDA [37](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035092), [39](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035093), [41](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035094), [42](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035089), [43](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035285), [44](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035286). Some register pages publish no facade photo. Their metadata supports identity/period only; the fitting layout stays explicitly estimated. |

Jägerstraße 27/28/31/32 and Charlottenstraße 75–77 already have suppressed global
fallbacks and complete retained Alt-Mitte source bodies. They are excluded from
this global source transfer. A separate bounded stream plan can refine their
fittings without duplicating those bodies. Charlottenstraße 55 is an authored
music-college model and is not an ordinary-house target.

Tucholskystraße 38 is deliberately unchanged here: its 337 m² old footprint is
only 66% covered by the selected 226 m² official parent. Removing that whole
predecessor would lose an unaccounted rear building. The unmatched source and
reason remain recorded; the coverage test is not weakened.

The explicit LDA storey counts take precedence over incompatible draft rhythm:
Turmstraße 4 has six storeys, Alt-Moabit 92 three, and Lehrter Straße 6–10 four.
Retained mapped counts support Alt-Moabit 88 (seven), 89/90/93 (four),
Tucholskystraße 32 (five), and the five-storey Lehrter 21/22 fronts. The original
attribute records and contradictory older counts remain in the source evidence.
No primary architectural reference is stretched into a claim about another house.

Every fitting rectangle now lies inside its actual measured WallSurface and
holes. Gable and stepped-wall bands stop at that contour; whole window groups
cannot leave floating transoms above it. Foreign party-wall intervals are tested
along the complete offset wall, including partially covered ends. Native panes
split over the actual cardinal stair faces, with complete height/width support.
Native roof navigation uses the exact compiled stepped caps; drawn navigation
keeps the measured roof triangles. Estimated warm night occupancy uses the same
complete window members and does not change daytime geometry.

## Construction and actual old fitting receipts

`MoabitMitteV300Core.ts` publishes a group only after complete construction.
A private receipt checks actual child, geometry, attribute, array, count and
material identities. A late constructor failure disposes every unpublished
geometry/material/instance resource. The ownership module imports only the
small exact predecessor receipts, never the construction geometry.

`capture-moabit-mitte-v300-fittings.ts` executes the actual production core
constructor with each exact predecessor and the full neighboring source payload.
It captures 1,579 original Moabit/Mitte line segments and 265 original pane/night
instances, plus 1,055/147 West originals. Complete historical captures remain in
`moabit-mitte-v300-core-fittings.json.gz`. Only the 76 remaining Lehrter street
segments and 70 instances (60 panes, 10 night strips) enter the small runtime
receipt. Corrected fallback owners' fittings do not get constructed after the
source filter; West has no residual original core fittings after its filter.

`prepareMoabitMitteV300CoreFittingRetirement(core, {sourceBodiesFiltered:true})`
first resolves all exact actual Float32 segments/matrices. The returned plan
rechecks buffer identities and every affected value before applying once. It
collapses only those receipted lines/instance bases. Every outside attribute,
instance color, material and matrix translation remains byte-identical. The
caller must already have admitted and attached the complete required model.
For a progressive core batch, pass `buildings: options.buildings ?? prisms.buildings`;
only complete exact original owners actually present in that batch are resolved.
An altered or missing receipt rejects the whole retirement transaction.

## Verification

- Twelve region Bun tests cover exact original/source/native admission, malformed and
  duplicate owners, changed native rows/classes, genuine construction completion,
  touch parity, cardinal native members, late-failure resource cleanup and
  atomic exact-fitting retirement with unchanged outside bytes.
- Seven independent region Python tests verify all retained parent parts/sheets,
  navigation X/Z/holes/heights, complete measured triangles, cardinal members,
  exact predecessor fields, every actual exclusive RLE native column and all
  94 free complementary back/court faces, actual wall-polygon and party-edge
  clipping, complete exposed native window support and physical roof-cap heights.
- The actual full default global core with both source filters resolves precisely
  76/70 Moabit fittings and 0/0 West residual fittings. Application succeeds once.

No publication, build, source packet rewrite or package-limit increase is part of
this isolated region implementation.
