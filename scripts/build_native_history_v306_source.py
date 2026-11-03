"""Capture a strict test-only current → immutable published v195 source layer.

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
PUBLISHED = "9727870f79db9c6a6e9d6437668e5ac13229522f"
PREVIOUS = "src/app/tests/fixtures/source-history-v303.json"
PREVIOUS_SHA = "299981a770ce72ec05d507ab60b5e88a3c3da49cc068a9f3a0f831d0526cadb0"
OUT = ROOT / "src/app/tests/fixtures/source-history-v306.json"


def sha(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def inverse(before: str, after: str) -> dict[str, Any]:
  a, b = before.splitlines(True), after.splitlines(True)
  matcher = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
  # Repeated lifecycle blocks need enough exact context to be unique. Widen
  # context instead of admitting positional, fuzzy or partial replacements.
  for context in dict.fromkeys([3, 6, 12, 24, 48, 96, 192, 384, max(len(a), len(b))]):
    records = []
    for group in matcher.get_grouped_opcodes(context):
      old = "".join(a[group[0][1] : group[-1][2]])
      new = "".join(b[group[0][3] : group[-1][4]])
      if not new or after.count(new) != 1:
        break
      records.append(dict(before=old, current=new))
    else:
      text = after
      for record in records:
        if text.count(record["current"]) != 1:
          break
        text = text.replace(record["current"], record["before"])
      else:
        if text == before:
          return dict(
            beforeSha256=sha(before.encode()),
            currentSha256=sha(after.encode()),
            replacements=records,
          )
  raise ValueError("No unambiguous exact full source inverse")


def build() -> None:
  previous = (ROOT / PREVIOUS).read_bytes()
  if sha(previous) != PREVIOUS_SHA:
    raise ValueError("Immutable v303 fixture changed")
  anchor = subprocess.check_output(
    ["git", "show", PUBLISHED + ":" + PREVIOUS], cwd=ROOT
  )
  if anchor != previous:
    raise ValueError("Old fixture differs from independent published v195 control")
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
        try:
          changes[path] = inverse(raw.decode(), (ROOT / path).read_bytes().decode())
        except ValueError as error:
          raise ValueError(f"{path}: {error}") from error
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
