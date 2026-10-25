# Weinbergspark: retained earlier shell materials (v271)

The recent phone screenshots show the model's grey repeated building treatment;
they are not evidence of the real facades' paint. This correction complements
`northMitteColoursV271` for the older measured shells that the separate
Alt-Mitte169 layer does not own. It changes only existing colour-buffer cells.

## Finite source coverage

The review rectangle is world XZ `[1770, -1600, 2250, -1080]`, on the west and
south sides of Weinbergspark. A complete original ground footprint must
intersect it. The complete parent family, all parts, measured roof planes and
court holes then remain together; the rectangle never clips a building.

| Original source | Layer kind | Selected complete families |
| --- | --- | ---: |
| `geo_data/regierungsviertel/mitte-streets-v166.json` | `mitte-street-fronts-v166` | 66 |
| `geo_data/regierungsviertel/scheunenviertel-v168.json` | `scheunenviertel-v168` | 9 |

The source/evidence archive records each parent and part identity, full bounds,
centroid, retained v176 terrain lift and all input SHA-256 hashes. Retained v166
families also described in the v168 source are not imported a second time.

73 families receive safe drawn selectors; 49 receive independently proved native
selectors. The remaining owners/faces retain their exact original appearance.
Native coplanar faces can span adjacent owners; those ambiguous faces cannot
be recoloured independently without changing geometry and are left intact.

## Material priority and stated uncertainty

The compiler joins the retained `outer-materials-v232-context.json.gz` OSM
footprints to the whole original ground union. It accepts only one matching
identity with at least 97% coverage in both directions. It recovers three
explicit roof observations:

| Original parent | Mapped identity | Retained observation |
| --- | --- | --- |
| `DEBE01YYK000049V` | `OSM-way-24531239` | grey roof |
| `DEBE01YYK00005wJ` | `OSM-way-386915705` | roof `#c75d4d` |
| `DEBE01YYK0000Ek9` | `OSM-way-24531231` | grey roof |

Unknown ordinary-house paint uses the same restrained 12 mineral-plaster hues
and six muted roof hues as the finite v271 Alt-Mitte adapter. The source parent
identity chooses one stable tone for the entire family. These are **illustrative
display estimates**, not a survey of each house's actual colour. Explicit
colours take precedence over material swatches; contradictory or unrecognized
observations preserve that role. A mapped glass body is excluded. A screenshot
of an earlier model is never sampled as real-world paint evidence.

Public primary references were reviewed to avoid treating modern individual
buildings as interchangeable old plaster facades:

- [Frank Schiffer: Kastanienallee 63–64](https://www.frankschiffer.com/projekte/zwei-haeuser-in-mitte/)
  distinguishes the projecting display windows at no. 63 and the rebuilt street
  facade/roof volume at no. 64. Retained address nodes place them at world XZ
  `[2374.097, -1687.950]` and `[2383.666, -1698.165]`; the associated measured
  source parent is `DEBE01YYK00002CB`. It lies outside this legacy rectangle
  and is explicitly protected by the complementary Alt-Mitte adapter.
- [Kny & Weber: Weinbergsweg 14](https://www.kny-weber.de/weinbergsweg-berlin)
  documents the long modern care-home building, central glazed projection,
  stair towers and the independent colour concept. Its retained address node
  is `[2263.068, -1438.964]`, associated parent `DEBE01YYK0000FDO`. It is also
  protected by the complementary adapter. The page does not establish exact
  current paint RGB values for adjacent houses.
- [Berlin monument database: Kollwitzplatz ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050453)
  defines specific historic street addresses, rather than a generic district
  palette. Kollwitzplatz is outside these legacy layers and is not claimed as
  covered here.

No reference imagery was downloaded, added as a texture or sampled into colours.

## Lossless application

The original v163 shell builder used flat sRGB wall `(211,208,197)` and roof
`(160,159,151)`, packed as linear bytes. That differs from the later v169
directional shading. A drawn selector requires the exact original colour, the
complete source plane/polygon including holes, and centimetre-delivery tolerance.
The earlier shells share corner vertices, so the replacement is one flat owner
tone; no added split vertices or plane-dependent colour seams are introduced.

Native selectors independently use the original material and full part envelope
with a two-metre voxel tolerance. Neighbouring source families remain in the
proof as blockers. Shared vertices qualify only when every incident triangle
agrees; rejection propagates through connected faces. Existing glazing,
window surrounds, doors, curb detail and other authored colours cannot qualify
as the exact old source wall/roof colours.

Four packet keys contain selectors: drawn/native `3_-3` and `4_-3`. Runtime
checks kind, mode, tile, mesh ordinal and the immutable positions/colours/indices
fingerprint. It validates all ranges before writing and yields during hashing,
validation and application. The tiny eager packet index skips unrelated chunks
before reading weak construction data. Later explicit material writers keep
their normal precedence.

The selector payload is 27,629 bytes (7,146 gzip); it changes 2,126 drawn and
8,569 native colour vertices. It adds no geometry, draw calls, GPU buffers,
textures, per-frame updates or live memory budgets. Every source/public packet,
index, coordinate and navigation payload retains its recorded hash.

## Verification

`uv run --no-sync pytest -q tests/test_weinberg_legacy_materials_v271.py`: six
checks pass for finite source families, court holes, reciprocal joins, material
precedence, exact packet preservation, generic-only selectors and native
ambiguity.

`bun test tests/weinberg-legacy-materials-v271.test.ts` (in `src/app`): six checks
pass, including all four actual packets, independent modes, both legacy kinds,
unchanged geometry/authored cells, malformed receipts, lazy rejection and
cooperative cancellation. Ruff passes for the new Python files. Integration and
browser comparison belong to the combined v271 release, not this isolated pass.
