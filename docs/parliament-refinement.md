# Parliamentary architecture, v1.0.4

Step 10 refines the Jakob-Kaiser-Haus (JKH) and Marie-Elisabeth-Lüders-Haus
(MELH). `ParliamentArchitecture.ts` uses the committed LoD2 edges, courtyard
holes and heights for its facade axes. `parliamentArchitectureProfile.ts`
separates those metric anchors from procedural window spacing, section sizes,
colour, roof-crown proportions and the one documented missing-wing supplement.
No photograph, crop, plan image or photographic texture is bundled or loaded.

## Architectural evidence

The [Bundestag account of JKH](https://www.bundestag.de/besuche/architektur/kaiserhaus/architektur/architektur-198866)
describes eight individual houses, the division by Dorotheenstraße and the
22 m eaves constraint. The individual houses should therefore retain distinct
facades and courts. The [gmp description of houses 4 and 8](https://www.gmp.de/de/projekte/398/jakob-kaiser-haus-abgeordnetenburos-des-deutschen-bundestages-hauser-4-und-8)
supports limestone, cedar-clad window boxes, folding sun-shading, corner
loggias and the glazed hall. Those are implemented as facade systems; the
individual bay count, shade opening and mullion section are display estimates.

The [Bundestag MELH description](https://www.bundestag.de/besuche/architektur/luedershaus/architektur)
supports the library's two large window fronts, five levels above the memorial,
the comb-shaped office wings, hearing-room circle and widening exterior stair.
Its extension paragraph still uses a prospective 2016 completion date and is
not used to override the delivered current footprint or to invent a new tower.
The published general 23 m building-height description is not substituted for
the measured, part-specific LoD2 envelope.

Visual QA uses four freely licensed reference photographs, with credits mirrored
in the source and public manifests:

- Matthias Süßen, [JKH north court, 6595](https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6595.jpg)
  and [glazed hall/cedar facade, 6620](https://commons.wikimedia.org/wiki/File:Jakob-Kaiser-Haus-2025-06-msu-6620.jpg),
  CC BY-SA 4.0.
- Wanner-Laufer (attribution as recorded by Commons),
  [Lueders-haus.jpg](https://commons.wikimedia.org/wiki/File:Lueders-haus.jpg),
  CC BY-SA 3.0.
- Manfred Brückels, [M E Lueders Haus.jpg](https://commons.wikimedia.org/wiki/File:M_E_Lueders_Haus.jpg),
  CC BY-SA 3.0.

## Confirmed source gap at JKH

The northern parent `DEBE01YYK00001Li` contains eight parts. Its part
`DEBE3DsO9RhopAvB` records only a 4.325 m podium. The tall adjacent part
`DEBE3DZoBJBxg2ub` ends west of the northeastern upper wing visible in the
2025 photographs. A fresh check of the 2 March 2026
[official 389_5819 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip)
confirms the same eight parts and the low podium geometry; the adjacent
390_5819 tile contains no missing part of this parent. This is a source gap,
not a renderer parsing error.

The checked archive SHA-256 is
`86084bf012830c373bbcb4ac1ca2814153430bb9a1eb6d8271b1f7fc8ccecd17`.
Raw CityGML and ZIP files remain outside the release.

The additive display supplement uses the **exact existing podium polygon
intersected with world x ≥ 535 m**, including its exact courtyard hole. The
resulting occupied plan is 2,792.810714 m². No new ground is occupied. It starts
at the delivered podium top, world y = 8.9 m, and ends at y = 26.6 m: the
published 22 m eaves value above the source ground y = 4.6 m. That value is
explicitly a bounded reconstruction height for this missing upper wing,
**not a new surveyed measurement**. Original source records remain unchanged.
The open north approach, central court and Dorotheenstraße gap remain open.

The four drawn modes share the exact polygon extrusion. Minecraft uses the
same bounded plan with 178 horizontal 4 m cells and five vertical courses,
890 blocks in total. The collision index switches between the exact polygon
and that same cube union; it cannot retain an invisible voxel corner when
switching back to a drawn mode.

## Library and legacy corrections

The previous library add-on was an opaque 34 m cylinder rising to about
39.2 m in the world frame. It concealed the library's glass-front reading.
It is removed in both rendering families. The source library body
`K0001x35` now carries exterior-facing curtain glazing, thin mullions,
gallery-line cues and a shallow roof clerestory. The retained roof-crown
centre `[406, -139]` and radius 16.5 m are established display anchors, not
surveyed cylinder geometry. Its new top is 34.23 m; its thickness and height
are photo-proportioned display details. The darker roof sits 8 cm below the
pale rim, avoiding differently coloured coplanar top faces and stationary flicker.

The old broad Minecraft rotunda mask is removed with that cylinder, restoring
the original library source columns below the new facade and roof details.
The separately authored hearing-room circle, canopy, public widening stair
and two Spree bridges retain their existing source profiles and access paths.

The old JKH arcade extending uninterrupted across Dorotheenstraße and the
rectangular MELH/JKH roof-light grids spanning empty courts are removed.
New parapets follow exposed source edges only. Both JKH courts explicitly
represented as LoD2 holes and the MELH comb voids remain unroofed.

## Rendering and verification

The two complexes share one instanced facade/roof-detail batch. Drawn rendering
adds one mesh for the exact missing-wing supplement: two draw calls total.
Minecraft combines its facade detail, shallow crown and upper-wing cubes in
one instanced box batch. All materials are texture-free. Mobile profiles
coarsen window spacing and small frame detail while retaining the same
structural wing, open courts and library crown.

Bounded full/mobile profiles:

| Representation | Instanced boxes | Draw calls | Stored geometry and instance ceiling |
| --- | ---: | ---: | ---: |
| Drawn full | 17,634 | 2 | 1,380,000 bytes |
| Drawn mobile | 9,630 | 2 | 760,000 bytes |
| Minecraft full | 8,745 | 1 | 680,000 bytes |
| Minecraft mobile | 6,718 | 1 | 530,000 bytes |

The source Minecraft raster uses 4 m cells. Facade placement samples the
actual source-column skin at each pane, so a source cube projecting beyond
the ideal facade plane cannot bury the new glass. Box orientation remains
axis-aligned in Minecraft; the drawn batch follows the exact wall bearings.

`tests/parliament-architecture.test.ts` verifies exact source edge endpoints,
finite buffers and budgets, source immutability, the bounded upper-wing plan,
unobstructed sky rays over five courts/approaches, exterior-facing library
details in front of the actual LoD2 and source-voxel masses, the shallow
library crown, all-five-mode upper-wing collision and reversible mode changes.
Offline orthographic QA renders use the actual Three.js vertices and instance
matrices with software depth testing. They do not replace browser or physical
phone testing.
