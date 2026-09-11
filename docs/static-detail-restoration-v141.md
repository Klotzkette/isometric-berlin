# Static detail restoration — v1.0.41

The owner's explicit instruction to restore quality supersedes the older mobile
budgets in individual landmark specifications. Touch input must not select a
permanently less detailed version of the drawn city. Scheduling, spatial
batching, exact vertex sharing and native Minecraft presentation remain separate
from this geometry policy.

## Restored content

Drawn constructors now retain the complete existing full profile on touch devices:
facade bays, window frames, railings, roof details and ornaments across the
Charité/Luisenstraße, Europacity/Otto-Weidt-Platz, Humboldthafen, parliamentary,
Potsdamer Platz, Kulturforum and City West models. The same applies to the
Bismarck/Moltke monuments, Krolloper ensemble, Moabit prison memorial park,
Weidendammer bridge and Lenné-Eiche.

ParkDetails restores granular trunks and fork branches, the complete source-form
crown populations, shrub and hedge foliage, individual wall-trace setts, detailed
playground equipment, deterministic path materials and Snowstorm additions.
Its complete source inventory remains 3,467 paths and 360 playgrounds. All 45,421
retained tree anchors remain present, with the existing 119 construction-tree
exclusions explicitly accounted for. Its 41,354 individual wall stones, 3,535
shrub clusters and 208 hedge-area clusters replace the former coarse mobile
substitutes. The separately requested Minecraft tree-density reduction is unchanged.

## Geometry verification

`static-model-detail-parity.test.ts` freezes budgets and SHA-256 signatures for
33 full constructors. The signatures were measured directly from original modules
loaded from commit `f81b3260ded11225799016c12e18108d8569662a`, then checked against
the restored constructors. They include vertex/index attributes, instance
transforms and colours, world transforms, draw groups/ranges and material
properties for the initial, day, night and moonlit presentations. Every full
signature remains unchanged, and every corresponding touch signature matches it.
The Lenné-Eiche and traffic tower have additional full/touch equality checks.

`park-details-mobile-profile.test.ts` checks the frozen pre-existing full budget,
all full/touch geometry signatures, source anchors and detailed content. It checks
both initial foliage and the complete settled foliage, including 500,033 instances.
`static-native-model-preservation.test.ts` independently freezes the geometry and
material signatures of 25 native Minecraft constructors in both full and mobile
profiles (50 cases); all match the same pre-restoration commit. This does not claim
that shared public-realm furniture retained in Minecraft becomes less detailed:
its restored drawn furniture is intentionally available there as well.

Old tests that demanded fewer mobile vertices or absent mobile foliage were
replaced with full-detail equality checks. Source identity, solid collision,
openings, roofs, materials and native Minecraft bounds checks remain in place.

## Measured storage and limitations

Before/after constructor measurements count unique geometry buffers plus instance
matrix and colour buffers. The sampled 29 building/monument constructors increase
from 21,572,404 to 31,583,839 bytes on touch. The park with `settledDetail: false`
increases from 11,644,566 to 40,236,942 bytes, equal to the unchanged full profile.
The complete settled park constructor occupies 44,083,326 bytes and includes
50,004 additional crown instances. The production touch viewer still passes
`settledDetail: false`; those additional settled-only crowns are hidden by default
and are not a claim of 500,033 visible mobile instances. The constructor equality
check establishes retained detail capability independently from presentation.
Shared geometries and spatial instance batches remain in use.

These are CPU typed-array storage measurements of individual constructed roots,
not browser total memory or simultaneously visible draw calls. They exclude JS
object overhead, driver allocations and other scene families. Restoring omitted
content necessarily increases memory compared with the former incomplete mobile
scene; it does not justify removing detail again or establish iPhone crash immunity.
The release review must separately assess progressive loading and browser behavior.

Focused verification: 241 tests across 24 affected model/integration files passed.
After the final profile-plan and budget corrections, 55 tests across the exact
model-parity, park, Gropius Bau and Weidendammer suites passed. The combined final native-model, full/touch parity and park suites passed 88 tests
with 116,395 assertions.

The combined Friedrichstadt-Palast/Tränenpalast regression also exposed a
remaining reduced mobile glazing profile in `createTearPalace`. It now uses
its unchanged full pavilion geometry (118 instances, 4,032 rendered vertices)
on touch. The combined full root remains 17,374 instances / 418,392 rendered
vertices; only its separate native Minecraft child retains the established
profile difference. Exact drawn-child signatures and all four combined-model
tests pass.
