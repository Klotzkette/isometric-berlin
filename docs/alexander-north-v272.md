# Pressehaus and the northern Alexanderplatz frontage — v1.0.172

Step 10 refines the existing **Pressehaus**, its glazed southwestern stair
tower, the **Pressecafé** and the **New Podium**. The complete v166 geometry,
Park Inn, Memhardstraße, Karl-Liebknecht-Straße, the v189 Haus des Reisens and
v257 CUBIX/RathausPassagen/Fernsehturm details remain. There is no new geographic
coverage, ground, navigation footprint, tour stop, texture or streaming descriptor.

## Sources and the two different signs

The [Landesdenkmalamt's entry 09020853](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020853)
identifies the 1970–73 building and its architects. [gmp's completed renovation
account](https://www.gmp.de/de/projekte/7669/pressehaus-am-alexanderplatz) describes
the 17-storey, 92-metre slab, restored original facade and glazed stair tower,
Pressecafé and separately articulated New Podium. The current
[operator](https://pressehausberlin.de/) describes the circular **BERLINER VERLAG**
sign as rotating. It is therefore the crown, not the newspaper's name, that turns.

The [publisher's historical account](https://www.berliner-zeitung.de/article/in-eigener-sache-umzug-des-verlages-berliner-zeitung-am-alexanderplatz-wo-sonst-316754)
distinguishes that crown from the separate **BERLINER ZEITUNG** rooftop letters,
which were removed and retained. The requested newspaper name is restored in the
model as a **historical recognition feature explicitly requested by the owner**.
This does not assert a newly installed physical sign in October 2026. Both names
use independently authored geometric strokes, not a copied font or logo.

Two reference photographs by **Marcus Bredt**, published by gmp, were inspected
outside the repository. They establish the projecting white brise-soleil,
recessed grey window panels, glazed stair shaft, circular crown and the cafe's
glass/fascia organisation. The photographs remain reference only. The protected
Willi Neubert frieze is indicated by independently arranged warm/cool colour
fields at its source-bound fascia; its figures and composition are not traced.
The separate [reference ledger](../geo_data/regierungsviertel/alexander-north-v272-credits.json)
records every source, author and restriction.

## Metric anchors and preservation

`alexanderNorthV166Evidence.json` retains all 107 source parts. This pass selects
only 16 exact wall sheets from parents `DEBE01YYK00009bU` (Pressehaus/New Podium)
and `DEBE01YYK00005vN` (the contiguous Memhardstraße/Pressecafé family): seven
tall slab faces, three stair-tower faces, four cafe faces and two podium faces.
The runtime file records each exact source part, sheet index, hash, coordinate
basis and local polygon. Every new panel is strictly contained in its original
wall polygon. Roof profiles, source vertices and all prior facade rows are
unchanged. Shallow backing fields cover the former generic window rhythm only
inside these exact source-contained rectangles.

The white fins, opaque horizontal panels, grey glazing, window mullions and
glass bands are recognition estimates. gmp's published storey count guides the
sixteen upper rows over the ground floor; no measured height is rescaled to fit
an architectural nominal number. Source-cut edges clip individual fittings.
Native Minecraft independently samples orthogonal surface strips and letter
strokes, with clearance from its retained two-metre source skin.

The only deleted authored geometry is the inaccurate v166 crown: two flat words
and two horizontal polygon rings. An exact row comparison against the previous
factory identifies **150 drawn** and **595 native** instances. Every other
recognition row is retained in the same order: **214 drawn / 983 native**, with
Float32 matrix-and-colour SHA-256 receipts. All complete original source sheets,
facade boxes and native source runs remain byte-for-byte unchanged.

## Shared-loop motion and cost

The existing v166 factories now attach one separate crown batch and expose
`root.userData.updatePressehausV272(timestamp, camera, reducedMotion, pageHidden)`.
The central viewer calls it from the existing frame loop; it never creates RAF,
timers, event listeners, media elements or new requests. Visibility checks include
all ancestors, the camera frustum, hidden-page state and reduced motion. GPU
geometry eviction keeps the animation reusable. The viewer's final root teardown
calls `disposePressehausV272` to permanently disable updates, including on rollback.
Suspended time is not accumulated and
resumption cannot jump through a long elapsed interval.

Rotation runs at most ten updates per second, with an explicitly illustrative
90-second period. Drawn mode changes one mesh transform. Native mode moves the
same preallocated independent block centres around the circle while retaining
strictly axis-aligned matrices. Both reuse their original buffers and fixed
rotation-safe bounds; no city shadow-atlas rebuild is requested.

| Complete existing v166 group | Draw calls | Instances | Geometry and instance bytes |
| --- | ---: | ---: | ---: |
| Drawn, full on mobile and desktop | 4 | 42,006 | 3,563,436 |
| Independent native Minecraft | 3 | 20,831 | 1,585,100 |

The prior group used 3,258,180 drawn bytes and 725,804 native bytes. All existing
city resident, decode and prefetch limits stay unchanged. The new 175,444-byte
construction receipt supports the established lossless weak `panels` field;
small face/identity receipts remain eager. Source-detail quality is unchanged.

## Reproduction, tests and visual review

`uv run --no-sync python scripts/build_alexander_north_v272.py` deterministically
builds the receipt from the unchanged committed v166 evidence. Three Python
tests verify original-sheet hashes, exact regeneration, complete containment of
every fitting and the separate present-day/historical sign identities.
Six Bun tests across v166/v272 verify every source buffer, the exact unrelated
recognition complement, independent native matrices, bounded group cost and
motion suspension/disposal with stable buffer identities. The production storage
parking pass is also exercised through both complete frozen factories: animated
native matrices stay writable and orthogonal, and drawn world transforms update.
Scoped Ruff passes.
Aggregate TypeScript, release, full-suite and integrated internal-browser checks
belong to the parent release verification.

Suggested internal-browser views, metres in the existing scene frame:

| View | Target | Camera |
| --- | --- | --- |
| Slab, stair tower and cafe | `[2780,38,-578]` | `[2910,104,-435]` |
| Crown and fixed newspaper letters | `[2764,73,-563]` | `[2815,94,-510]` |
| New Podium at rear | `[2785,18,-615]` | `[2660,95,-700]` |

Use the full existing v166 factory. It preserves measured shells, source ground
relations and previous north-side owners without needing a second whole-city
renderer. No external Safari or browser process should be launched.
