# Berlin fuel stations · V351

This pass audits the complete Berlin fuel-station inventory in the retained
13 November 2026 OpenStreetMap extract and makes source-bound forecourts more
recognizable. It does **not** claim that every currently operating station has
been found, photographed, or reconstructed.

## Coverage

| Evidence or representation | Count |
| --- | ---: |
| Source records inside the official Berlin state boundary | 305 |
| Mapped-active stations | 292 |
| Disused / razed source records retained, not built as active stations | 12 / 1 |
| Active identities matched to current primary operator directories | 223 |
| Active identities without that current operator crosscheck | 69 |
| Stations receiving newly visible canopy work in this pass | 64 |
| Existing complete detailed station models retained unchanged | 13 |
| Active stations without new source-bound architecture in this pass | 215 |

The 64 additions comprise 31 existing mapped canopies whose closed generic
walls are corrected and 33 mapped roofs absent from earlier local ground/body
coverage. There is no active-site sampling: all 305 records have a retained
identity and an explicit disposition. Of the remaining 215 active sites, 213
lack an unambiguous associated mapped canopy footprint after preserving the
13 legacy models. Two have old navigation envelopes without matching literal
roof faces in the streamed host; their existing architecture is retained.

The operator audit is documented separately in
[fuel-v351-operator-evidence.md](fuel-v351-operator-evidence.md). It matches
identities and addresses. Directory coordinates never move source geometry.
Circle K / TotalEnergies / Elan / Access naming conflicts remain explicit:
this pass does not infer changed visible branding from a directory name.

## Source hierarchy and geometry

* `fuel-v351-source.json.gz` retains the OSM geometries and tags, lifecycle,
  exact roof associations, ambiguous nearby roofs, outside-Berlin records and
  every complete legacy model. A roof is associated only through containment
  inside a mapped site or containment of its mapped station point, never from
  proximity alone. Nodes and areas are deduplicated only on compatible identity
  plus literal containment (the current inventory contains no such duplicates).
* `fuel-v351-inventory.json.gz` retains all 305 site records. Restricted and
  hydrogen-only sites are distinguished from ordinary forecourts; charging-only
  locations are not treated as fuel stations.
* `fuel-v351-dispositions.json.gz` assigns each of those 305 records exactly
  one representation status and a separate primary-directory identity status.
* `fuel-v351-ownership.json.gz` records every original and replacement navigation
  owner, literal preserved roof counts, wall retirements and unresolved cases.
* `fuel-v351-new-hosts.json.gz` retains each new mapped roof, descriptor, measured
  terrain range, dimensions and independent per-mode representation counts.
* `fuel-v351-terrain.json.gz` is the bounded official Berlin DGM1 extract for
  the 33 new roofs, with archive hashes, original one-metre sample coordinates,
  and NHN values. Scene height is NHN minus 30 metres. The flat forecourt datum
  is the median of the retained samples inside that exact roof; this flattening
  is a local model approximation, not a surveyed forecourt grading model.

The 31 existing roof corrections preserve every original roof triangle,
colour and roof ink. They remove only the source owner's literal full-depth
vertical walls. The remaining thin upper fascia and new underside form an
open canopy. Roof height and perimeter remain unchanged, including old
height estimates. The replacement navigation contains the same roof at the
new clear underside and separate colliding supports, islands and dispensers.

The 33 new sites add only their mapped canopy footprint and the corresponding
finite ground complement, independently subtracting existing Drawn and Native
ground. Existing building intersection is rejected in both modes. The old
city footprint and all unrelated geometry remain unchanged. The model uses
explicit OSM height / minimum height where available; otherwise canopy height
5.4 m and clear underside 4.95 m are recognition estimates. New Native roofs
use independently constructed half-metre cardinal cells fully inside the
mapped source footprint, with their own supports and floor datum.

No pump points are mapped in this extract. Dispenser counts, column positions,
pump islands, display panels, hose bars and fascia dimensions are therefore
**bounded recognition estimates**, contained inside the actual supported roof.
They are not asserted to be a survey of pump positions. Brand colours are
interpretive fascia accents based on retained identities; no current livery
is inferred from the operator directory conflicts. No price boards or live
prices, station interiors, car-wash roofs, or unmapped buildings are invented.

## Delivery and verification

The old roof corrections use complete raw and prepared SourceQuarter V303
receipts. A missing, modified or partial predecessor leaves the old geometry
and navigation closed and intact. The entire original roof/wall source remains
in its original packet. Four weakly loaded gzip source shards contain at most
16 host-mode keys each; the discarded unsplit development aggregate is not
bundled. New sites use 33 finite `fuel351-way-*` host pairs through the ordinary
streamed city lifecycle, with no global station scene or network lookup.

`src/app/scripts/check-fuel-v351.ts` exercises all 64 old-host mode plans through
both the transaction helpers and the **full production decoder**, including
later owners and ground overlays. The proof verifies 3,624 exact retired wall
triangles, 68 corrected navigation owners, unchanged old position/colour words,
unchanged ink, unchanged geometry outside the retirement list, and unchanged
navigation outside the exact source owners. Origin mutation, disabled admission
and incomplete prepared-source cases fail closed. Python tests also check the
complete inventory, all 13 legacy models, solid support and canopy containment.
All 66 new-host mode packets also pass the full production decoder, descriptor
containment, open under-roof passage, roof collision and post collision checks.

Regeneration commands (from the repository unless noted):

```sh
uv run python -m scripts.build_fuel_inventory_v351
uv run python -m scripts.build_fuel_packets_v351 --scan
uv run python -m scripts.build_fuel_packets_v351
uv run python -m scripts.build_fuel_packets_v351 --new
uv run python -m scripts.build_fuel_packets_v351 --audit
uv run pytest tests/test_fuel_v351.py tests/test_fuel_terrain_v351.py tests/test_fuel_operator_evidence_v351.py
```

The capture/compiler scratch directory is the task's `city-v351` directory.
From `src/app`, run `bun scripts/check-fuel-v351.ts <city-v351/fuel-captures>`
for complete production decode and negative admission checks. The manifest
integration consumes `city-v351/fuel-manifest-delta.json`; it does not regenerate
any older city packet.

Sources: © OpenStreetMap contributors, ODbL-1.0; official Berlin state boundary;
Geoportal Berlin ATKIS DGM1, dl-de-zero-2.0; primary operator directories as
individually linked and hashed in the operator evidence. No source imagery or
proprietary station photographs are shipped.
