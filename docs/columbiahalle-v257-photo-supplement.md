# Columbiahalle photo follow-up — v257

The second supplied media set, received 21 October 2026, was compared with the
existing facade and illustrative interior. Its two exterior photographs confirm
the existing three double doors, steps, blue lettering, dated marquee and KASSE.
They are byte-identical to the earlier exterior references, so no additional
facade geometry or generator replay was warranted.

The red interior view clearly shows open triangular truss webs, a substantial
duct along the upper-right wall, suspended stage lights, stage-left cable drops
and an open side-balcony railing. These details now join the existing static
interior instance batch. Their dimensions, counts and repetition remain display
estimates; the photograph does not establish an as-built survey or bilateral
symmetry. The already illustrative left balcony and all decks remain in place.
The audience, performers, stage and existing structural chords are preserved.

The only removed authored geometry consists of the two previous illustrative
solid balcony panels: centres `[-14,4.7,3]` and `[14,4.7,3]`, each with dimensions
`[0.13,1,29]`. Each is replaced by two horizontal rails and fifteen uprights in
its existing deck position. No measured source geometry is affected. A focused
raycast test proves that the formerly solid middle area is now open while the
retained side wall remains behind it.

Drawn diagonal truss bars and eight-facet duct surfaces use the same box batch
with rotated instances. Native geometry independently uses orthogonal stepped
truss bars and five horizontal duct slices. Both families retain all details on
mobile. No new geometry/material batch, city packet, texture, animation loop or
live budget is introduced. The existing hidden/reduced-motion/disposal behavior
and 24-second light cycle are unchanged.

| Temporary interior resource | Before drawn | After drawn | Before native | After native |
|---|---:|---:|---:|---:|
| GPU attribute/index/instance bytes | 59,404 | 72,780 | 70,672 | 93,624 |
| Draw calls | 10 | 10 | 10 | 10 |
| Instances | 754 | 930 | 946 | 1,248 |

Both remain below the existing 100,000-byte interior test ceiling. Eleven focused
Bun tests passed, including both new physical-opening/native-matrix checks and
the existing lighting, GPU disposal, input and interaction tests (1,726 assertions).
No build, browser or release operation was performed in this follow-up.

## Supplied image identities

Files below belong to the second attachment set
`2FBF1C9D-9519-4249-A9F6-15EBC2D742B6`. All photographs remain reference-only;
no image pixels are bundled or used as textures. Existing user-media attribution
continues to apply.

| File | Bytes | SHA-256 | Relationship |
|---|---:|---|---|
| `3-Photo-3.jpg` | 76,807 | `e8b567a47fbb4ea40b8021aa656921e1ec55ffc4943371101ca32ffc7af74c3b` | Additional blue interior view |
| `4-Photo-4.jpg` | 141,751 | `b2318072983c5c9cd29f19b6472b168d2837ac85265d5908429d8e101f2570a6` | Same red interior view as earlier `4-Photo-4.jpg` |
| `5-Photo-5.jpg` | 212,803 | `121ab9d9436c28e18cd1168fb36616f55e1f2509970e0e31a905512e0056ecc6` | Same exterior as earlier `2-Photo-2.jpg` |
| `6-Photo-6.jpg` | 1,921,393 | `a58ef9ba5106ff5e5530766ead152b4f90c4a971a68b8bf8fd66d5e4dc69873d` | Same exterior as earlier `1-Photo-1.jpg` |
