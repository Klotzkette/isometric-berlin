# v1.0.74 — North Mitte landmarks

The BND headquarters, Berlin Wall Memorial on Bernauer Straße and Zionskirche
receive source-bound detail in all six visual modes. The Weinbergspark
playground now distinguishes its evidenced blue rubber area from the mapped
sandpits and sports courts. The 93-place tour and existing geographic bounds
remain unchanged.

## What changed

- [BND headquarters](bnd-headquarters-v174.md): mapped upper wings and lower
  gatehouses above the retained source base, aluminium facade rhythm,
  travertine entrances and the brick visitor-centre frontage. All 235 original
  surfaces and ten courtyard holes remain. The published 30 m maximum resolves
  an unusually low LoD2 envelope; intermediate heights remain documented estimates.
- [Bernauer Straße](berlin-wall-memorial-v174.md): distinct front and rear walls,
  round coping, signal-fence remnants, patrol tracks, watchtower detail,
  contemporary steel endpoints and marker rows. Two estimated museum boxes
  yield to 18 complete official source parts. The present-day open memorial
  grounds and public crossings are kept separate from the closed monument.
- [Zionskirche](zionskirche-v174.md): the missing high masonry spire restores
  the published 67 m silhouette, with belfry arches, clocks, pale masonry
  bands, portals and gallery detail. All 228 original boundary surfaces and
  eight source roof polygons remain in their existing source packet.
- [Weinberg playground](weinberg-playground-v174.md): 182.17 m² of blue rubber
  material, estimated from the official orthophoto and clipped against mapped
  sandpits, pitches and paths. This is a bounded material correction, not a
  claim to surveyed playground relief.

Small members, colours and unmeasured subdivisions are procedural visual
approximations. Source conflicts, primary sources and per-file photo credits
are documented in the linked records. Reference photographs are not bundled
or used as textures.

## Quality and memory preservation

Every drawn mode uses identical static model detail for pointer and touch.
Minecraft has four separate orthogonal batches. The drawn additions use nine
batches in total. Exact-size typed buffers and frozen static transforms avoid
extra per-frame work; lazy arrays keep unused native geometry undecoded.

A production worker-budget check caught an otherwise unused BND JSON import.
Importing only its small named budget metadata removes that render payload
from the worker. The unchanged 16 MiB worker ceiling passes at approximately
13.74 MB. A dedicated production-bundler regression verifies this isolation.
No visibility range, resolution, existing detail or water effect is reduced.

The Bernauer replacement is narrowly audited: 64 fallback source cells are
replaced by the complete new native model. Their 192 old generic panes are
removed, six neighbouring panes become exposed, and the net generic-pane
change is −186. Earlier baseline fixtures remain unchanged; the v174 delta
has its own provenance. Ground and Moabit block hashes remain unchanged.

## Verification

The integrated Chrome inspection covers all four new places in Day and
Minecraft. A WebKit iPhone-13 viewport run covers five views in Day,
Schwellenraum, Minecraft, Night, Snowstorm, Flooded Berlin and back to Day:
35 samples, no page errors, crashes or lost WebGL contexts. Invalidenpark is
included as a preservation check. The final church/memorial pass repeats
Day and Minecraft after the native lattice/fascia correction.

The WebKit run observed about 134 MB peak instrumented WebGL buffers. This
counts buffer allocations, not total browser or iPhone process memory. Browser
emulation does not verify physical iPhone memory limits or guarantee absence
of crashes on every device.

Source/navigation tests cover preserved courtyard holes, source hashes,
complete museum coverage, native surface occupancy and identical touch detail.
Integration tests verify the two exact replaced prism identities, a retained
neighbour, all 18 new museum parts, 697 wall/post obstacles and open crossings.
The final build, Python/Bun tests and downloadable-package checks are recorded
with the release validation below.

### Final release validation

- `uv run ruff format .` and `uv run ruff check .`: pass.
- `uv run pytest`: **799 passed** (6 min 57 s); two existing test-fixture CRS warnings.
- Focused Bun run across six model/navigation/native/stability test files:
  **99 passed**, including independent historical native-buffer hashes.
- `bun run build`: pass; worker 13,736.28 kB, unchanged 16 MiB ceiling.
- Chrome: 10 integrated view samples, zero errors/context losses.
- WebKit mobile: 35 all-mode samples plus four final church/memorial samples,
  zero errors/context losses. Screenshots inspected for drawn/native alignment.
- `check_release_readiness.py` and `smoke_local_package.py`: pass for v1.0.74.
- **673 existing mesh/map assets byte-identical** to v1.0.73. The remaining
  attribution asset retains its prior records and adds six inspected references.
- Pages publication preserves all previous hashed assets for already-open clients.

Archives (SHA-256):

- ZIP: `fd1b343e8749f43f0fb72fa79c68a85792f8add39b8c7b5e2e7bbca4fad843f4`
- Viewer tar.gz: `42dc0f5c386e5c5167afccde01f9e1a08a200aa6118fc5bf9cc901aac11f7505`
