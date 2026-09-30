# Alexanderplatz landmarks — v1.0.49

Pipeline step 10. The owner requested the detailed Fernsehturm, Rotes Rathaus,
St. Marienkirche, Neptunbrunnen and Marx-Engels-Forum with its monument and
mapped trees. The v148 bounds and 93-stop tour remain unchanged. The previous
city, streets and exact source data remain available and rendered.

## Geometry and source ownership

The complete v148 Alexanderplatz station remains an initial outline. A keyed
selection in `SchlossEastOutlines.ts` delegates only the Rathaus and TV tower
to their new detailed families. The legacy all-family constructor and its
historical cache remain reproducible. All 6,575 native station cells preserve
their exact transforms and colours; the old eight-part source is unchanged.

The new families use the same full drawn geometry on touch and pointer devices.
Minecraft receives separate bounded block-native models. Constructors yield
between families. No photograph, remote image or reflective environment-map
texture is required at runtime.

The Fernsehturm cross is a sunlight response on its actual steel sphere. The
camera updates shader view direction without a CPU animation loop or scene
traversal. The existing per-mode sun direction controls the reflection; night
and overcast snow do not display a sunlight cross. This is a procedural visual
approximation, not a measured optical simulation or fixed painted cross.

Forum source evidence and ongoing landscape works are distinguished from
unbuilt future plans. Monument sculptural details and individual facade
members are procedural interpretation; official building envelopes and OSM
locations remain the metric anchors.

## Preservation and validation

The targeted station test compares every native matrix and colour against the
v148 all-family buffer. All eight eastern outline tests and eight staged
construction/cancellation tests pass. The retained metric/source payloads,
including the old eastern outlines, streets, ground, prisms, voxel data and
landmark catalogue, compare byte-for-byte with v148. All 17,091 fused source
features and the previous 346 attribution records remain unchanged; eight
reference credits are appended in both manifests.

The pedestrian audit uncovered two existing integration gaps. Navigation still
stopped at the old terrain grid despite the rendered east extension; the new
source-clipped support follows that existing display surface only. The Forum's
whole-circle Schwellenraum protection incorrectly blocked its paths; visitor
collision now follows actual sculptures while the original decorative-prop
clearance stays intact. Full terrain/prism/protection-payload tests exercise
walking, all three Rathaus courts, roof support and Forum paths in all five
modes. See [navigation evidence](schloss-east-navigation-v149.md).

Measured new family buffers, identical on pointer and touch devices:

| Family | Drawn draws / bytes | Native draws / bytes |
| --- | ---: | ---: |
| Fernsehturm | 4 / 1,676,088 | 3 / 901,100 |
| Rathaus and Marienkirche | 7 / 2,586,204 | 1 / 2,217,948 |
| Forum and Neptunbrunnen | 5 / 392,792 | 1 / 334,728 |

Ruff formatting/lint, TypeScript/production build, all **493 Python tests**,
package readiness and the downloadable package's HTTP smoke test pass.
The focused detail/preservation/staging suite passes 121 tests; the independent
native construction check is recorded below. Chrome passes 35 production
mode/pose combinations across all five modes and seven views, without page,
console, request or HTTP errors or duplicate model families. Near and distant
steel reflection, its absence at night, corrected clocks, open lantern,
sculptures and surfaced Forum court were inspected in the final screenshots.

## Retained v148 whole-world native baselines

Before the v149 additions, independent synchronous construction recorded:

| Profile | Instances | Renderables | Unique buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,995,398 | 168 | 309,142,997 | `f738dcae331cd5e1294d8b310357b6bcc2af90e054bd90e1a0d5c18bf97de229` |
| Mobile | 1,242,109 | 166 | 99,443,577 | `13ebd55296c35f96118366a2949694062cb9da9c937f4713c8544154ab620b56` |

These values remain recorded rather than silently replacing the preservation
history. The v149 construction fixture is updated only from a fresh synchronous
benchmark after the exact source duplicate corrections, then independently
verified through cooperative construction. Previous full/mobile visible tree
counts were 19,721 / 9,901 from 44,222 source trees; the separate new Forum tree
batch does not alter that retained generic-tree payload or thinning rule.

Final v149 synchronous baselines (measured independently again after every
geometry family froze):

| Profile | Instances | Renderables | Unique buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 4,026,302 | 173 | 311,495,229 | `86b76b284f0c2add4c3ef718e27d2262e2fcff13ed948e5563f48ad040664659` |
| Mobile | 1,273,013 | 171 | 101,795,809 | `9262f08b36073756f8d58420cbec5f3e753909ba1ff49f23105e95212393b799` |

Both profiles add 30,904 instances, five renderables and 2,352,232 buffer bytes.
The unchanged generic source/visible tree counts remain 44,222 and
19,721 / 9,901. The separate public-realm additions retain all 59 newly mapped
Forum trees. The apparent grey pillar behind Alte Welt was traced to the
separate pre-existing Stern-und-Kreis ticket kiosk, source prism `06571883`;
it was not deleted as an unrelated object. All previous generic column/window
expectations remain unchanged unless a separately documented exact source
ownership test establishes an actual duplicate.

The final independent check passed **36 tests / 5,817,360 assertions** across
`minecraft-construction.test.ts` and `minecraft-voxel-world.test.ts` in 29.60 s.
Both cooperative constructors exactly match the separately measured
synchronous hashes, counts and bytes. The generic voxel test file required
**no fixture change**: full columns 1,433,676, mobile columns 524,342, facade
windows 1,558,746 and meadow flowers 39,616 all retain their v148 counts.


Final mobile screenshot review found that native Neptunbrunnen water at 5.435 m
was hidden below retained source plaza cells at 5.52 m. Only native water row
centres were lifted 24 cm: the final water top is 5.675 m, still below the
5.935 m granite lip. Terrain, source streets, basin outline, statues, collision,
and support heights were preserved. The whole-world hashes above were measured
again after this correction; all instance, renderable, byte and old tree counts
remain unchanged. An integrated fountain/street raycast regression covers the
clearance. Earlier pre-correction QA is retained in the separate browser report.

## Final integration checks

The broad frontend run exercised 2,349 cases: 2,346 passed; three Forum tests
observed the old whole-circle collider because that long-running process
started 25 seconds before the protection fix and subsequently read the newer
test file. A fresh run of every direct protection-module test consumer plus
the related Alexander, civic and Tiergarten tests passes **101 tests / 8,213
assertions across 12 files**, with no reproduced ordering or mutation leak.
The earlier mixed-revision run is not presented as an all-green final run.

Real Chrome UI checks also pass the complete five-mode sequence while flying
near the tower and while walking on the eastern lobe at x=2530: position,
orientation and walking state remain continuous. The final native-water build
(`ThreeViewer-BsBdDoAE.js`, `index-DvIZYe89.js`) passes four additional Chrome
Day/Minecraft views of the fountain and Forum, with visible basin water and
no runtime, shader, request or duplicate-family errors. Rebuilt archives pass
release readiness and local-package HTTP checks again.

WebKit with the iPhone 13 device profile completed 35 mode/pose combinations.
The native-water correction was then checked in all seven Minecraft poses on
the final build; the visible scalloped basin, surrounding paving and figures
were inspected. No page, shader, request or HTTP error occurred. WebKit logs
the existing ignored `interactive-widget` viewport hint, which is not a
rendering failure. This is browser/device emulation, not physical-iPhone
performance testing. After the water correction, all **42 native/public-realm
tests / 5,817,610 assertions** pass, including both independent world hashes.
