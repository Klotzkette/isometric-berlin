# WELT Balloon ring gondola and native scene — v281

The drawn passenger deck now has an open annular centre instead of a capped
cylinder. The existing outside fascia, 24 suspension lines, envelope, tether,
boarding pad and winch remain. An inner handrail and narrow diagonal safety
lines make the ring readable from above and below. The estimated inner radius
is 1.65 m; the retained published outer diameter is 5.90 m.

`src/app/src/WeltBalloonV281.ts` supplies the annular mesh helper and a separate
`createMinecraftWeltBalloonV281({ mobileLike?, anchor? })` factory. Add that
factory once to the **native** required scene only. The drawn scene already
uses its existing `createWeltBalloon` owner in `ExpandedCityDetails.ts`; do not
attach a second complete drawn balloon.

The default anchor is copied exactly from the existing scene landmark:
`[968.1457638457068, 8, 1241.5250578913838]`. No OSM owner, building, floor,
loader descriptor, residency limit or source profile is replaced. The main
`WELT_BALLOON_PROFILE` in `expandedCityProfiles.ts` is unchanged, including
22.67 m envelope diameter, 34 m total height, 91 m displayed envelope centre,
5.90 m gondola and 30-person capacity. The 91 m centre is a fixed presentation
pose, not the live altitude. The retained white fabric, two blue stripes and
four black WELT words follow the owner's chosen livery.

The native recipe constructs cardinal layers, stepped cable runs, annular
floor cells, outside/inside railings and safety lines, winch and boarding pad.
Four black pixel words follow the actual stepped envelope skin. It does not
voxelize or rotate the drawn meshes and contains no texture. Desktop and touch
submit identical native geometry. Adjacent cells merge only at equal material
and height; the opening stays free around the thin central tether.

## Sources and uncertainty

- [Operator: WELT balloon FK-5500/STU](https://berlinhelicopter.de/weltballon-mehr-erfahren/),
  checked 28 October 2026: confirms 22.67 m balloon, 5.90 m gondola, 22 mm
  tether, maximum 150 m ascent and capacity up to 30 people. The current page
  does not separately list the retained 34 m overall-height parameter.
- [Existing mapped ground owner](https://www.openstreetmap.org/way/1250081894),
  © OpenStreetMap contributors, ODbL 1.0. The existing scene anchor is retained
  and checked against `src/app/public/mesh/regierungsviertel/scene.json`.
- [Die Welt balloon at Wilhelmstr.jpg](https://commons.wikimedia.org/wiki/File:Die_Welt_balloon_at_Wilhelmstr.jpg),
  Orderinchaos, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  The already retained local photograph
  `references/wikimedia/welt_balloon_02_file-die-welt-balloon-at-wilhelmstr-jpg.jpg`
  was inspected for gondola/suspension structure. Its historical blue livery
  is not substituted for the owner's selected white livery. No image pixels
  are copied into runtime assets.

Annular width, rail dimensions, small safety members and cable display width
are recognition estimates. No photograph is claimed to survey those sizes.
The existing source/profile credits continue to apply; this revision introduces
no new photographic source or distributed photograph.

## Focused validation

`bun test tests/welt-balloon-v281.test.ts`: 3 pass, 0 fail, 63,916 assertions.
Downward rays miss the drawn deck opening and hit the annulus at its proper
height; native deck cells remain outside the opening. The source anchor and
five main dimensions are checked. Native matrices are finite, positive and
world-cardinal; no UV attribute is present and mobile geometry hashes match.

Native submission: **346,692 bytes, one draw, 4,557 instances, 24 shared base
vertices**. The added module is 8,495 bytes of TypeScript. The only targeted
drawn edits are the helper import, deck replacement and inner railing/net.
Full integration, all-scene tests and browser acceptance belong to the serial
v281 validation; the focused tests do not claim those checks passed.
