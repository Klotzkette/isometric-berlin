"""Capture a strict test-only current → immutable published v194 source layer.

Run only after root freezes product sources. No production file or old Golden
fixture is changed, imported, substituted or re-signed by this tool.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PUBLISHED = "8ab885c894768234d2198b56366fc1ba638c6f84"
PREVIOUS = "src/app/tests/fixtures/source-history-v300.json"
PREVIOUS_SHA = "a8cf059389bff3dd94a788d9cc8d4d82ec8ce4c4253abcbb150f53d929d8b6d7"
OUT = ROOT / "src/app/tests/fixtures/source-history-v303.json"


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def inverse(before: str, after: str) -> dict[str, Any]:
  records = []
  for group in difflib.SequenceMatcher(
    a=before.splitlines(True), b=after.splitlines(True), autojunk=False
  ).get_grouped_opcodes(3):
    a, b = before.splitlines(True), after.splitlines(True)
    old = "".join(a[group[0][1] : group[-1][2]])
    new = "".join(b[group[0][3] : group[-1][4]])
    if not new or after.count(new) != 1:
      raise ValueError("Ambiguous bounded current source inverse")
    records.append(dict(before=old, current=new))
  text = after
  for r in records:
    if text.count(r["current"]) != 1:
      raise ValueError("Overlapping source inverse")
    text = text.replace(r["current"], r["before"])
  if text != before:
    raise ValueError("Incomplete full source complement")
  return dict(
    beforeSha256=sha(before.encode()),
    currentSha256=sha(after.encode()),
    replacements=records,
  )


def build() -> None:
  previous = (ROOT / PREVIOUS).read_bytes()
  if sha(previous) != PREVIOUS_SHA:
    raise ValueError("Immutable v300 fixture changed")
  anchor = subprocess.check_output(
    ["git", "show", PUBLISHED + ":" + PREVIOUS], cwd=ROOT
  )
  if anchor != previous:
    raise ValueError("Old fixture differs from independent published v194 control")
  old = json.loads(previous)
  paths = set(old["currentGraph"])
  # Strongly pin the entire current production code/JSON set, including new
  # modules which are imported but remain disabled in historical constructors.
  paths.update(
    str(p.relative_to(ROOT))
    for p in (ROOT / "src/app/src").rglob("*")
    if p.is_file() and p.suffix in {".ts", ".tsx", ".json"}
  )
  graph = {p: sha((ROOT / p).read_bytes()) for p in sorted(paths)}
  published = {}
  changes = {}
  added = []
  proc = subprocess.Popen(
    ["git", "cat-file", "--batch"],
    cwd=ROOT,
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
  )
  assert proc.stdin and proc.stdout
  try:
    for path in sorted(paths):
      proc.stdin.write((PUBLISHED + ":" + path + "\n").encode())
      proc.stdin.flush()
      header = proc.stdout.readline().decode().strip()
      if header.endswith(" missing"):
        added.append(path)
        continue
      _, kind, size = header.split()
      assert kind == "blob"
      raw = proc.stdout.read(int(size))
      assert proc.stdout.read(1) == b"\n"
      published[path] = sha(raw)
      if path in old["currentGraph"] and published[path] != old["currentGraph"][path]:
        raise ValueError("Published control does not reproduce old graph pin: " + path)
      if graph[path] != published[path]:
        changes[path] = inverse(raw.decode(), (ROOT / path).read_bytes().decode())
  finally:
    proc.stdin.close()
    proc.stdout.close()
    proc.wait()
  if any(p not in published for p in old["currentGraph"]):
    raise ValueError("An immutable old graph file has no published control")
  final_paths = set(old["currentGraph"]) | {
    str(p.relative_to(ROOT))
    for p in (ROOT / "src/app/src").rglob("*")
    if p.is_file() and p.suffix in {".ts", ".tsx", ".json"}
  }
  if final_paths != paths or any(
    sha((ROOT / p).read_bytes()) != digest for p, digest in graph.items()
  ):
    raise ValueError("Product source changed during frozen capture")
  proof = dict(
    schemaVersion=1,
    publishedCommit=PUBLISHED,
    previousProofSha256=PREVIOUS_SHA,
    captureToolSha256=sha(Path(__file__).read_bytes()),
    currentGraph=graph,
    publishedGraph=published,
    additions=added,
    changes=changes,
  )
  OUT.write_text(json.dumps(proof, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      dict(
        bytes=OUT.stat().st_size,
        currentGraph=len(graph),
        publishedGraph=len(published),
        newSources=len(added),
        changedSources=len(changes),
      )
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--frozen-product-sources",
    action="store_true",
    help="Root has confirmed that shared product source editing is finished.",
  )
  args = parser.parse_args()
  if not args.frozen_product_sources:
    parser.error(
      "Final capture requires --frozen-product-sources after the shared product freeze"
    )
  build()
