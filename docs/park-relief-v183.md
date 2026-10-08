# v1.0.83 — measured Fritz-Schloß-Park hill

Step 10 adds one local official DGM field at mapped OSM park **way/15803725**.
The three v182 terrain fields remain byte-identical. The new profile lives in
`parkReliefV183.json`, with original NHN samples and source hashes separately
recorded in `park-relief-v183.json`.

The official Berlin ATKIS DGM1 archive `DGM1_388_5820.zip` has SHA-256
`fc95a713a7a7691ec95477ff915ccf23094f3544e132094547d4c7b95795d144`.
Its one-metre bare-earth XYZ samples are in EPSG:25833 / NHN. The retained
10 m subset reaches **53.29 m NHN / scene y=23.29 m**. Source licence:
**Geoportal Berlin, dl-de/zero-2-0**. OSM supplies only the park boundary,
under ODbL-1.0; terrain heights come exclusively from DGM1.

The scene uses measured NHN minus 30 m inside the whole mapped park and fades
over **80 m outside** its boundary into the original terrain. Monument and
building holes do not punch artificial holes in the hill. Its finite support
is `[-1310, -1520, -720, -740]` in the established world X/Z frame. This entire
support belongs to the detailed core, so **no previous outer packet changes**.

## Geometry and paths

The v182 source arrays remain the baseline. Only altitude changes:

- 883 core terrain samples are corrected.
- Whole source building prisms move rigidly without changing height, footprint,
  court holes or roof/wall proportions. Their 1,418 corresponding native
  building columns receive the same translation at both ends.
- 129 native trees and 737 park/tree/path/equipment coordinates follow their
  rendered terrain sampler. Inventory keys, counts and all original X/Z
  control points remain.
- Existing smooth ground triangles receive local edges of at most 4 m. Every
  original vertex, full plan area, winding and outside face remain.
- Long path chords receive at most 2 m collinear subdivisions inside the
  support/apron. Every original path point remains; original clearances are
  retained while paths and stairs follow the hill between source anchors. The
  added Fritz path storage is 180,728 bytes / 4,756 vertices, with no additional
  draw calls. Full and mobile path geometry remain identical.
- Backing slabs split only locally. Drawn backing stays at least 0.2 m beneath
  the lowest visible corner, so a broad horizontal plate cannot slice the
  slope. Unsplitted ends retain their exact v182 run altitude using a small
  local copy of the original height samples. Native backing uses local courses.

## Strict provenance chain

`park-relief-v183-audit.json` and `park-relief-v183-object-audit.json` record the
exact old and new values. `derived-provenance-v183.json` validates the six
existing dependent products before refreshing their ground/prism/tree hashes.
Their geometry is identical. This is a new, separately hashed receipt; the
historical v182 receipt is unchanged.

The preservation tests reverse the strictly recorded v183 Y values to the
exact v182 payload, then apply the unchanged v182 receipt to recover v181.
Both ends of each step are hashed, and every allowed leaf must be an altitude.
This retains earlier historical assertions without widening acceptable height
bands or accepting arbitrary changes.

Reproduce with:

```sh
uv run python scripts/build_park_relief_v183.py --samples --packets --objects
uv run python -m scripts.refresh_derived_provenance_v183
```

The original generator is reused through a versioned wrapper. It accepts a
parameterized park name selection and independent object-audit output; its
v182 defaults, earlier inputs and all three earlier height fields remain.
Raw DGM archives stay ignored. Neither photographic imagery nor an assumed
whole-city elevation field is introduced.
