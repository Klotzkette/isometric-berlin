"""Complete v169 residential audit, exact colour ownership and protection."""

from __future__ import annotations

import base64
from pathlib import Path

import numpy as np

from scripts import build_remaining_alt_mitte_colours_v273 as module

ROOT = Path(__file__).resolve().parents[1]


def test_every_rendered_source_family_is_audited_and_v271_is_protected() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  owners = {row["id"]: row for row in evidence["owners"]}
  records = [
    row
    for row in module.prior.source_records()
    if row["category"] in {"core", "outer"} and row["sourceType"] == "official-lod2"
  ]
  assert set(owners) == {row["id"] for row in records}
  assert len(records) == evidence["sourceCounts"]["auditedSourceFamilies"] == 8374
  protected, _ = module.protected_owners(records)
  changed = set().union(*map(set, evidence["ownersReceivingSelectors"].values()))
  baseline = {
    row["id"]: row for row in module.prior.read(module.prior.EVIDENCE)["owners"]
  }
  assert changed
  for record in records:
    item = owners[record["id"]]
    assert item["parts"] == [part["id"] for part in record["parts"]]
    assert item["ordinaryEvidence"] == module.ordinary_reason(
      record, baseline[record["id"]]
    )
    assert item["v271Protected"] == bool(module.northern.zones_for(record))
    if item["v271Protected"] or module.prior.aliases(record) & protected:
      assert not item["eligible"] and record["id"] not in changed
    if record["id"] in changed:
      assert item["eligible"] and item["ordinaryEvidence"]
    tags = record.get("osmTags", {})
    if any(tags.get(key) for key in module.WALL_KEYS):
      assert not item["wallEligible"]
    if any(tags.get(key) for key in module.ROOF_KEYS):
      assert not item["roofEligible"]


def test_named_or_unqualified_uses_do_not_inherit_residential_fallback_paint() -> None:
  def record(kind: str | None, function: str = "31001_1010", **tags: str) -> dict:
    return {
      "name": None,
      "osmTags": {**({"building": kind} if kind else {}), **tags},
      "parts": [{"sourceAttributes": {"function": function}}],
    }

  assert module.ordinary_reason(record("apartments"), {"acceptedContext": True})
  assert module.ordinary_reason(record(None), {})
  assert not module.ordinary_reason(record("office"), {"acceptedContext": True})
  assert not module.ordinary_reason(
    record("apartments", name="Named campus"), {"acceptedContext": True}
  )
  assert not module.ordinary_reason(record("yes", "51009_1610"), {})
  assert not module.ordinary_reason(
    record("apartments", "unknown"), {"acceptedContext": False}
  )


def test_all_examined_packets_and_evidence_sources_remain_exact() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  runtime = module.prior.read(module.OUTPUT)
  assert module.prior.read(module.INDEX) == sorted(runtime["packets"])
  assert evidence["packetFilesChanged"] == 0
  assert evidence["sourceCounts"]["protectedResidualShells"] == 1
  assert evidence["sourceManifestSha256"] == module.prior.digest(
    module.prior.SOURCE / "source-manifest.json"
  )
  assert evidence["v271EvidenceSha256"] == module.prior.digest(module.northern.EVIDENCE)
  for row in [*evidence["allExaminedPackets"], *evidence["additionalProtection"]]:
    assert module.prior.digest(ROOT / row["file"]) == row["sha256"]
  assert len(evidence["allExaminedPackets"]) >= len(evidence["packetReceipts"])
  for mode in ("drawn", "minecraft"):
    assert evidence["modeCounts"][mode]["selectedVertices"] > 1000
    assert evidence["ownersReceivingSelectors"][mode]


def test_exact_colour_ranges_are_valid_and_disjoint_from_v271() -> None:
  runtime = module.prior.read(module.OUTPUT)
  northern = module.prior.read(module.northern.OUTPUT)
  for key, entries in runtime["packets"].items():
    for row in entries:
      runs = np.frombuffer(base64.b64decode(row["runs"]), dtype="<u4").reshape(-1, 3)
      assert len(runs) and np.all(runs[:, 1] > 0)
      assert np.all(runs[:, 2] < len(runtime["palette"]))
      assert np.all(runs[1:, 0] >= runs[:-1, 0] + runs[:-1, 1])
      old = next(
        (r for r in northern["packets"].get(key, []) if r["mesh"] == row["mesh"]), None
      )
      if old:
        assert old["fingerprint"] == row["fingerprint"]
        protected = np.frombuffer(base64.b64decode(old["runs"]), dtype="<u4").reshape(
          -1, 3
        )
        before = {
          v
          for start, count, _ in protected
          for v in range(int(start), int(start + count))
        }
        assert not any(
          v in before
          for start, count, _ in runs
          for v in range(int(start), int(start + count))
        )


def test_every_source_family_retains_native_ambiguity_blockers() -> None:
  surfaces, native, evidence, _, _ = module.source_selectors()
  ids = {row["id"] for row in evidence}
  residual_ids = {
    row["id"]
    for row in module.prior.source_records()
    if not row.get("parts") and row.get("needsResidualShell")
  }
  assert residual_ids == {"OSM-way-1030739581"}
  assert {row.owner for row in native} == ids | residual_ids
  assert all(len(row.roles) == 1 for row in native)
  owners = {row["id"]: row for row in evidence}
  for row in native:
    if row.owner in residual_ids:
      assert not row.allowed
      continue
    key = "roofEligible" if row.roles[0][0] == "RoofSurface" else "wallEligible"
    assert row.allowed == owners[row.owner][key]
  for row in surfaces:
    if row.owner in residual_ids:
      assert not row.allowed
      continue
    key = "roofEligible" if row.role == "RoofSurface" else "wallEligible"
    assert row.allowed == owners[row.owner][key]
