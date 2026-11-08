# Public institutions V326

This is a finite current inventory and a complete-source envelope supplement,
not a photographic certification of every Berlin school or museum facade.
Earlier source bodies, roofs, courts, navigation and individual facade details
remain unchanged.

## Current records and limits

The retained Geoportal school data has **929 distinct official school codes for
2026/27**. Codes identify organisations; shared addresses and multi-building
campuses are not counted as 929 separate buildings. The official
[school directory](https://bildung.berlin.de/Schulverzeichnis/index.aspx) is the
current naming reference. Mapped school buildings/campuses remain separate
records, so one school can legitimately have several physical source families.

The current [Berlin.de museum A–Z](https://www.berlin.de/museum/a-bis-z/) yielded
206 linked entries. The
[Museumsportal map](https://www.museumsportal-berlin.de/de/museen/map/) publishes
200 named coordinate records while its separate paginated list reports 205.
These are different directory snapshots, not interchangeable building counts.
Only actual points inside the Berlin state polygon enter the spatial audit.
Location, current operation and complete building ownership are not inferred
from a nearby point. Unlinked and conflicting records stay explicit.

The [official court directory](https://www.berlin.de/gerichte/die-gerichte/)
provides 23 institution headings with addresses. The current names include
Amtsgericht Kreuzberg, Amtsgericht Pankow, Landgericht Berlin I and
Landgericht Berlin II. Shared houses remain shared; the two listed institutions
in Cottbus/Potsdam receive no Berlin geometry. Older OSM labels remain source
identities and are not asserted to be current court names.

`public-institutions-v326-inventory.json.gz` accounts for all 4,593 physical-source
and current main-site/directory records: 4,133 school, 434 museum and 26 court records.
238 school and127 museum records lack an unambiguous family association. A
directory point or building proximity alone never authorises a new body.
Monuments are a separate V326 inventory and are not added to these totals.

## Complete measured additions

Reproduction reads the immutable published206 manifest snapshot
`public-fidelity-v326-published206-manifest.json.gz`, checked against both its
compressed SHA and the complete original 2,174,832 decoded bytes. It never reads
the subsequently expanded live manifest as its exclusion baseline; otherwise a
second run would incorrectly exclude its own new packets.

The offline audit streamed 487 existing official LoD2 ZIPs without extracting
duplicate archives. It retained 8,161 complete candidate families / 22,002 leaves.
Actual original master sources, old packet navigation, Alt-Mitte resident
families and explicit authored models veto automatic new bodies. This includes
theatre/university models, the complete V209 HQ/HSH families, and the new V326
northeast/southwest families. Source presence is kept distinct from proof of
actual rendering; a packet-only miss is never called a missing building.

**3,106 complete missing families  / 7,387 leaves** pass both mode admissions:
3,040 school-associated families,64 museum-associated families and2 court annex
families. Every admitted family has at least 90% positive footprint overlap with
a mapped institution building/campus. All original Ground/Wall/Roof sheets,
holes, IDs and archive SHA values survive in
`public-institutions-v326-source.json.gz`.61 further candidates meet an old
Native owner; 7 have invalid/unsupported complete source or Native support.
They stay unresolved, with exact IDs/reasons, and produce no partial family.

Drawn geometry triangulates the complete original surfaces and clips them only
at the existing 512 m packet boundaries. The existing centimetre packing is used.
The standard neutral building/roof palette is a presentation default, not a
photographic material claim. Unmeasured windows, signage, facade rhythms and
tenant-specific details are not invented or laid over earlier authored work.

Each complete family gets one documented rigid datum fit. Inside the actual
retained ground-grid domain it uses the same `worldGroundSampler` values;
outside it uses the existing surrounding-packet `groundY=3` datum. Original
relative heights stay unchanged. There is no global DGM/NHN lift and no
surrounding district fill. Original groundless roof/canopy leaves remain
elevated rather than becoming walls down to street level.

Native geometry is independently constructed as closed cardinal columns.
Every entire square belongs to the original ground/projected-roof support;
roof heights are sampled from the measured triangles. The usual grid is 2 m;
only narrow measured leaves use finer centimetre-aligned grids. The exposed
colored surfaces are combined by an exact integer-square rectangle union,
without simplification, color averaging or hole filling. Roof collision uses
the actual resulting `nativeRoofCaps`; Drawn uses the measured roof triangles.
Full and touch use the same complete source geometry.

The independent final separation audit checks every 7,387 part support against
**171,919 actual retained Native packet-nav bodies** and the **complete original
Core RLE**, conservatively across all Y. Input packet bytes are SHA-verified
from the same immutable snapshots which supply their navigation. Any positive
overlap closes the whole candidate family. New Native geometry never expands
into an old building or relies on Drawn-only disjointness. Detailed evidence is
in `public-institutions-v326-evidence.json.gz`.

## Streaming and verification

`PublicInstitutionsV326.ts` exports `publicInstitutionsManifestV326`
(`chunks`, exact unbuffered `footprint`, `groundY`). Root integration appends
these normal descriptors through the established loader. The complete gzip
SHA is checked before the unchanged bounded decoder. No new always-resident
city mesh, worker catalogue, timer, runtime download service or source
retirement is introduced.

There are 579 descriptors across 573 spatial cells, at most 2 pieces per cell.
Each mode has at most 1 mesh per packet. The largest packet has 8,286 vertices,
32,742 indices and 1,434,961 decoded bytes; all existing 400,000 vertex,
2,400,000 index,16 mesh,12 MiB decoded-packet and24 MiB geometry limits remain.
The exact union has 1,883 polygons; only finite static descriptor/footprint
accounting needs growth. Compressed new packets total 12,084,038 bytes
(3,585,167 Drawn + 8,498,871 Native). These are offline/package figures, not a claim
that every packet is resident at once.

The bounded tests cover complete sheet/court triangulation, roof-only leaves,
ground sampler limits, actual old-Native/RLE conflicts, closed Native support,
colored oriented rectangle-union equality, every delivered packet's full
SHA/array/index limits, and the actual decoder on the largest packets in both
modes. Cancellation and malformed admission preserve the complete original.
No whole-city construction or browser is used by this proof suite.

## Source provenance

Source building archives are the official
[Geoportal Berlin LoD2 downloads](https://gdi.berlin.de/data/a_lod2/atom/)
(dl-de/zero-2-0), with each actual archive path/SHA and original polygon IDs
retained. Mapped campus/building associations come from the retained
2026-09-29 OpenStreetMap Berlin extract (ODbL 1.0), clipped to the actual Berlin
state boundary. Current directory facts were retrieved 2026-11-08 from the
primary links above. No photographs, page prose, logos or textures are copied
into the viewer.
