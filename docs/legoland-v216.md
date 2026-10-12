# LEGOLAND entry — v1.0.116 / Step 10

Bounded correction requested by the owner, based on v1.0.115 (`85e07023`).
Only the old authored giraffe yields to the current model. No measured Sony
Center facade, roof, ground, street or other city owner is removed.

## Evidence and limits

- [Operator directions](https://www.legolanddiscoverycentre.com/berlin/plane-deinen-besuch/vor-deinem-besuch/anfahrt/) identify Potsdamer Straße 4 at Sony Center.
- The OSM attraction POI `429567552` is at `[17.884, 1023.63]` in the viewer's XZ
  frame, inside the west building. It describes the underground attraction,
  not the sculpture. The old model incorrectly used it as the outdoor anchor.
- Berlin's official DOP 2025 and the retained flanking LoD2 owners place the
  outdoor approach in the open gap. The new estimated giraffe anchor is
  `[61.3, 5.18, 1053.3]`, the entry pavilion `[65, 5.18, 1039.8]`.
  These are reference-aligned estimates, not a ground survey. See the
  [machine-readable record](../geo_data/regierungsviertel/legoland-v216-source.json).
- Two July 2022 [Commons photographs](https://commons.wikimedia.org/wiki/File:Lego_Giraffe_(Mai_2022)_Legoland_Discovery_Centre_Berlin_02.jpg)
  by Singlespeedfahrer (CC0 1.0; both individually credited in the manifests)
  show the replacement yellow giraffe's multicoloured spots, broad ears,
  black-tipped horns, cyan cuffs, black hooves and red lips, plus the yellow
  wayfinding panel. The earlier brown-spotted predecessor is not restored.
- [Kinokompendium's entry photographs](https://www.kinokompendium.de/legoland_kino_berlin.htm)
  establish the small pavilion behind the giraffe and the underground entrance.
  The [operator FAQ](https://www.legolanddiscoverycentre.com/berlin/plane-deinen-besuch/informationen/fragen-und-antworten/)
  distinguishes the separate shop lift in the Forum. Door/roof subdivisions,
  colours and individual brick placements are recognition estimates.

The small concave sett apron follows DOP/photo evidence and OSM sett footway
`779525528`; its boundary is an estimate. Original ground and mapped path remain
retained. Ground levels come from the existing 16 m terrain field, with small
surface clearance offsets so hooves remain visible.

All photographs and the orthophoto remain external references, never scene
textures. Drawn desktop and touch use identical static detail; native Minecraft
gets its own stepped geometry and no drawn duplicate. Models use compact
final-count instances with existing lighting/disposal, no animation, new network
request, tour stop or increased city memory limit.

## Validation

The complete addition uses five render calls and 221,240 GPU buffer bytes in
drawn modes, or 157,476 bytes in native Minecraft. The giraffe itself uses one
batch: 1,153 drawn instances / 314 native instances. No texture is allocated by
the model. The complete local package is 875,674,211 bytes (835.108 MiB), within
the unchanged 836 MiB archive cap; live residency limits remain unchanged.

- TypeScript and production build pass. Ruff format/check pass (537 files).
- Focused geometry, cultural integration, Sony source-envelope preservation and
  mode-line checks pass (26 tests); an independent reviewer also verified mode
  ownership, disposal and the progressive-worker bundle guard.
- The full Python run passed 1,295 tests, with four skips. Three failures were
  caused by version changes during that run and its read of an archive still
  being written. After freezing the build and archives, the complete smoke and
  release suites passed all 80 tests, including those three checks.
- Source LoD2/OSM packets, ground and all unrelated buildings remain byte-identical.
  The prepared Pages tree retains 1,224 earlier hashed assets. Its only changed
  data file is the additive Wikimedia credit manifest.

- Final Chrome and iPhone 13/WebKit emulation each pass 12 views (entrance and
  giraffe in all six modes): exactly one visible entrance/giraffe, camera
  continuity, no page errors or lost graphics contexts. Day screenshots were
  inspected from clear street-side cameras. This is browser emulation, not a
  physical-device endurance test.
- Release readiness, both complete archives and the local launcher smoke pass.
  Checksums accompany the release as `SHA256SUMS.txt`.
