# Zoo Berlin and Schleusenkrug, v1.0.65

This step-10 supplement uses the current OSM Zoo Berlin outline (way
`9393789`, about 31.55 ha) and a finite adjacent Schleusenkrug garden. It
does not use or trace the protected visitor map or a landscape architect's
plan. Existing source trees, other houses, roads and bridges remain in place.

## Geometry and ownership

The October 2026 bounded OSM API response supplies 104 mapped animal
enclosures, 221 path ways, 34 ponds and 84 barrier ways. The original
coordinates and source identities are retained in `zooGroundsV165Evidence.json`.
Path widths use OSM metres where present and an explicitly estimated 3 m
otherwise. New ground polygons are clipped against the measured buildings,
mapped water and preserved path corridors; paths never become rectangular
plates. The mapped canal and footbridges keep their existing owners.

Eighteen official LoD2 parents supply 53 parts and all 1,963 wall/roof
boundary surfaces for the Schleusenkrug, old and modern bird houses,
elephant and antelope houses, hippopotamus house, rhinoceros house,
aquarium and a small Löwentor building. All roof shapes, holes and
source elevations remain in the evidence. Runtime presentation only
translates each parent vertically to the scene's existing `y=5.2` ground.
The exact 18 prior prism identities are in the navigation file. Four
are OSM fallback footprints now replaced by their complete official bodies;
the other fourteen are existing LoD2 part envelopes. Other building bodies
are untouched. Geometry from source boundary surfaces is used whole,
including the transparent hippopotamus and birdhouse shells. The exact
condor and marsh-bird aviary owners `gD00006I` and `gD00006J` retain
their full official boundary surfaces and 21.236/23.884 m heights, but their
closed generic grey envelopes become transparent shells with source-height
structural cages. A separate native translucent block batch preserves the
same enclosure visibility. This targeted ownership correction was found
by the first production-viewer camera check.

The source-bound Schleusenkrug garden is OSM way `1046088364`; restaurant
node `269712300` lies in its retained two-part official building.
Its 21 procedural picnic tables preserve mapped approaches and building
clearance. The turquoise/grey facade, green window frames, pale roof sign
and red lettering use inspected free photographs; furniture positions and
facade subdivisions are estimates. The old generic garden is retired only
at its exact `[-24437,7978]` decimetre anchor.

## Individual zoo recognitions and uncertainty

- Andean condor enclosure: exact OSM way `32995989`, near
  `[-2109,1024]`. The open structural aviary, fine net lines, perches and
  two small condor silhouettes are procedural detail within this enclosure.
- The mapped climbing-rock sequence is **Siberian ibex** (`25036813`),
  **Sichuan takin** (`25036814`) and **Himalayan tahr** (`49896121`).
  It is not labelled as a surveyed chamois habitat. Pale stratified rock
  profiles and the animals' poses are display estimates inside the exact
  mapped rocky footprints; no filled underground rock mass is generated.
- The modern **Welt der Vögel** is way `238917065` near `[-2390,915]`,
  distinct from the older small birdhouse `48120295` near `[-2425,838]`.
  The official three-part geometry preserves the angular high brick core
  and surrounding curved low loops. Thin structural cage rails and the
  west-facing glazed entrance follow that source geometry.
- The historic white/arctic fox request conflicts with the current zoo.
  The [Zoo's official 2016 annual report](https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_AG_2016.pdf)
  reports that the last arctic fox went to Neumünster and no enclosure was
  planned for it at the predator house. Current OSM and the current official
  species list supply no current fox location. The model therefore keeps
  the current mapped predator-house grounds, without inventing a present
  white-fox enclosure or pretending to know its former precise footprint.

The Zoo's [Adlerschlucht description](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/adlerschlucht)
confirms the net aviaries and adjacent ibex/takin rock landscape. The
[birdhouse structural engineer](https://www.sfb-bauingenieure.de/projekte/vogelhaus-im-zoo-berlin)
and [architect](https://lkkarchitekten.de/projekte/vogelhaus-zoologischer-garten-berlin/)
confirm the high core, glazed free-flight halls and four curved loops.
These descriptions supply factual recognition cues, not traced plans.

## Memory and independent native geometry

All four drawn modes use identical complete detail on pointer and touch.
Six batches render measured houses, glass shells, facade instances, mapped
ground, structural instances and small rock/animal/rod surfaces. No
reference photograph or texture is bundled or fetched. Raw source evidence
is kept in a separate unimported file, and navigation contains only small
roof data rather than a second full house or ground payload.

Minecraft uses three independent axis-aligned instanced batches. All source
shells are sampled at one metre, then adjacent equal-colour cells are
losslessly merged along rows. Ground uses the same compact row method.
Cliffs are surface-only columns and rails/animals are orthogonal steps.
There are no hidden solid voxel interiors or smooth duplicate meshes.

Measured isolated model budgets after the production-viewer aviary correction:
drawn 6 calls, 9,613 instances and 2,710,300 GPU buffer bytes; native
3 calls, 93,894 instances and 7,137,024 GPU buffer bytes. The retained
native house/cage shell contains 48,876 one-metre occupied cells, merged
without loss into 17,057 rows. The runtime source is 2,849,283 JSON bytes;
the separate navigation is about 251 KiB. Five source tests and four
scene/navigation tests verify complete ownership, source triangles,
native axes, bounded buffers, path-cleared furniture and transparent
condor/marsh-bird cage treatment. Full viewer checks belong to the release review.

Reproduce after fetching the recorded finite OSM map response and keeping
the four referenced official LoD2 archives under ignored `raw/lod2`:

```sh
uv run python scripts/build_zoo_grounds_v165.py
uv run pytest tests/test_zoo_grounds_v165.py
cd src/app && bun test tests/zoo-grounds-v165.test.ts
```

Inspected external references (all attribution-only, no bundled pixels):
Bjørn Erik Pedersen, *Schleusenkrug in Berlin.jpg*, CC BY-SA 4.0;
Fridolin freudenfett/Peter Kuley, *TiergartenSchleusenkrug-1.jpg*, CC BY-SA 3.0;
Anszu, *Welt-der-vögel-zoo-berlin.jpg*, CC BY-SA 4.0;
Colin Smith, *Zoo Berlin - Steinbock (Mountain Goat) - geo.hlipp.de - 40696.jpg*,
CC BY-SA 2.0. Exact links and credits are in the central attribution manifests.
