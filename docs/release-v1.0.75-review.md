# v1.0.75: small Zionskirchplatz frontage update

Step 10 changes only four existing buildings: Kastanienallee 49/50 and
Zionskirchstraße 21/22–24. Thin facade colours, differentiated ground floors,
divided shop windows, cornices and a few narrow balconies improve recognition.
The former Café 103 receives one explicitly historical window mark.

[Sources, exact scope and uncertainty](zionskirchplatz-v175.md).

All existing city source packets, roads, roofs, navigation, mode behaviour,
view distances and mobile detail remain intact. This is a small additive
visual change; it makes no new claim about physical iPhone memory limits.

## Bounded rendering and preservation

The addition is 47 coloured triangles and 1,170 box instances in two drawn
batches (94,644 GPU attribute/index/instance bytes), or 3,419 orthogonal native
runs in one batch (260,492 bytes). Both static representations are complete on
touch and pointer. The worker stays at 13,736.28 kB, below its unchanged 16 MiB
limit. The new production module is approximately 307 kB before compression.

All 673 pre-existing city mesh/data assets are byte-identical to v1.0.74. The
remaining attribution asset only gains the two reference credits (481 → 483),
without deleting a prior credit. All four complete source records and their
24 roof polygons retain their hashes. No existing model or street is removed.

## Browser verification

Chrome checked all three nearby viewpoints in Day and Minecraft. Mobile WebKit
with an iPhone 13 profile checked the same views in Day, Minecraft and Night.
No page errors, context loss or reload occurred. The final historical sign was
also inspected close up in both geometric representations after its native
lattice refinement. These are browser-engine/profile checks, not a claim to
have tested physical older iPhone RAM limits. Instrumented mobile GPU buffer
peak for the three-view run was 104,063,870 bytes, not total browser memory.

A visual check found and removed a coplanar backing overlap between the upper
plaster and ground-floor colour. A spatial test now requires those patches to
have zero overlapping area.

Production build, focused frontend tests (11 tests), Ruff formatting/lint,
release readiness and the local package smoke check passed. The final complete
Python suite passed: **802 tests**, with two existing CRS warnings from a
synthetic source fixture (404.86 seconds). The final close-up also passed in
mobile WebKit for Day and Minecraft with no page errors/context loss.

## Release package

The packaged index and every built asset match the final production build.
The Pages publication retains all 2,317 previous files, including old hashed
JavaScript chunks for already-open viewers, and overlays the 955-file package.
No published asset is deleted by this release.

The ZIP is 280,082,647 bytes, SHA-256
`3e71139a904b590fd0ec6ad25f9a0ce12ae79b8faafaa8a4569b850a06a343f7`.
The tar.gz is 279,805,276 bytes, SHA-256
`5f3c036271ac43667a3c4bdbc713b995c2771be02f2761d924d72a8ce83ca7b5`.
Both archives carry package version 1.0.75 and the same viewer.
