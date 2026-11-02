"""Freeze test-only exact source/instance inverses from isolated Git captures."""

from __future__ import annotations

import base64
import difflib
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/tests/fixtures/native-history-v299-replay.json"
COMMITS = {
  "0f": "0f6174362de87d785f6e6f5b864d05e5efa973fc",
  "v281": "4adfbf744f0c419851387fe874b7363acf449123",
}


def sha(raw):
  return hashlib.sha256(raw).hexdigest()


def digest(value):
  return sha(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def original(stage, path):
  return (
    (ROOT / path).read_text()
    if stage == "current"
    else subprocess.check_output(
      ["git", "show", f"{COMMITS[stage]}:{path}"], cwd=ROOT
    ).decode()
  )


def inverse(before, after):
  a, b = before.splitlines(True), after.splitlines(True)
  records = []
  for group in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_grouped_opcodes(3):
    old = "".join(a[group[0][1] : group[-1][2]])
    new = "".join(b[group[0][3] : group[-1][4]])
    assert new and after.count(new) == 1
    records.append(dict(before=old, current=new))
  replay = after
  for record in records:
    assert replay.count(record["current"]) == 1
    replay = replay.replace(record["current"], record["before"])
  assert replay == before
  return dict(
    beforeSha256=sha(before.encode()),
    currentSha256=sha(after.encode()),
    replacements=records,
  )


def rows(buffers):
  matrices = base64.b64decode(buffers["matrix"]["bytes"])
  colors = base64.b64decode(buffers["color"]["bytes"])
  assert len(matrices) // 64 == len(colors) // 12
  return [
    matrices[i : i + 64] + colors[i // 64 * 12 : i // 64 * 12 + 12]
    for i in range(0, len(matrices), 64)
  ]


def instance_delta(before, after):
  a, b = rows(before), rows(after)
  removed, added, retained = [], [], 0
  for mode, i, j, u, v in difflib.SequenceMatcher(
    a=a, b=b, autojunk=False
  ).get_opcodes():
    if mode == "equal":
      retained += j - i
    else:
      removed.extend(
        dict(index=k, data=base64.b64encode(a[k]).decode()) for k in range(i, j)
      )
      added.extend(
        dict(index=k, data=base64.b64encode(b[k]).decode()) for k in range(u, v)
      )
  return dict(
    beforeCount=len(a),
    afterCount=len(b),
    retainedCount=retained,
    removed=removed,
    added=added,
  )


def packed_attribute(attr):
  if attr is None:
    return None
  raw = base64.b64decode(attr["bytes"])
  return dict(
    type=attr["type"],
    itemSize=attr["itemSize"],
    normalized=attr["normalized"],
    bytes=len(raw),
    sha256=sha(raw),
    gzip=base64.b64encode(gzip.compress(raw, mtime=0)).decode(),
  )


def packed_json(value):
  raw = json.dumps(value, separators=(",", ":")).encode()
  return dict(
    bytes=len(raw),
    sha256=sha(raw),
    gzip=base64.b64encode(gzip.compress(raw, mtime=0)).decode(),
  )


def build():
  captures = {
    k: json.loads(Path(f"/tmp/native-{k}-v299.json").read_bytes())
    for k in ["current", "0f", "v281"]
  }
  expected = json.loads(
    (ROOT / "src/app/tests/fixtures/core-material-native-v281.json").read_bytes()
  )
  for profile in ["full", "mobile"]:
    assert captures["v281"]["profiles"][profile]["snapshot"] == expected[profile]
  proof = dict(
    schema=1,
    commits=COMMITS,
    captureToolSha256=sha(
      (ROOT / "src/app/tests/helpers/captureNativeHistoryV299.ts").read_bytes()
    ),
    currentGraph=captures["current"]["graphs"],
    sourceStages=[],
    profiles={},
  )
  for newer, older in [("current", "0f"), ("0f", "v281")]:
    changes = {}
    command = (
      ["git", "diff", "--name-only", COMMITS[older]]
      + ([] if newer == "current" else [COMMITS[newer]])
      + ["--", "src/app/src"]
    )
    paths = subprocess.check_output(command, cwd=ROOT).decode().splitlines()
    for path in paths:
      if not path.endswith((".ts", ".tsx")):
        continue
      if subprocess.run(
        ["git", "cat-file", "-e", COMMITS[older] + ":" + path],
        cwd=ROOT,
        capture_output=True,
      ).returncode:
        continue
      before, after = original(older, path), original(newer, path)
      if before != after:
        changes[path] = inverse(before, after)
        proof["currentGraph"][path] = sha((ROOT / path).read_bytes())
    proof["sourceStages"].append(dict(after=newer, before=older, changes=changes))
  # This frozen v281 fixture predates the same commit's later v288 append.
  justice = json.loads(
    (
      ROOT / "src/app/tests/fixtures/justice-panke-ber-v281-source-replay.json"
    ).read_bytes()
  )
  proof["fixtureSourceAlignment"] = {}
  for receipt in justice["sourceReplay"]:
    path = receipt["path"]
    old = subprocess.check_output(
      ["git", "show", justice["beforeCommit"] + ":" + path], cwd=ROOT
    ).decode()
    assert sha(old.encode()) == receipt["beforeSha256"]
    for change in receipt["replacements"]:
      assert old.count(change["before"]) == 1
      old = old.replace(change["before"], change["current"])
    assert sha(old.encode()) == receipt["currentSha256"]
    after = (ROOT / path).read_text()
    if old != after:
      proof["fixtureSourceAlignment"][path] = inverse(old, after)
  for profile in ["full", "mobile"]:
    stages = []
    for newer, older in [("current", "0f"), ("0f", "v281")]:
      after, before = (
        captures[newer]["profiles"][profile],
        captures[older]["profiles"][profile],
      )
      am, bm = ({r["key"]: r for r in d["records"]} for d in [after, before])
      added, removed = (
        [r for key, r in a.items() if key not in b] for a, b in [(am, bm), (bm, am)]
      )
      assert not removed
      changes = []
      for key, record in am.items():
        if key not in bm or record == bm[key]:
          continue
        a, b = before["buffers"][key], after["buffers"][key]
        if "matrix" in a:
          delta = dict(instances=packed_json(instance_delta(a, b)))
        else:
          delta = dict(
            attributes={k: packed_attribute(v) for k, v in a["attributes"].items()},
            index=packed_attribute(a["index"]),
          )
        changes.append(dict(before=bm[key], after=record, **delta))
      excluded = {r["key"] for r in added} | {r["after"]["key"] for r in changes}
      unchanged = [r for r in after["records"] if r["key"] not in excluded]
      assert sorted(unchanged, key=lambda r: r["key"]) == sorted(
        [r for r in before["records"] if r["key"] not in excluded],
        key=lambda r: r["key"],
      )
      stages.append(
        dict(
          after=newer,
          before=older,
          beforeSnapshot=before["snapshot"],
          afterSnapshot=after["snapshot"],
          beforeRecordsSha256=digest(before["records"]),
          afterRecordsSha256=digest(after["records"]),
          unchangedCount=len(unchanged),
          unchangedSha256=digest(unchanged),
          added=added,
          changes=changes,
          beforeRootChildren=[r["name"] for r in before["children"]],
        )
      )
    proof["profiles"][profile] = stages
  after, before = captures["0f"]["architecture"], captures["v281"]["architecture"]
  assert after == captures["current"]["architecture"]
  am, bm = ({r["key"]: r for r in d["records"]} for d in [after, before])
  changes = []
  for key, record in am.items():
    if record != bm[key]:
      changes.append(
        dict(
          before=bm[key],
          after=record,
          instances=packed_json(
            instance_delta(before["buffers"][key], after["buffers"][key])
          ),
        )
      )
  excluded = {c["after"]["key"] for c in changes}
  unchanged = [r for r in after["records"] if r["key"] not in excluded]
  proof["architecture"] = dict(
    beforeSnapshot=before["snapshot"],
    afterSnapshot=after["snapshot"],
    beforeRecordsSha256=digest(before["records"]),
    afterRecordsSha256=digest(after["records"]),
    unchangedSha256=digest(unchanged),
    beforeChildren=before["children"],
    afterChildren=after["children"],
    changes=changes,
  )
  family_captures = {
    k: json.loads(Path(f"/tmp/family-{k}-v299.json").read_bytes())
    for k in ["current", "0f", "v281"]
  }
  proof["familyCaptureToolSha256"] = sha(
    (ROOT / "src/app/tests/helpers/captureFamilyHistoryV299.ts").read_bytes()
  )
  proof["families"] = {}
  for path, digest_value in family_captures["current"]["graphs"].items():
    assert sha((ROOT / path).read_bytes()) == digest_value
    proof["currentGraph"][path] = digest_value
  for family in family_captures["current"]["families"]:
    before = family_captures["v281"]["families"][family]
    after = family_captures["current"]["families"][family]
    am, bm = ({r["key"]: r for r in d["records"]} for d in [after, before])
    assert all(key in am for key in bm)
    added = [r for key, r in am.items() if key not in bm]
    changes = []
    for key, record in am.items():
      if key not in bm or record == bm[key]:
        continue
      old, new = before["buffers"][key], after["buffers"][key]
      attrs = {
        name: packed_attribute(attr)
        for name, attr in old["attributes"].items()
        if attr != new["attributes"][name]
      }
      changes.append(
        dict(
          before=bm[key],
          after=record,
          attributes=attrs,
          **(
            {"instances": packed_json(instance_delta(old, new))}
            if "matrix" in old
            else {}
          ),
          stateChanges={
            field: {"before": value, "after": after["states"][key][field]}
            for field, value in before["states"][key].items()
            if value != after["states"][key][field]
          },
          **(
            {"index": packed_attribute(old["index"])}
            if old["index"] != new["index"]
            else {}
          ),
        )
      )
    excluded = {r["key"] for r in added} | {c["after"]["key"] for c in changes}
    unchanged = [r for r in after["records"] if r["key"] not in excluded]
    assert unchanged == [r for r in before["records"] if r["key"] not in excluded]
    proof["families"][family] = dict(
      beforeRecordsSha256=digest(before["records"]),
      afterRecordsSha256=digest(after["records"]),
      beforeStatic=before["static"],
      afterStatic=after["static"],
      unchangedSha256=digest(unchanged),
      added=added,
      changes=changes,
    )
  ground_captures = {
    k: json.loads(gzip.decompress(Path(f"/tmp/v193-ground-{k}.json.gz").read_bytes()))
    for k in ["0f", "v281"]
  }
  before, after = (ground_captures[k] for k in ["v281", "0f"])

  def ground_buffers(capture):
    return {
      key: dict(bytes=capture["buffers"][attr]["base64"])
      for key, attr in [("matrix", "instanceMatrix"), ("color", "instanceColor")]
    }

  delta = instance_delta(ground_buffers(before), ground_buffers(after))
  assert delta["beforeCount"] == 185228 and delta["afterCount"] == 185274
  proof["ground"] = dict(
    beforeSha256=before["sha256"],
    afterSha256=after["sha256"],
    instances=packed_json(delta),
    beforeSourceGraph=before["graphs"],
    afterSourceGraph=after["graphs"],
  )
  OUT.write_text(json.dumps(proof, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      dict(
        bytes=OUT.stat().st_size,
        sourceStages=[len(s["changes"]) for s in proof["sourceStages"]],
        geometryStages=[
          dict(add=len(s["added"]), changed=len(s["changes"]))
          for s in proof["profiles"]["full"]
        ],
      )
    )
  )


if __name__ == "__main__":
  build()
