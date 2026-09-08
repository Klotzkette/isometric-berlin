# Friedrichstadt-Palast close refinement — step 10, v1.0.6

The Palast now keeps the actual contrast between its decorated projecting foyer
and its simpler function wings. Eight faceted two-storey window bays surround
the central glazed promotional vitrine. Narrow pale/coloured concrete-glass
strips, deep centre mullions, stone transoms and nested arch mouldings replace
the previous large pastel arch infills. Both short foyer returns carry three
double-height bays. All nine street axes and all six return bays survive the
mobile profile; only subdivisions become coarser.

The roof lettering now stands above the front parapet and reads left to right
from Friedrichstraße. Red letter returns, pale faces, support struts and a small
procedural fan silhouette follow the external references. Neither a font, logo
file, show poster nor photograph is shipped. The promotional vitrine remains a
dark glazed architectural feature without invented current programme artwork.
The generic geometric ground-storey relief cues acknowledge Emilia
Nikolowa-Bayer's panels without pretending to reproduce every sculptural figure.

## Evidence and limits

- The exact eighteen-point plan remains
  [OSM way 24314976](https://www.openstreetmap.org/way/24314976), projected to the
  existing viewer origin. The original twelve-metre context prism remains in
  the source dataset. Its generic rendered shell is superseded only for this
  ID by the source-bound recognition model.
- The [Landesdenkmalamt explanatory sheet](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf)
  documents the 110 × 80 × 20 m main volume, 32 m-high/23 m-wide stage tower,
  six-metre structural grid, two-metre facade panels, two-storey projecting
  glass fields, vertical and arched mouldings, function-wing hierarchy and
  Emilia Nikolowa-Bayer's reliefs. The [theatre's anniversary record](https://www.palast.berlin/news/der-neue-palast-feiert-40-jahre/)
  supplies the 22,500 glass-block count. This count is factual metadata, not a
  claim that the aggregate geometry models every original glass block.
- John Samuel's [*Exterior view of Friedrichstadtpalast, Berlin 02.jpg*](https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_02.jpg)
  and [*Exterior view of Friedrichstadtpalast, Berlin 04.jpg*](https://commons.wikimedia.org/wiki/File:Exterior_view_of_Friedrichstadtpalast,_Berlin_04.jpg),
  both photographed 7 May 2024 and licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), were inspected
  at 1,280 px for facade order, concrete colour, glazing, relief location and
  rooftop sign placement. These external references are not bundled or loaded.
  A different Commons file labelled as a December 2025 Palast view actually
  showed street decorations, so it was excluded as building evidence.
- The nine front axes, three bays on each return, equal rear window spacing,
  member thicknesses, local stage position/depth and decorative subdivisions
  are bounded, non-surveyed recognition geometry. The 2024 photographs are
  dated appearance evidence, not a claim of a September 2026 condition survey.

## Rendering and access

`FriedrichstadtPalastDetails.ts` owns the complete smooth envelope and one
block-native Minecraft counterpart. The block envelope is a one-cell perimeter
shell plus roof tiles, without hidden volumetric fill. All glazing is opaque
coloured geometry with correctly configured instance colours: the source mass
must not obscure the visible window aggregates. The actual central source
projection receives its own exterior offset. Minecraft facade overlays sit
beyond its coarser one-metre skin. Diagonal arch/fan strokes become connected
small blocks without turning the fan into an opaque rectangular slab.

The previous `FriedrichstadtAndTearPalaces.ts` entry point remains compatible;
its separate Tränenpalast geometry is unchanged. A dedicated presentation
setter toggles only the Palast smooth/block roots while preserving the
Tränenpalast. The main/stage roof-height function follows the displayed
20.2/32.24 m envelopes above the established 5.2 m datum. The original OSM
source outline retains closed-body collision; exterior street approaches stay
outside the footprint.

Measured geometry buffers (positions, normals, colours, indices and instance
buffers; excludes ordinary JS object overhead):

| Profile | Draws | Instances | Stored vertices | Rendered vertices | Buffer bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Smooth full | 4 | 4,801 | 288 | 115,440 | 370,876 |
| Smooth mobile | 4 | 2,978 | 288 | 71,688 | 232,328 |
| Minecraft full | 1 | 12,455 | 24 | 298,920 | 947,228 |
| Minecraft mobile | 1 | 10,740 | 24 | 257,760 | 816,888 |
| Both representations plus unchanged Tränenpalast, full stored | 9 | 17,374 | 1,560 | 418,392 | 1,347,640 |
| Both representations plus unchanged Tränenpalast, mobile stored | 9 | 13,794 | 1,272 | 332,184 | 1,070,880 |

Only one Palast representation is visible at a time. The nine combined stored
renderables are not nine simultaneous Palast draw calls.

## Verification

The two focused test files exercise 1,118 real Three.js facade raycasts across
full/mobile smooth and Minecraft geometry, including front, central vitrine,
both foyer returns and rear wings. Each first hit must be the expected pane
instance, not a source wall or hidden duplicate. Roof rays match the pedestrian
height function; exterior approach samples remain clear. Tests also check
mode replacement, all retained mobile facade axes, absence of textures and
valid instance-colour materials. The Tränenpalast's earlier source and geometry
contracts continue to pass.

Actual Three.js triangles and instance matrices were additionally inspected in
front and oblique software renders. This is geometry QA, not a claim of a live
browser or iPhone rendering test.
