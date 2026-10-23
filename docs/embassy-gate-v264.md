# Three embassies by Brandenburg Gate — v264

Pipeline step 10, release 1.0.164. This is a bounded recognition refinement of
the existing British, United States and French embassies. It adds no site,
tour stop, streaming descriptor, photographic texture, animation callback or
live residency allowance. All source shells, roof parts, court openings and
unrelated authored details remain. Drawn touch and desktop use the same factory.
Minecraft has an independently built, entirely orthogonal instance batch.

## Evidence and source limits

`src/app/src/data/embassyGateV264.json` retains the source URLs, current identity,
old-owner receipt and the three review cameras. British LoD2 parent
`DEBE01YYK00001KP`, main part `DEBE3DzLVkos5eqV`, was independently checked in
`LoD2_390_5819.zip`: its complete street edge runs from `[598.077,357.452]` to
`[600.828,390.651]`; source ground/top are 4.173/25.925 m in the viewer frame.
The older authored display frame remains `[598.18,4.6,374]`; the shallow details
are fitted to that retained screen, not claimed to be a new survey. No part of
the four-part source family is removed or modified. French parent
`DEBE01YYK00009wl` / OSM relation 3203772 and US parent `DEBE01YYK00000k5` /
OSM way 195257482 retain the existing Pariser-Platz facade frames.

- [Berlin's British Embassy account](https://www.berlin.de/en/attractions-and-sights/3561156-3104052-british-embassy.en.html)
  identifies Michael Wilford's sandstone facade, slanted windows, purple round
  conference room, blue trapezoid and two courts.
- The [UK Government Art Collection](https://artcollection.dcms.gov.uk/stories/bonn-to-berlin-an-embassys-journey/)
  supplies the [exterior reference](https://artcollection.dcms.gov.uk/wp-content/uploads/2019/10/Berlin_2010_exterior-1024x682.jpg),
  © Crown Copyright. It establishes a vertical purple cylinder, glazed blue
  projection and single inclined facade mast. The former horizontal purple
  barrel and roof-mounted blue/white/red stripes were authored estimates.
- [Moore Ruble Yudell](https://www.moorerubleyudell.com/project/united-states-embassy-berlin/)
  explicitly describes the north-facing limestone grid, cylindrical niche,
  flag above the front door, glass-roofed rotunda and rooftop State Room.
  The existing Schlaier US photograph, public domain, remains credited in NOTICE.
- [Christian de Portzamparc](https://www.2portzamparc.com/en/projects/french-embassy-berlin/)
  establishes the seven buildings, three gardens and six-metre interior street.
  [Borgert](https://www.borgert-architekten.de/projekte/franzosische-botschaft)
  identifies the béton éclaté base and double-height Bel Etage windows. The
  previous Geoprofi Lars photograph remains credited under CC BY-SA 4.0.

Primary photographs were inspected only as external references; none is bundled,
traced, projected or loaded by the viewer. Fitting sizes, material tones, cloth
sizes and mounting heights are explicit display estimates. Flags are static
national recognition, not a claim about current flag protocol. The British flag
has both white and counterchanged red saltires and the central cross; it is the
Union Flag, not England's St George flag. The US field has thirteen stripes and
fifty five-point star signatures; the French flag has vertical blue/white/red
bands. The existing French European flag is retained as a twelve-star circle.

## Added detail and exact replacement receipt

British sandstone and the previous window/base/roof recipe remain.
Fine stone courses and paired casement details are additive. The single authored
over-tall dark opening panel yields to the photo-bounded lower opening with
central upper casements. The two coloured
forms are reinterpreted as the reference's vertical lower purple cylinder and
blue glazed trapezoid; the gate gains narrow bars. The old flag is replaced by
a Union Flag on a single inclined facade mast. No second British flag remains.

French concrete ribs avoid the retained entrance. Existing seven tall window
bays, doors, upper windows, balcony slabs, inscription and court geometry remain;
new reveals, casements and rail infill supplement them. The replacement flag
pair shares the entry canopy, EU left and France right as in the architect
photograph. Only the previous French
and European flag parts yield to the new pair. US casement crossbars, limestone
reveals, lintel shades, canopy ribs and State Room frames supplement the complete
previous grid/niche/canopy/lantern. Its national flag is added on the photographed tall entrance mast, just above
the parapet level.

| Existing builder | Optional default-true guard | Exact removed parts when false |
|---|---|---|
| `CentralCivicDetails` | `includeLegacyBritishCollage` | over-tall dark opening panel; horizontal purple cylinder; blue box and its three glazing bars; roof pole and three horizontal stripes |
| `MinecraftUnterDenLindenDetails` | `includeLegacyBritishCollage` | exactly two coloured facade blocks and the over-tall dark panel |
| `PariserPlatzArchitecture` | `includeLegacyFrenchFlags` | European flag/pole/stars and French pole/three bands |
| `MinecraftPariserPlatzArchitecture` | `includeLegacyFrenchFlags` | exactly seven flag/pole blocks |

`CentralCivicDetails` forwards `includeLegacyFrenchFlags` to its embedded Pariser
facade factory. All guards default true; calling any old factory without options
preserves its old output. Production must construct `createEmbassyGateV264(false)`
or `createEmbassyGateV264(true)` successfully before using these optouts. No
optional deferred asset is allowed to hide an older part before its replacement
exists. Root integration owns the production ordering.

## Verification and cameras

Five focused Bun tests verify finite/frozen texture-free geometry, independent
orthogonal native matrices, exact memory/vertex figures, flag identity, and
vertex-by-vertex preservation of every non-replaced drawn detail. Native subset
tests prove only three British collage parts and seven French flag blocks are removed.
The previous Pariser-Platz and Unter-den-Linden constructor tests remain valid.

| Contribution | Draws | Instances | Rendered vertices | Typed geometry/instance bytes |
|---|---:|---:|---:|---:|
| Drawn | 2 | 633 | 20,400 | 236,244 |
| Native | 1 | 3,613 | 86,712 | 275,236 |

These are bounded additive contributions, not new city residency policies.

| Review | Camera position | Target |
|---|---|---|
| British front | `[538,34,410]` | `[598,15,374]` |
| US front | `[445,33,280]` | `[466,16,357]` |
| French front | `[540,31,309]` | `[518,14,232]` |

UI review belongs to the root integration and uses only Codex's internal browser.
