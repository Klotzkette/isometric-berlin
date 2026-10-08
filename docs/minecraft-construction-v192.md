# Native construction audit, v1.0.92

The synchronous capture and cooperative production iterator produce identical
full and mobile geometry. The current fixtures are newly versioned; the v190
whole-world and v183 payload-only fixtures remain unchanged.

The independent comparison restored only `MinecraftArchitecturalLandmarks.ts`,
`ZooStationV165.ts` and `zooStationV165Profile.ts` from the pre-v192 Main commit
`aca0205779aef96ec5f14996f86e7792389de0bb`. A temporary Bun `onLoad` hook supplied
those three original files before importing the existing benchmark. Every other
module, source payload and installed Three.js dependency was identical. This
reconstructed reference reproduced both complete v190 hashes and both v183
payload-only fixtures exactly. No historical expected hash was overwritten.

The entire native-world difference is bounded:

- 32 additional existing-batch Hauptbahnhof/Chancellery metalwork instances.
- 294 instances in two Zoo canopy/member/glass batches.
- Two old source columns belonging to canopy owner `57658318` replaced by the
  complete open, transparent canopy. Their voxel tuples are
  `[-661,335,52,92,3]` and `[-660,335,52,92,3]`.
- Full mode loses five window panes attached to those old columns and exposes
  one neighbouring pane: four fewer generic facade panes overall. Mobile keeps
  its existing absence of the separate generic-window batch.

The independent integer-ring/adjacent-face enumeration in the existing test
helper matches the production Zoo owner predicate for every old and new source
column. The frozen delta records both replaced columns and retained neighbours.
The old ground-run and Moabit park instance arrays retain their exact hashes.

| Profile | Added net instances | Added submissions | Added buffer bytes |
| --- | ---: | ---: | ---: |
| Full | 320 | 2 | 25,616 |
| Mobile | 324 | 2 | 25,920 |

Reproduce the current constructor equality with
`bun test src/app/tests/minecraft-construction.test.ts`; the source-mask,
neighbour and retained-buffer checks live in
`src/app/tests/minecraft-voxel-world.test.ts`. The benchmark hashes every
geometry/index/instance buffer, including unused capacity, names and local
matrices. These are CPU geometry checks, not a claim about physical-device FPS
or peak browser memory. No runtime behaviour or budgets change in this audit.
