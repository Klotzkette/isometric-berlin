# Step 10 — Museum Island bridge continuation (v1.0.143)

This bounded continuation replaces exactly three previously generic core bridge
owners: Schloßbrücke in Mitte, Eiserne Brücke and Schleusenbrücke. It does not
alter the v242 bridge source records or outer packets, nor either Monbijou arm.
Charlottenburg's Schlossbrücke remains the separate v242 owner.

## Evidence and interpretation

Complete retained OpenStreetMap bridge outlines and intersecting transport ways
anchor each plan. Source lane counts, bicycle lanes and access remain distinct
from estimated railing sections, pavement heights and decorative proportions.
Primary heritage evidence, checked 19 October 2026:

- [Schloßbrücke, Landesdenkmalamt 09030067](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030067):
  three masonry arches, iron railing and eight Carrara-marble sculptural groups
  on red-granite pedestals supply its architectural identity. Small figures are abstract
  procedural recognition, not scans of the originals.
- [Eiserne Brücke, Landesdenkmalamt 09030062](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030062):
  one iron arch faced in shell limestone, with masonry parapets interrupted by
  rectangular openwork bronze panels. The mapped living street does not
  authorize invented lane markings.
- [Schleusenbrücke, Landesdenkmalamt 09030072](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030072):
  a steel-beam bridge with wrought-iron wave and windrose railings and eight
  relief medallions, reproduced in aluminium in 1972–73.
  Decorative reliefs are simplified original geometry, not reproductions of
  historic panel artwork.

No photographic textures, copyrighted plans or external fonts are bundled.
OSM contributors' data remains ODbL-1.0; previously retained Berlin sources keep
their existing attribution. Unmeasured details remain display estimates.

## Preservation and runtime

Each replacement requires the complete unchanged previous bridge-cell set and
height datum. Both complete drawn/native families must succeed before that
generic owner is replaced. Failure keeps the old bridge intact. Source payloads
are injected by the viewer and must not enter the progressive terrain Worker.

Walking heights and side barriers follow the rendered plans, including curbs;
both approaches remain open. Mobile uses the same full drawn geometry as desktop.
Native geometry is independently orthogonal. Six modes, seven starts, 93 tour
stops, source coverage and live residency limits remain unchanged.

Further outer-bridge candidates were audited separately in
[the remaining-bridge inventory](spree-bridge-remaining-v243.md); that inventory
does not claim those candidates are rendered by this release.

## Validation

- Three complete owners replace exactly 102 former bridge cells. All v242
  bridge payloads and outer-city packets remain byte-for-byte unchanged.
- Focused tests cover complete footprint coverage, native orthogonality,
  malformed-pair fallback, actual raycast/walking agreement, rail collision and
  a root containing only v243 owners. Both Python source tests and all five new
  runtime tests pass; existing v242 runtime checks also pass.
- Final packed geometry is 369,402 bytes drawn and 500,838 bytes native
  (870,240 total). The production Worker is 16,164,076 bytes, below 16 MiB.
- Production TypeScript/build, repository Ruff format/lint, 101 release/package
  tests, release readiness and the local-package smoke test pass. The expanded
  package is 925,553,428 bytes (882.677 MiB), within its existing 884 MiB ceiling.
- WebKit mobile-profile and Chrome desktop production checks cover all six
  modes, the three bridges, a wide city view and return to Day: 28 views per
  engine, without context loss, page errors or recovery. After the internal
  deck riser colour correction, eight fresh WebKit views (cold native to Day)
  and four Chrome views pass. Screenshots confirm that the artificial pale
  cross-carriageway stripes are gone. These are emulated browser checks, not
  physical-phone certification.
- Historical audits now replay the already released v242 packet changes
  through their strict full-packet preservation receipts. A negative control
  confirms corrupted current bytes cannot be accepted as historical data.

- The full Python run completed with 1,537 passed and four skipped tests.
  Its 25 historical-receipt failures were resolved and passed targeted reruns:
  v213/BER, the station replay, v237/v238 integration and the door-wall replay.
  The new bridge source tests and new corruption negative control also pass.
  No failure was suppressed and no released packet was rewritten to satisfy an
  older receipt.
- ZIP and tarball SHA-256 digests match the uploaded release assets. The web
  deployment retains every asset from the current and previous two releases;
  only older, audited hashed assets are pruned.
