# Tiergarten paths and Chancellery street edges, v345

A production-geometry audit found **13,854.434 m²** of retained Tiergarten paths
covered by coarse original ground. This pass clips only those demonstrated
occlusions: 433 final ground runs, 977 retained-complement spans and 2,898 cells.
The correction follows the actual named `Großer Tiergarten` source polygons,
not a rectangular neighborhood boundary. It adds no invented route.

The capture executes the real Drawn ground exclusions **after v343**, then the
same sand/earth builders and retained pretriangulated paving used by the public
Worker. Every source triangle has its actual Float32 world position and height.
The generator intersects the plane where a ground top is higher, retaining each
original run's complete outside geometry, top, bottom and paint. Previous
partial exclusions and earlier ground children remain untouched. Source path
courses/heights, bridges, water and walking levels do not change; independently
cardinal Native terrain remains unchanged.

Sources: retained OpenStreetMap contributors (ODbL 1.0), Berlin terrain data
(dl-de/zero-2-0), and the exact published v224 building/ground owners. The
[Berlin Tiergartenring description](https://www.berlin.de/sen/uvk/natur-und-gruen/landschaftsplanung/gruene-hauptwege/die-wege-im-ueberblick/artikel.930432.php)
provides route context. Future park maintenance plans are not modeled as completed
reroutes. The current Chancellery street course remains the v343 municipal-survey
and 2025-orthophoto comparison. See [that source audit](mitte-roads-v343.md).

The Chancellery street screenshot also shows near-coplanar edge shimmer where
retained land is less than a millimetre below the surveyed road. A one-unit depth
bias on these finite surveyed materials stabilizes rendering. All geometry and
navigation coordinates remain byte-identical; this does not repaint a road or
raise it through neighboring structures.

## Verification and cost

- Full SHA-256 pins for ground, surface source, retained paving and v343 ownership.
- Current numeric ground/path/park guard at every construction; in-place source
  changes fail closed even when the same object was previously admitted.
- Original cardinal host matrix, span, depth and top checks before each cut.
- Independent complete outside-area and source-path-area checks for every span.
- Exact foreign instance and earlier-child preservation; repeated admission inert.
- 20 compact geometry meshes, **3,675,864 bytes** including indices/attributes.
  This stays outside the initial entry graph and geometry Worker. No image,
  runtime data service, new codec or higher residency limit is introduced.

The proof is deliberately limited to these final coarse ground runs. It does not
claim that every path furnishing or every previous partial ground owner in the
park has been independently resurveyed.
