# Parliamentary dining — Step10 / v296

The colourful round restaurant belongs to **Paul-Löbe-Haus**, not to
Marie-Elisabeth-Lüders-Haus. The Bundestag's
[Jorge Pardo account](https://www.bundestag.de/besuche/kunst/kuenstler/pardo/pardo-199012)
and [artist flyer](https://www.bundestag.de/resource/blob/885866/0ffe70b550864744f5d2f25a78044f7a/flyer.pdf)
identify the glazed round ground floor, paired colourful ball lamps, round
wooden tables/chairs and green-white terrazzo. The model is an independent
procedural interpretation:129 paired pendants, a complete transparent ring,
floor, ceiling and furniture. Counts, fine lamp shapes/colours and furniture
positions are illustrative, not a traced installation plan. Reference photo
Jens Ziehe / ©Jorge Pardo, courtesy neugerriemschneider; the supplied Bundestag
Lampenladen entrance image remains reference-only. No pixels or textures ship.

**Marie. Das Bistro im Bundestag** is the separate public venue in the MELH,
verified by its [current operator](https://marieimbundestag.de/), the
[Kusus+Kusus conversion account](https://www.kusus-architekten.de/berlin/projekte/marie-elisabeth-lueders-haus/bistro.php)
and [the Bundestag newspaper's September2025 venue account](https://www.das-parlament.de/epaper/2025/38/epaper/ausgabe.pdf).
It has two indoor/outdoor levels on the Spree side. Both represented floors,
terraces, open balcony edge, connecting twenty-tread stair, tables/chairs and
restrained neutral pendants are included. The Pardo coloured installation is
not incorrectly duplicated in Marie.

## Original ownership and exact openings

`data/parliamentaryDiningV296.json` retains six **complete** original prism
objects and their original metric fields/materials. Four belong to the PLH
round site: `awyoe6EJ`, `U3jAipsY`, `EoqE0lzF`, and the outer wall `TAXdTj4D`.
MELH's room part `RdNEzXe9` and narrow riverside wall `11351098` are distinct.
Original source JSON and voxel payload hashes are pinned. No old source object,
upper office, roof, source inventory or neighbouring building is deleted.

The source-guarded cut is a bounded48-plane ground-floor cylinder at PLH, and
one bounded two-floor rectangle at Marie. Source fields must match completely;
changed or unknown owners stay closed. The native receipt records103 source
columns, of which88 are full-cell exclusive to these six owners. The remaining
fifteen contain foreign source owners and remain unchanged. Exact bottom, top,
class, grid size, all six source objects and newly overlapping unknown owners
are checked at construction. Admitted columns retain every upper, lower and
outside box fragment. The source base/lintel and all original data remain.

The existing opaque authored MELH Spree facade and its ink, and exactly the
native `Minecraft parliamentary band block signature` receive the same bounded
Marie opening only **after** the complete new room is built. The helper leaves
all other named groups, arrays and instances untouched. On the affected native
batch, uncut matrices/colours are retained bit-for-bit; only cut instances have
source-preserving outside triangle fragments. There is no broad scene clip.

The vertical room fit is explicitly unsurveyed: PLH floor4.24m/ceiling7.08m;
Marie floors0.65m and4.15m. The original voxel context at the room is4.1m,
while the western riverwalk sample is2.9m and retained water is−1.15m.
`DINING_GROUND_OPENINGS_V296` therefore provides the exact finite room/terrace
complement required to expose the lower floor. Its floor plane remains above
the retained water; no water height or outside ground is changed. These are
local display estimates, not a surveyed internal/shore elevation plan.

## Integration

- Build `createParliamentaryDiningV296(native)` in the required unpublished site
  transaction. Drawn mobile detail is complete; native uses independent cardinal
  furniture/lamp/floor construction. There are four drawn batches and two native
  batches, without new textures, media fetch, timer, lights or tour stop.
- Then call `applyDiningAuthoredOpeningsV296(oldRoot,native,true)` for the exact
  old drawn facade root / native architecture root. Its default is closed.
- `diningSourceOpeningsV296(prism,true)` returns guarded HbfOpening-compatible
  source cuts. `createDiningColumnOpeningsV296(prisms,cell,true)` returns guarded
  exact native-row cuts; `diningNativeBoxFragmentsV296` keeps their full complement.
- Apply `DINING_GROUND_OPENINGS_V296` to the finite original ground in the same
  transaction, preserving its complete outside fragments and source payload.
- `diningFloorAtV296(x,z,feetY,fallback)` includes the balcony/terrace/stair with
  feet gates, so lower visitors cannot jump onto the upper floor.
  `diningSolidAtV296` represents table/chair solids and actual glazing door gaps.
  It uses one small immutable navigation table, with no per-frame allocation.

`bun test tests/parliamentary-dining-v296.test.ts`: eight tests verify complete
source identity and rejection controls, actual source+native masking before/
after, the real old MELH facade/native architecture plus new visible pendants,
the actual4.1m native ground tile's lower-room complement, rendered staircase
support, complete same-detail families, native cardinal matrices and finite
instance/GPU limits. TypeScript/build/full-city browser and final release gates
belong to the integrating task.
