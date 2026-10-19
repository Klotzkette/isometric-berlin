# Danziger Straße 57 / Senefelderstraße 35 — Step 10, v245

This bounded addition refines the existing corner house `DEBE03YY60000CKO`
(OSM `41724936`, LDA `09075102`). Five complete drawn street walls and eleven
independently matched orthogonal native walls receive a red upper-brick finish,
cream rusticated base, contrasting window surrounds, pilasters, sills, cornices,
dentils and small pediments. These are shallow fittings on actual retained wall
triangles, not a replacement block or new coverage.

The original walls, roofs, navigation and all older packets remain byte-identical.
The v244 ordinary-front pass explicitly excluded this named heritage owner. The
only older companion at this footprint, `kiez209-6_-5`, has no triangles on the
selected facade planes; focused tests verify that no authored fittings are covered.
Twenty prior packet hashes and the frozen v244 source hash are retained as receipts.

The existing roof and turret envelope is intentionally retained. Small ornament
sizes, individual openings and material tones are photo-guided display estimates,
not surveyed dimensions or claims about current occupants. No new collision
surface or doorway is introduced. Projection is at most 24 cm and all fittings
remain inside the complete source wall's height and finite length. Base, brick and corner finish panels do not
overlap; quantized rustication, glazing and pediments retain clear depth separation
from their backing surfaces, avoiding collapsed sub-centimetre layers.

## Sources and credits

- [Landesdenkmalamt Berlin, monument 09075102](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075102): exact address, identity and history; Eugen Reethen, 1893–94.
- [Bodo Kubrak, *Danziger Straße 57 (Berlin-Prenzlauer Berg)*, 20 June 2016](https://commons.wikimedia.org/wiki/File:Danziger_Stra%C3%9Fe_57_(Berlin-Prenzlauer_Berg).jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Original photograph inspected as reference for the restored material and ornament hierarchy. No photograph, sampled pixels or texture is redistributed.
- Existing Berlin LoD2/Geoportal and OSM provenance and licences remain attached to the unchanged source city data. The complete source-owner records and exact source triangles are retained in the v245 source file.

## Measured cost

One optional descriptor, `danzigerlandmark245-6_-5`, with `detailCompanionOf: 6_-5`.
One packed mesh per family; no synchronous runtime builder or worker import.

| Family | Street walls | Windows | Vertices | GPU geometry bytes | Gzip bytes |
|---|---:|---:|---:|---:|---:|
| Drawn | 5 | 85 | 5,220 | 78,300 | 32,276 |
| Native | 11 | 75 | 5,284 | 79,260 | 26,680 |

Total installed transfer increase: **58,956 bytes**. Runtime resident, decode and
prefetch limits are unchanged. Existing cancellable decoding and complete disposal
are checked for both families. Empty companion navigation must remain subordinate
to the existing parent tile.

## Reproduction and validation

From repository root:

```sh
uv run python scripts/build_danziger_landmark_v245.py
uv run pytest -q tests/test_danziger_landmark_v245.py tests/test_danziger_fronts_v244.py
```

From `src/app`:

```sh
bun test ./tests/danziger-landmark-v245.test.ts
```

The Python tests independently check original full-wall triangles, unchanged prior
packet hashes, absence of overlapping older facade details, finite fitting bounds,
material distinction and independently orthogonal native geometry. Bun tests decode
all vertices/indices, dispose the complete mesh and abort superseded loading.

Browser comparison: camera eye **[3480, 12, -2225]**, target
**[3453, 13, -2256]** shows the corner and both street wings. Shared manifest,
credits panel and release integration are handled separately from this generator.
