# Ringbahn completeness and recognition — v1.0.132

All **27 Ring stations** remain represented by their retained source identities,
full mapped platform polygons and roof/building records. The [S-Bahn Berlin S41
inventory](https://sbahn.berlin/fahren/s41/) was rechecked on 18 October 2026 and
still lists 27 stops. This is a geographical completeness audit, not a claim that
every existing station interior has been newly surveyed.

The clockwise source inventory is Gesundbrunnen, Schönhauser Allee, Prenzlauer
Allee, Greifswalder Straße, Landsberger Allee, Storkower Straße, Frankfurter Allee,
Ostkreuz, Treptower Park, Sonnenallee, Neukölln, Hermannstraße, Tempelhof, Südkreuz,
Schöneberg, Innsbrucker Platz, Bundesplatz, Heidelberger Platz, Hohenzollerndamm,
Halensee, Westkreuz, Messe Nord / ZOB, Westend, Jungfernheide, Beusselstraße,
Westhafen and Wedding. The retained S41 course remains the complete 1,182-vertex
closed circuit; no synthetic Ring chord or duplicate directional track is added.

## Bounded additions

At the 22 ordinary station signs the existing v190 board, posts, front inscription
and location remain intact. Their formerly blank reverse faces now carry the
same station name, correctly oriented for the opposite viewing direction. A
small two-sided S41/S42 strip identifies the Ring. It contains no invented
platform number, departure time or directional instruction. Placements and sign
styling remain the original illustrative station furniture, not a new signage
survey.

The four exact open canopy planes already supplied by v205 receive thirteen
slender posts and source-clipped cross members:

| Station | Retained OSM canopy identities |
| --- | --- |
| Schönhauser Allee | way/36218351 |
| Westhafen | way/375394534, way/438832765, way/44426688 |

Posts lie within the intersection of the mapped platform and roof; cross members
stay within the full roof plan, including its nonrectangular ends. They sit below
the existing cap. No second roof sheet, filled body or platform is introduced.
Support spacing, sections and steel colour are explicitly estimates. These four
planes retain the prior illustrative 8.46 m roof grade over the 3.96 m platform;
this is not an assertion about absolute railway survey levels.

**Wedding, Gesundbrunnen, Ostkreuz, Südkreuz and Westkreuz are protected.** They
are audited but receive none of these additions. In particular the v229 Wedding
height, access stairs, exact three-owner transfer and walking support remain
unchanged. Other retained coarse station shells are not silently removed or
misrepresented as repaired open interiors.

## Source preservation and implementation

`ring-stations-v232-evidence.json` records every station identity, all corresponding
platform/roof IDs, the protected set and hashes of prior source/model files.
`build_ring_stations_v232.py` replays from committed v180/v190/v205 data and the
existing core inventory without network or raw-cache requirements. The original
Ring/Stadtbahn geometries, packets, owner indices, terrain and navigation are
unchanged. Source attribution remains OpenStreetMap contributors, ODbL-1.0, and
retained Berlin LoD2, dl-de/zero-2-0. No new photograph, texture or font is bundled.

`createRingStationsV232(native)` is a separate static root with one independently
frustum-cullable batch per refined station. Its JSON `sites` field is
constructor-only; no source arrays or block plans escape into mesh metadata.
All drawn modes use the same complete model on desktop and touch. Native builds
only world-axis-aligned blocks. Its reverse lettering follows the **actual outer
boundary of the old stepped v190 sign boxes**, avoiding lettering hidden inside
the original AABBs. Canopy beams also have independent orthogonal subdivisions.

Measured cost: 5,748 bytes of runtime JSON; 22 batches in either mode; 3,259 drawn
instances / 247,684 instance-buffer bytes, or 9,631 native instances / 731,956
bytes, plus one shared unit cube. No textures, lights, frame callbacks, wider
coverage or increased residency limits are introduced.

## Verification

- Three Python tests check all 27 identities, all exact earlier hashes, full
  source containment, correct protected set and deterministic replay.
- Five Bun tests check actual old-sign matrices, visible exterior placement of
  every new reverse glyph sample, finite bounded buffers, orthogonal native
  matrices, static transforms, culling, no retained construction arrays/textures,
  and source-height support endpoints.
- The five original v190 Bun checks also pass, preserving all 39 distinct Ring
  and Stadtbahn station identities and the complete Ostkreuz reading.
- Ruff format/check pass for the new generator and Python tests. Browser review
  and production release are performed by the parent task.

Suggested inspection poses: Westhafen target `[-1841,6,-1966]`, camera
`[-1760,65,-1875]`; Schönhauser Allee target `[3016,6,-3331]`, camera
`[3095,65,-3250]`. For readable reverse signage use each exact generated sign
point and look along its negative normal at platform height plus 2.66 m.
